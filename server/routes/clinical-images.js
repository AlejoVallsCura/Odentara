const express = require("express");

const prisma = require("../lib/prisma");
const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { canEditClinicalData, canViewClinicalData } = require("../lib/permissions");
const { checkClinicalImagesFeature } = require("../lib/plan-limits");
const { uploadImage, getImageStream, deleteImage, isR2Key, isStorageConfigured } = require("../lib/storage");
const crypto = require("crypto");

const router = express.Router();

/** Genera un token HMAC de 1 hora para servir una imagen sin necesitar el header de auth */
function signServeToken(imageId) {
  const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hora
  const sig = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "fallback")
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
    .createHmac("sha256", process.env.JWT_SECRET || "fallback")
    .update(`serve:${imageId}:${exp}`)
    .digest("hex")
    .slice(0, 32);
  return sig === expected;
}

/**
 * Serializa una imagen.
 * - Si es key de R2 → devuelve URL proxy con token HMAC firmado
 * - Si es base64 legacy → la devuelve tal cual
 */
function serializeImage(image) {
  const imageUrl = isR2Key(image.imageUrl)
    ? `/api/clinical-images/serve/${image.id}?t=${signServeToken(image.id)}`
    : image.imageUrl;

  return {
    id:               image.id,
    patientId:        image.patientId,
    professionalId:   image.professionalId ?? null,
    uploadedByUserId: image.uploadedByUserId,
    imageUrl,
    description:      image.description,
    takenAt:          image.takenAt,
    createdAt:        image.createdAt,
  };
}

function getProfessionalIdFilter(permissions, overrideId) {
  if (permissions.isSuperadmin) {
    return overrideId ? Number(overrideId) : null;
  }
  return permissions.assignedProfessionalId || null;
}

// ── GET /api/clinical-images/serve/:id ───────────────────────────────────────
// Proxy seguro: verifica token HMAC (no necesita header JWT — es una petición de <img src>).
router.get("/serve/:id", async (req, res) => {
  try {
    const imageId = Number(req.params.id);
    if (!verifyServeToken(imageId, req.query.t)) {
      return res.status(401).send("Token inválido o expirado.");
    }

    const image = await prisma.clinicalImage.findFirst({
      where: { id: imageId, deletedAt: null },
    });

    if (!image || !isR2Key(image.imageUrl)) {
      return res.status(404).send("Imagen no encontrada.");
    }

    const { body, contentType } = await getImageStream(image.imageUrl);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(body);
  } catch (e) {
    console.error("[clinical-images serve]", e.message);
    return res.status(500).send("Error al obtener la imagen.");
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    if (!canViewClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver imágenes clínicas." });
    }

    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    const professionalId = getProfessionalIdFilter(req.permissions, req.query.professionalId);
    const images = await prisma.clinicalImage.findMany({
      where: {
        deletedAt: null,
        ...(patientId ? { patientId } : {}),
        ...(professionalId ? { professionalId } : {}),
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return res.json({ ok: true, images: images.map(serializeImage) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar las imágenes clínicas." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para cargar imágenes clínicas." });
    }

    // ── Verificar feature de plan ─────────────────────────────────────────────
    const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId }, select: { plan: true } });
    const planCheck = checkClinicalImagesFeature(clinic?.plan);
    if (!planCheck.allowed) {
      return res.status(403).json({ ok: false, error: planCheck.error, code: "PLAN_LIMIT" });
    }

    const patientId = Number(req.body.patientId);
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

      // Si R2 está configurado y la imagen llega como base64, subirla a R2
      if (isStorageConfigured() && storedUrl.startsWith("data:")) {
        try {
          storedUrl = await uploadImage({
            base64:    storedUrl,
            clinicId:  req.user.clinicId,
            patientId,
          });
        } catch (uploadErr) {
          console.error("[clinical-images] Error subiendo a R2:", uploadErr.message);
          // Si falla el upload, guardar base64 como fallback
        }
      }

      const created = await prisma.clinicalImage.create({
        data: {
          patientId,
          professionalId: professionalId || null,
          uploadedByUserId: req.user.id,
          imageUrl:    storedUrl,
          description: item.description ? String(item.description).trim() : null,
          takenAt:     item.takenAt ? new Date(item.takenAt) : null,
          deletedAt:   null,
        },
      });

      createdItems.push(serializeImage(created));
    }

    return res.status(201).json({ ok: true, images: createdItems });
  } catch (error) {
    console.error("[clinical-images POST]", error);
    return res.status(500).json({ ok: false, error: "No se pudieron guardar las imágenes clínicas." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar imágenes clínicas." });
    }

    const existing = await prisma.clinicalImage.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Imagen clínica no encontrada o sin acceso." });
    }

    const updated = await prisma.clinicalImage.update({
      where: { id: existing.id },
      data: {
        description: req.body.description !== undefined ? (req.body.description ? String(req.body.description).trim() : null) : existing.description,
        takenAt:     req.body.takenAt !== undefined ? (req.body.takenAt ? new Date(req.body.takenAt) : null) : existing.takenAt,
        deletedAt:   null,
      },
    });

    return res.json({ ok: true, image: serializeImage(updated) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar la imagen clínica." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar imágenes clínicas." });
    }

    const existing = await prisma.clinicalImage.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Imagen clínica no encontrada o sin acceso." });
    }

    // Eliminar de R2 si es una key
    if (isR2Key(existing.imageUrl)) {
      await deleteImage(existing.imageUrl).catch((err) =>
        console.error("[clinical-images] Error eliminando de R2:", err.message)
      );
    }

    await prisma.clinicalImage.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await logDeleteAudit(prisma, req.user.id, "ClinicalImage", existing.id, { image: existing });

    return res.json({ ok: true, message: "Imagen clínica eliminada correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar la imagen clínica." });
  }
});

module.exports = router;
