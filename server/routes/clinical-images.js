const express = require("express");

const mainPrisma = require("../lib/prisma");
const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { canEditClinicalData, canViewClinicalData, canAccessWholeClinic } = require("../lib/permissions");
const { checkClinicalImagesFeature } = require("../lib/plan-limits");
const { uploadFile, getFileStream, deleteFile, isR2Key, isStorageConfigured, ALLOWED_MIME_TYPES } = require("../lib/storage");
const crypto = require("crypto");

const router = express.Router();

function getServeSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[FATAL] JWT_SECRET no configurado.");
  return secret;
}

function signServeToken(imageId) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sig = crypto
    .createHmac("sha256", getServeSecret())
    .update(`serve:${imageId}:${exp}`)
    .digest("hex")
    .slice(0, 32);
  return `${exp}.${sig}`;
}

function verifyServeToken(imageId, token) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Date.now() / 1000 > Number(exp)) return false;
  const expected = crypto
    .createHmac("sha256", getServeSecret())
    .update(`serve:${imageId}:${exp}`)
    .digest("hex")
    .slice(0, 32);
  return sig === expected;
}

function serializeImage(image) {
  const fileUrl = isR2Key(image.imageUrl)
    ? `/api/clinical-images/serve/${image.id}?t=${signServeToken(image.id)}`
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
    if (!verifyServeToken(imageId, req.query.t)) {
      return res.status(401).send("Token inválido o expirado.");
    }

    const image = await mainPrisma.clinicalImage.findFirst({
      where: { id: imageId, deletedAt: null },
    });

    if (!image || !isR2Key(image.imageUrl)) {
      return res.status(404).send("Archivo no encontrado.");
    }

    const { body, contentType } = await getFileStream(image.imageUrl);
    const isPdf = (image.mimeType || contentType) === "application/pdf";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (isPdf) {
      const name = image.fileName || `documento-${image.id}.pdf`;
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(name)}"`);
    }

    return res.send(body);
  } catch (e) {
    console.error("[clinical-images serve]", e.message);
    return res.status(500).send("Error al obtener el archivo.");
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canViewClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver archivos clínicos." });
    }

    const patientId      = req.query.patientId ? Number(req.query.patientId) : null;
    const professionalId = getProfessionalIdFilter(req.permissions, req.query.professionalId);

    const images = await prisma.clinicalImage.findMany({
      where: {
        deletedAt: null,
        ...(patientId      ? { patientId }      : {}),
        ...(professionalId ? { professionalId } : {}),
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return res.json({ ok: true, images: images.map(serializeImage) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los archivos clínicos." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para cargar archivos clínicos." });
    }

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
        storedUrl    = result.key;
        detectedMime = result.mimeType;
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
          description:      item.description ? String(item.description).trim() : null,
          takenAt:          item.takenAt ? new Date(item.takenAt) : null,
          deletedAt:        null,
        },
      });

      createdItems.push(serializeImage(created));
    }

    return res.status(201).json({ ok: true, images: createdItems });
  } catch (error) {
    console.error("[clinical-images POST]", error);
    return res.status(500).json({ ok: false, error: "No se pudieron guardar los archivos clínicos." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar archivos clínicos." });
    }

    const existing = await prisma.clinicalImage.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
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

    return res.json({ ok: true, image: serializeImage(updated) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el archivo clínico." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar archivos clínicos." });
    }

    const existing = await prisma.clinicalImage.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
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

    await logDeleteAudit(prisma, req.user.id, "ClinicalImage", existing.id, { image: existing });

    return res.json({ ok: true, message: "Archivo clínico eliminado correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar el archivo clínico." });
  }
});

module.exports = router;
