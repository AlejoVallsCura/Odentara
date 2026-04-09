const express = require("express");

const prisma = require("../lib/prisma");
const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { canEditClinicalData, canViewClinicalData } = require("../lib/permissions");

const router = express.Router();

function serializeImage(image) {
  return {
    id: image.id,
    patientId: image.patientId,
    uploadedByUserId: image.uploadedByUserId,
    imageUrl: image.imageUrl,
    description: image.description,
    takenAt: image.takenAt,
    createdAt: image.createdAt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    if (!canViewClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver imágenes clínicas." });
    }

    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    const images = await prisma.clinicalImage.findMany({
      where: {
        deletedAt: null,
        ...(patientId ? { patientId } : {}),
        patient: buildPatientAccessWhere(req.permissions),
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

    const patientId = Number(req.body.patientId);
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions) },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const items = Array.isArray(req.body.images) ? req.body.images : [req.body];
    const createdItems = [];

    for (const item of items) {
      if (!item?.imageUrl) continue;

      const created = await prisma.clinicalImage.create({
        data: {
          patientId,
          uploadedByUserId: req.user.id,
          imageUrl: String(item.imageUrl).trim(),
          description: item.description ? String(item.description).trim() : null,
          takenAt: item.takenAt ? new Date(item.takenAt) : null,
          deletedAt: null,
        },
      });

      createdItems.push(serializeImage(created));
    }

    return res.status(201).json({ ok: true, images: createdItems });
  } catch (_error) {
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
        patient: buildPatientAccessWhere(req.permissions),
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Imagen clínica no encontrada o sin acceso." });
    }

    const updated = await prisma.clinicalImage.update({
      where: { id: existing.id },
      data: {
        imageUrl: req.body.imageUrl ? String(req.body.imageUrl).trim() : existing.imageUrl,
        description: req.body.description !== undefined ? (req.body.description ? String(req.body.description).trim() : null) : existing.description,
        takenAt: req.body.takenAt !== undefined ? (req.body.takenAt ? new Date(req.body.takenAt) : null) : existing.takenAt,
        deletedAt: null,
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
        patient: buildPatientAccessWhere(req.permissions),
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Imagen clínica no encontrada o sin acceso." });
    }

    const beforeData = await prisma.clinicalImage.findUnique({
      where: { id: existing.id },
    });

    await prisma.clinicalImage.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await logDeleteAudit(prisma, req.user.id, "ClinicalImage", existing.id, {
      image: beforeData,
    });
    return res.json({ ok: true, message: "Imagen clínica eliminada correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar la imagen clínica." });
  }
});

module.exports = router;
