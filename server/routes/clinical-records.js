const express = require("express");

const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { canEditClinicalData, canViewClinicalData } = require("../lib/permissions");

const router = express.Router();

function getProfessionalId(permissions, overrideId) {
  // Superadmin puede ver/editar el registro de cualquier profesional
  if (permissions.isSuperadmin) {
    return overrideId ? Number(overrideId) : null;
  }
  // Professional solo puede acceder a su propio registro
  return permissions.assignedProfessionalId || null;
}

function serializeRecord(record) {
  return {
    id: record.id,
    patientId: record.patientId,
    professionalId: record.professionalId,
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
    const professionalId = getProfessionalId(req.permissions, req.query.professionalId);

    // Verificar acceso al paciente
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      select: { id: true, fullName: true, dni: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    // Buscar el registro clínico del profesional para este paciente
    const record = professionalId
      ? await prisma.clinicalRecord.findUnique({
          where: { patientId_professionalId: { patientId, professionalId } },
          include: { odontogramEntries: { orderBy: [{ toothNumber: "asc" }] } },
        })
      : null;

    return res.json({
      ok: true,
      patient: { id: patient.id, fullName: patient.fullName, dni: patient.dni },
      professionalId,
      record: record ? serializeRecord(record) : null,
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
    const professionalId = getProfessionalId(req.permissions, req.body.professionalId);

    if (!professionalId) {
      return res.status(400).json({ ok: false, error: "Se requiere un profesional para guardar la historia clínica." });
    }

    // Verificar acceso al paciente
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const rawEntries = Array.isArray(req.body.odontogramEntries) ? req.body.odontogramEntries : [];

    // Deduplicar entradas por (toothNumber, face) para evitar violaciones de constraint único
    const seen = new Set();
    const odontogramEntries = rawEntries
      .filter((e) => e?.toothNumber && e?.status)
      .filter((e) => {
        const key = `${e.toothNumber}|${e.face ?? "__null__"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((e) => ({
        toothNumber: String(e.toothNumber),
        face: e.face || null,
        status: e.status,
      }));

    // Usar transacción explícita en lugar de upsert para evitar problemas de
    // compatibilidad con Prisma + MariaDB en operaciones anidadas deleteMany/create
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.clinicalRecord.findUnique({
        where: { patientId_professionalId: { patientId, professionalId } },
        select: { id: true },
      });

      if (existing) {
        // Actualizar notas + reemplazar odontograma completo
        await tx.odontogramEntry.deleteMany({ where: { clinicalRecordId: existing.id } });

        return tx.clinicalRecord.update({
          where: { id: existing.id },
          data: {
            summaryNotes: req.body.summaryNotes ?? null,
            allergies: req.body.allergies ?? null,
            medicalNotes: req.body.medicalNotes ?? null,
            odontogramEntries: {
              create: odontogramEntries,
            },
          },
          include: { odontogramEntries: { orderBy: [{ toothNumber: "asc" }] } },
        });
      }

      // Crear nuevo registro clínico
      return tx.clinicalRecord.create({
        data: {
          patientId,
          professionalId,
          summaryNotes: req.body.summaryNotes ?? null,
          allergies: req.body.allergies ?? null,
          medicalNotes: req.body.medicalNotes ?? null,
          odontogramEntries: {
            create: odontogramEntries,
          },
        },
        include: { odontogramEntries: { orderBy: [{ toothNumber: "asc" }] } },
      });
    });

    return res.json({ ok: true, record: serializeRecord(record) });
  } catch (_error) {
    console.error("[clinical-records PUT] error:", _error?.message, "| code:", _error?.code, "| meta:", JSON.stringify(_error?.meta));
    return res.status(500).json({ ok: false, error: "No se pudo actualizar la historia clínica.", debug: _error?.code || _error?.message });
  }
});

module.exports = router;
