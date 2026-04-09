const express = require("express");

const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { canEditClinicalData, canViewClinicalData } = require("../lib/permissions");

const router = express.Router();

function serializeRecord(record) {
  return {
    id: record.id,
    patientId: record.patientId,
    summaryNotes: record.summaryNotes,
    allergies: record.allergies,
    medicalNotes: record.medicalNotes,
    updatedAt: record.updatedAt,
    odontogramEntries: (record.odontogramEntries || []).map((entry) => ({
      id: entry.id,
      toothNumber: entry.toothNumber,
      face: entry.face,
      status: entry.status,
      updatedAt: entry.updatedAt,
    })),
  };
}

router.get("/:patientId", requireAuth, async (req, res) => {
  try {
    if (!canViewClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver historia clínica." });
    }

    const patientId = Number(req.params.patientId);
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ...buildPatientAccessWhere(req.permissions),
      },
      include: {
        clinicalRecord: {
          include: {
            odontogramEntries: {
              orderBy: [{ toothNumber: "asc" }],
            },
          },
        },
      },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    return res.json({
      ok: true,
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        dni: patient.dni,
      },
      record: patient.clinicalRecord ? serializeRecord(patient.clinicalRecord) : null,
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo obtener la historia clínica." });
  }
});

router.put("/:patientId", requireAuth, async (req, res) => {
  try {
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar historia clínica." });
    }

    const patientId = Number(req.params.patientId);
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ...buildPatientAccessWhere(req.permissions),
      },
      include: {
        clinicalRecord: true,
      },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const odontogramEntries = Array.isArray(req.body.odontogramEntries) ? req.body.odontogramEntries : [];

    let record;
    if (patient.clinicalRecord) {
      record = await prisma.clinicalRecord.update({
        where: { patientId },
        data: {
          summaryNotes: req.body.summaryNotes ?? null,
          allergies: req.body.allergies ?? null,
          medicalNotes: req.body.medicalNotes ?? null,
          odontogramEntries: {
            deleteMany: {},
            create: odontogramEntries
              .filter((entry) => entry?.toothNumber && entry?.status)
              .map((entry) => ({
                toothNumber: String(entry.toothNumber),
                face: entry.face || null,
                status: entry.status,
              })),
          },
        },
        include: {
          odontogramEntries: { orderBy: [{ toothNumber: "asc" }] },
        },
      });
    } else {
      record = await prisma.clinicalRecord.create({
        data: {
          patientId,
          summaryNotes: req.body.summaryNotes ?? null,
          allergies: req.body.allergies ?? null,
          medicalNotes: req.body.medicalNotes ?? null,
          odontogramEntries: {
            create: odontogramEntries
              .filter((entry) => entry?.toothNumber && entry?.status)
              .map((entry) => ({
                toothNumber: String(entry.toothNumber),
                face: entry.face || null,
                status: entry.status,
              })),
          },
        },
        include: {
          odontogramEntries: { orderBy: [{ toothNumber: "asc" }] },
        },
      });
    }

    return res.json({
      ok: true,
      record: serializeRecord(record),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar la historia clínica." });
  }
});

module.exports = router;
