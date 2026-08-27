const express = require("express");

const mainPrisma = require("../lib/prisma");
const { getClinicPrisma } = require("../lib/clinic-prisma");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere, buildSharedRecordWhere } = require("../lib/access");
const { canEditClinicalData, canViewClinicalData, canAccessWholeClinic } = require("../lib/permissions");
const { checkClinicalImagesFeature } = require("../lib/plan-limits");
const {
  uploadFile,
  getFileReadable,
  deleteFile,
  isR2Key,
  isStorageConfigured,
  ALLOWED_MIME_TYPES,
} = require("../lib/storage");
const { signToken, verifyToken } = require("../lib/signed-token");
const { requirePermission } = require("../middleware/require-permission");
const { exportLimiter } = require("../middleware/rate-limit");
const { logSecurityEvent } = require("../lib/security-logger");
const {
  buildArchiveFileName,
  checkExportLimits,
  writeClinicalExportZip,
  MAX_FILES,
} = require("../lib/zip-export");
const crypto = require("crypto");

const router = express.Router();

// Los archivos se muestran en un <img src> o en un <iframe>, que no admiten un
// header de autorización: el permiso viaja en la URL. Una hora alcanza para ver
// la ficha sin que el link quede utilizable indefinidamente si se comparte.
const SERVE_TTL_SECONDS = 3600;

// Los cuatro comparten canEditClinicalData salvo el primero: lo que cambia es
// el mensaje, que nombra la acción concreta que se intentó.
const puedeVerArchivos = requirePermission(
  canViewClinicalData,
  "No tenes permisos para ver archivos clínicos.",
);
const puedeCargarArchivos = requirePermission(
  canEditClinicalData,
  "No tenes permisos para cargar archivos clínicos.",
);
const puedeEditarArchivos = requirePermission(
  canEditClinicalData,
  "No tenes permisos para editar archivos clínicos.",
);
const puedeEliminarArchivos = requirePermission(
  canEditClinicalData,
  "No tenes permisos para eliminar archivos clínicos.",
);

// La clínica entra en la firma además del id de la imagen. Sin ella, las
// clínicas con base dedicada comparten espacio de ids: un token emitido para la
// imagen 5 de una clínica serviría para la imagen 5 de otra, que es un archivo
// distinto. El clinicId viaja en la URL porque el verificador necesita
// conocerlo para recalcular el HMAC; alterarlo invalida la firma.
function signServeToken(clinicId, imageId) {
  return signToken({ scope: "serve", parts: [clinicId, imageId], ttlSeconds: SERVE_TTL_SECONDS });
}

function verifyServeToken(clinicId, imageId, token) {
  return verifyToken({ scope: "serve", parts: [clinicId, imageId], token });
}

function serializeImage(image, clinicId) {
  const fileUrl = isR2Key(image.imageUrl)
    ? `/api/clinical-images/serve/${image.id}?c=${clinicId}&t=${signServeToken(clinicId, image.id)}`
    : image.imageUrl;

  return {
    id:               image.id,
    patientId:        image.patientId,
    professionalId:   image.professionalId ?? null,
    uploadedByUserId: image.uploadedByUserId,
    imageUrl:         fileUrl,
    mimeType:         image.mimeType || "image/jpeg",
    fileName:         image.fileName || null,
    description:      image.description,
    takenAt:          image.takenAt,
    createdAt:        image.createdAt,
  };
}

function getProfessionalIdFilter(permissions, overrideId) {
  if (canAccessWholeClinic(permissions)) {
    return overrideId ? Number(overrideId) : null;
  }
  if (permissions.assignedProfessionalId) return permissions.assignedProfessionalId;
  const scoped = permissions.allowedProfessionalIds || [];
  if (scoped.length === 1) return scoped[0];
  return null;
}

// ── GET /api/clinical-images/serve/:id ───────────────────────────────────────
// Proxy seguro con token HMAC. Para PDFs agrega Content-Disposition.
router.get("/serve/:id", async (req, res) => {
  try {
    const imageId = Number(req.params.id);
    const clinicId = Number(req.query.c);
    if (!Number.isInteger(clinicId) || !verifyServeToken(clinicId, imageId, req.query.t)) {
      return res.status(401).send("Token inválido o expirado.");
    }

    // El archivo se busca en la base de SU clínica, no en la principal: con una
    // clínica de base dedicada, el mismo id apunta a un archivo distinto en cada
    // base y se serviría el de otra clínica.
    const prisma = await getClinicPrisma(clinicId);
    const image = await prisma.clinicalImage.findFirst({
      where: { id: imageId, deletedAt: null },
    });

    if (!image || !isR2Key(image.imageUrl)) {
      return res.status(404).send("Archivo no encontrado.");
    }

    // Streaming y no Buffer.concat: una radiografía de 20 MB no tiene por qué
    // pasar entera por la memoria del servidor para llegar al navegador.
    const { body, contentType, contentLength } = await getFileReadable(image.imageUrl);
    const isPdf = (image.mimeType || contentType) === "application/pdf";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (contentLength !== null) res.setHeader("Content-Length", contentLength);

    if (isPdf) {
      const name = image.fileName || `documento-${image.id}.pdf`;
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(name)}"`);
    }

    // Si el navegador corta la descarga hay que cerrar el stream de R2: sin
    // esto se sigue bajando (y pagando egress) un archivo que nadie recibe.
    res.on("close", () => {
      if (!res.writableFinished) body.destroy();
    });

    body.on("error", (error) => {
      console.error("[clinical-images serve] stream:", error.message);
      // Con los headers ya enviados no se puede responder un error: cortar la
      // conexión es lo único que le avisa al navegador que quedó incompleto.
      res.destroy();
    });

    return body.pipe(res);
  } catch (e) {
    console.error("[clinical-images serve]", e.message);
    return res.status(500).send("Error al obtener el archivo.");
  }
});

// ── Exportación masiva ───────────────────────────────────────────────────────
//
// Dos pasos a propósito:
//
//   1. POST /export/token  — autenticado por header. Valida permisos, plan y
//      límites, y congela la lista de archivos. Todavía puede responder JSON.
//   2. GET  /export/:token — sin header (es una navegación del navegador, que
//      no puede mandar Authorization). Solo streamea lo ya autorizado.
//
// El token es opaco y los parámetros viven en la base: no hay nada manipulable
// en la URL, ni nada sensible que pueda terminar en los logs del reverse proxy.

const EXPORT_TTL_SECONDS = 300;
// Se permite usarlo dos veces dentro del TTL: con un solo uso, un reintento del
// navegador ante un corte de red dejaba al usuario sin poder bajar el archivo.
const EXPORT_MAX_USES = 2;

// El limitador va después de requireAuth: agrupa por usuario, así una clínica
// entera detrás de la misma IP no se bloquea entre sí.
router.post("/export/token", requireAuth, exportLimiter, puedeVerArchivos, async (req, res) => {
  try {
    const prisma = req.prisma;

    const clinic = await prisma.clinic.findUnique({
      where: { id: req.user.clinicId },
      select: { plan: true },
    });
    const planCheck = checkClinicalImagesFeature(clinic?.plan);
    if (!planCheck.allowed) {
      return res.status(403).json({ ok: false, error: planCheck.error, code: "PLAN_LIMIT" });
    }

    const patientId = Number(req.body?.patientId);
    if (!Number.isInteger(patientId)) {
      return res.status(400).json({ ok: false, error: "Falta el paciente." });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const desde = parseFechaOpcional(req.body?.from);
    const hasta = parseFechaOpcional(req.body?.to);

    const images = await prisma.clinicalImage.findMany({
      where: {
        patientId,
        deletedAt: null,
        ...buildSharedRecordWhere(req.permissions),
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
        ...(desde || hasta
          ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
          : {}),
      },
      select: { id: true, fileSizeBytes: true },
      orderBy: [{ createdAt: "asc" }],
    });

    const limites = checkExportLimits(images);
    if (!limites.ok) {
      return res.status(400).json({ ok: false, error: limites.error });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await mainPrisma.clinicalExportToken.create({
      data: {
        token,
        clinicId:  req.user.clinicId,
        userId:    req.user.id,
        patientId,
        imageIds:  images.map((image) => image.id),
        expiresAt: new Date(Date.now() + EXPORT_TTL_SECONDS * 1000),
      },
    });

    // Se devuelve el token y no una URL armada: el cliente ya sabe dónde está
    // la API (API_BASE_URL), y mandarle una ruta absoluta lo obligaría a
    // recortarle el prefijo con una expresión regular.
    return res.json({
      ok:        true,
      token,
      fileCount: images.length,
      expiresIn: EXPORT_TTL_SECONDS,
    });
  } catch (error) {
    console.error("[clinical-images export/token]", error);
    return res.status(500).json({ ok: false, error: "No se pudo preparar la descarga." });
  }
});

// El token va en la query string y NO en el path (…/export/<token>) por una
// razón concreta: security-logger sanea los valores de la query pero no puede
// adivinar qué segmento de una ruta es un secreto. Con el token en el path
// quedaba escrito entero en securityEvent.path, que es la tabla de auditoría.
router.get("/export", async (req, res) => {
  let autorizacion = null;

  try {
    autorizacion = await mainPrisma.clinicalExportToken.findUnique({
      where: { token: String(req.query.t || "") },
    });

    if (!autorizacion || autorizacion.expiresAt.getTime() < Date.now()) {
      return res.status(401).send("El enlace de descarga venció. Volvé a generarlo.");
    }

    // El uso se reclama con un UPDATE condicional y se decide por el resultado,
    // en vez de leer usedCount y después incrementarlo. Con esos dos pasos
    // separados, dos descargas simultáneas leían el mismo valor y las dos
    // pasaban el control: el tope de usos no se respetaba.
    const reclamo = await mainPrisma.clinicalExportToken.updateMany({
      where: { token: autorizacion.token, usedCount: { lt: EXPORT_MAX_USES } },
      data:  { usedCount: { increment: 1 } },
    });
    if (reclamo.count === 0) {
      return res.status(401).send("Este enlace de descarga ya se usó. Volvé a generarlo.");
    }

    const imageIds = Array.isArray(autorizacion.imageIds) ? autorizacion.imageIds : [];

    // La base de la clínica que pidió la exportación, no la principal: con una
    // clínica de base dedicada, estos ids existen en su base y en la compartida
    // apuntan a archivos de otra clínica.
    const prisma = await getClinicPrisma(autorizacion.clinicId);

    // No se vuelve a decidir qué se incluye: los permisos ya se evaluaron al
    // emitir el token. Solo se re-consultan los datos de los archivos.
    const images = await prisma.clinicalImage.findMany({
      where:   { id: { in: imageIds }, deletedAt: null },
      include: {
        professional:   { select: { fullName: true } },
        uploadedByUser: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const patient = await prisma.patient.findUnique({
      where:  { id: autorizacion.patientId },
      select: { fullName: true, dni: true },
    });

    // Todo lo que puede fallar con un JSON ya pasó. A partir de acá se escribe.
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${buildArchiveFileName(patient)}"`,
    );
    // Sin esto nginx acumula la respuesta entera antes de mandarla, y se pierde
    // todo el beneficio de streamear.
    res.setHeader("X-Accel-Buffering", "no");

    const resultado = await writeClinicalExportZip({
      destination: res,
      images,
      openSource:  abrirArchivoParaZip,
      describeForIndex: (image) => ({
        fecha:           (image.takenAt || image.createdAt)?.toISOString?.().slice(0, 10) || "",
        descripcion:     image.description || "",
        nombre_original: image.fileName || "",
        profesional:     image.professional?.fullName || "",
        subido_por:      image.uploadedByUser?.fullName || "",
        subido_el:       image.createdAt?.toISOString?.().slice(0, 10) || "",
      }),
    });

    logSecurityEvent("CLINICAL_EXPORT", req, {
      patientId:  autorizacion.patientId,
      exportedBy: autorizacion.userId,
      fileCount:  resultado.incluidos,
      skipped:    resultado.omitidos,
      totalBytes: resultado.bytes,
      outcome:    "completed",
    });

    return undefined;
  } catch (error) {
    console.error("[clinical-images export]", error.message);

    logSecurityEvent("CLINICAL_EXPORT", req, {
      patientId:  autorizacion?.patientId ?? null,
      exportedBy: autorizacion?.userId ?? null,
      outcome:    "failed",
    });

    if (res.headersSent) {
      // El ZIP quedó a medias. Cortar la conexión es lo correcto: un archivo
      // que parece completo y no lo está es peor que una descarga rota.
      return res.destroy();
    }
    return res.status(500).send("No se pudo generar la descarga.");
  }
});

/**
 * Abre un archivo clínico para meterlo en el ZIP.
 *
 * Contempla los tres formatos que conviven en imageUrl: claves de R2, data URLs
 * de antes de R2, y URLs externas. Estas últimas no se descargan a propósito
 * (sería una puerta a SSRF) y quedan asentadas en el índice.
 */
async function abrirArchivoParaZip(image) {
  if (isR2Key(image.imageUrl)) {
    try {
      const { body } = await getFileReadable(image.imageUrl);
      return { source: body };
    } catch (error) {
      console.error(`[clinical-images export] archivo ${image.id} ilegible:`, error.message);
      return { source: null, motivoOmision: "no se pudo leer del almacenamiento" };
    }
  }

  if (typeof image.imageUrl === "string" && image.imageUrl.startsWith("data:")) {
    const match = image.imageUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) return { source: null, motivoOmision: "formato interno inválido" };
    return { source: Buffer.from(match[1], "base64") };
  }

  return { source: null, motivoOmision: "archivo externo, no incluido" };
}

function parseFechaOpcional(value) {
  if (!value) return null;
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

router.get("/", requireAuth, puedeVerArchivos, async (req, res) => {
  try {
    const prisma = req.prisma;

    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    // Los archivos clínicos son parte de la ficha del paciente: se comparten
    // con toda la clínica (a diferencia de recetas/presupuestos). El query
    // param professionalId acá es solo un filtro opcional de visualización,
    // no una restricción de acceso.
    const professionalIdFilter = req.query.professionalId ? Number(req.query.professionalId) : null;

    const images = await prisma.clinicalImage.findMany({
      where: {
        deletedAt: null,
        ...(patientId ? { patientId } : {}),
        ...(professionalIdFilter ? { professionalId: professionalIdFilter } : {}),
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return res.json({ ok: true, images: images.map((img) => serializeImage(img, req.user.clinicId)) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los archivos clínicos." });
  }
});

router.post("/", requireAuth, puedeCargarArchivos, async (req, res) => {
  try {
    const prisma = req.prisma;

    const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId }, select: { plan: true } });
    const planCheck = checkClinicalImagesFeature(clinic?.plan);
    if (!planCheck.allowed) {
      return res.status(403).json({ ok: false, error: planCheck.error, code: "PLAN_LIMIT" });
    }

    const patientId      = Number(req.body.patientId);
    const professionalId = getProfessionalIdFilter(req.permissions, req.body.professionalId);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const items = Array.isArray(req.body.images) ? req.body.images : [req.body];
    const createdItems = [];

    for (const item of items) {
      if (!item?.imageUrl) continue;

      let storedUrl = String(item.imageUrl).trim();
      let detectedMime = item.mimeType || "image/jpeg";
      let fileSizeBytes = null;
      const fileName = item.fileName ? String(item.fileName).slice(0, 255) : null;

      // Detectar MIME desde data URL
      if (storedUrl.startsWith("data:")) {
        const mimeMatch = storedUrl.match(/^data:([^;]+);base64,/);
        detectedMime = mimeMatch?.[1] || detectedMime;
        if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
          return res.status(400).json({
            ok: false,
            error: "Tipo de archivo no permitido. Se aceptan imágenes (JPEG, PNG, WebP, GIF) y PDFs.",
          });
        }
      }

      if (isStorageConfigured() && storedUrl.startsWith("data:")) {
        const result = await uploadFile({
          base64:    storedUrl,
          clinicId:  req.user.clinicId,
          patientId,
        });
        storedUrl     = result.key;
        detectedMime  = result.mimeType;
        fileSizeBytes = result.sizeBytes;
      } else if (!isStorageConfigured() && storedUrl.startsWith("data:")) {
        return res.status(503).json({ ok: false, error: "El almacenamiento de archivos no está configurado en el servidor." });
      }

      const created = await prisma.clinicalImage.create({
        data: {
          patientId,
          professionalId:   professionalId || null,
          uploadedByUserId: req.user.id,
          imageUrl:         storedUrl,
          mimeType:         detectedMime,
          fileName:         fileName,
          fileSizeBytes:    fileSizeBytes,
          description:      item.description ? String(item.description).trim() : null,
          takenAt:          item.takenAt ? new Date(item.takenAt) : null,
          deletedAt:        null,
        },
      });

      createdItems.push(serializeImage(created, req.user.clinicId));
    }

    return res.status(201).json({ ok: true, images: createdItems });
  } catch (error) {
    console.error("[clinical-images POST]", error);
    return res.status(500).json({ ok: false, error: "No se pudieron guardar los archivos clínicos." });
  }
});

router.put("/:id", requireAuth, puedeEditarArchivos, async (req, res) => {
  try {
    const prisma = req.prisma;
    const existing = await prisma.clinicalImage.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
        // Un archivo asignado a un profesional puntual no lo puede tocar otro
        // colega — los archivos sin profesional (professionalId null) siguen
        // siendo compartidos y cualquiera con permiso de edición los maneja.
        ...buildSharedRecordWhere(req.permissions),
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Archivo clínico no encontrado o sin acceso." });
    }

    const updated = await prisma.clinicalImage.update({
      where: { id: existing.id },
      data: {
        description: req.body.description !== undefined
          ? (req.body.description ? String(req.body.description).trim() : null)
          : existing.description,
        takenAt: req.body.takenAt !== undefined
          ? (req.body.takenAt ? new Date(req.body.takenAt) : null)
          : existing.takenAt,
        fileName: req.body.fileName !== undefined
          ? (req.body.fileName ? String(req.body.fileName).slice(0, 255) : null)
          : existing.fileName,
      },
    });

    return res.json({ ok: true, image: serializeImage(updated, req.user.clinicId) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el archivo clínico." });
  }
});

router.delete("/:id", requireAuth, puedeEliminarArchivos, async (req, res) => {
  try {
    const prisma = req.prisma;
    const existing = await prisma.clinicalImage.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
        // Un archivo asignado a un profesional puntual no lo puede tocar otro
        // colega — los archivos sin profesional (professionalId null) siguen
        // siendo compartidos y cualquiera con permiso de edición los maneja.
        ...buildSharedRecordWhere(req.permissions),
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Archivo clínico no encontrado o sin acceso." });
    }

    if (isR2Key(existing.imageUrl)) {
      await deleteFile(existing.imageUrl).catch((err) =>
        console.error("[clinical-images] Error eliminando de R2:", err.message)
      );
    }

    await prisma.clinicalImage.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ ok: true, message: "Archivo clínico eliminado correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar el archivo clínico." });
  }
});

module.exports = router;
