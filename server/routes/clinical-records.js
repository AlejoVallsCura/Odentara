const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/require-permission");
const { buildPatientAccessWhere } = require("../lib/access");
const { canEditClinicalData, canViewClinicalData } = require("../lib/permissions");

const router = express.Router();

const puedeEditarHistoriaClinica = requirePermission(
  canEditClinicalData,
  "No tenes permisos para editar historia clínica.",
);

const puedeVerHistoriaClinica = requirePermission(
  canViewClinicalData,
  "No tenes permisos para ver historia clínica.",
);

// La ficha clínica (odontograma, notas, alergias) es UNA sola por paciente,
// compartida por toda la clínica — no hay un registro distinto por
// profesional. professionalId queda solo como dato informativo de quién
// hizo la última edición.
function resolveEditorProfessionalId(permissions, overrideId) {
  if (overrideId) return Number(overrideId);
  if (permissions.assignedProfessionalId) return permissions.assignedProfessionalId;
  const scoped = permissions.allowedProfessionalIds || [];
  return scoped.length === 1 ? scoped[0] : null;
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

router.get("/:patientId", requireAuth, puedeVerHistoriaClinica, async (req, res) => {
  try {
    const prisma = req.prisma;
    const patientId = Number(req.params.patientId);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      select: { id: true, fullName: true, dni: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const record = await prisma.clinicalRecord.findUnique({
      where: { patientId },
      include: { odontogramEntries: { orderBy: [{ toothNumber: "asc" }] } },
    });

    return res.json({
      ok: true,
      patient: { id: patient.id, fullName: patient.fullName, dni: patient.dni },
      record: record ? serializeRecord(record) : null,
    });
  } catch (_error) {
    console.error("[clinical-records GET] error:", _error?.message, "| code:", _error?.code);
    return res.status(500).json({ ok: false, error: "No se pudo obtener la historia clínica.", ...(process.env.NODE_ENV !== 'production' ? { debug: _error?.code || _error?.message } : {}) });
  }
});

router.put("/:patientId", requireAuth, puedeEditarHistoriaClinica, async (req, res) => {
  try {
    const prisma = req.prisma;
    const patientId = Number(req.params.patientId);
    const editorProfessionalId = resolveEditorProfessionalId(req.permissions, req.body.professionalId);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const rawEntries = Array.isArray(req.body.odontogramEntries) ? req.body.odontogramEntries : [];

    // Whitelist de valores válidos — previene XSS stored si el front renderiza sin escapar
    const VALID_TOOTH_STATUS = new Set([
      "healthy", "caries", "restored", "absent", "implant",
      "crown", "crown_implant", "endodontics", "orthodontics", "sealant",
    ]);
    const VALID_TOOTH_FACES = new Set(["V", "L", "M", "D", "O", "I", null, undefined, ""]);

    // Deduplicar entradas por (toothNumber, face) para evitar violaciones de constraint único
    const seen = new Set();
    const odontogramEntries = rawEntries
      .filter((e) => e?.toothNumber && VALID_TOOTH_STATUS.has(e?.status))
      .filter((e) => {
        const key = `${e.toothNumber}|${e.face ?? "__null__"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((e) => ({
        toothNumber: String(e.toothNumber).slice(0, 10),
        face: VALID_TOOTH_FACES.has(e.face) ? (e.face || null) : null,
        status: e.status,
      }));

    // Operaciones separadas (sin transacción anidada) para evitar problemas de
    // InnoDB/MariaDB con DELETE+INSERT en la misma TX sobre índices únicos con NULL.
    const textData = {
      summaryNotes: req.body.summaryNotes ?? null,
      allergies:    req.body.allergies    ?? null,
      medicalNotes: req.body.medicalNotes ?? null,
      professionalId: editorProfessionalId,
    };

    let existing = await prisma.clinicalRecord.findUnique({
      where: { patientId },
      select: { id: true },
    });

    if (!existing) {
      try {
        existing = await prisma.clinicalRecord.create({
          data: { patientId, ...textData },
          select: { id: true },
        });
      } catch (createErr) {
        if (createErr?.code === "P2002") {
          // Carrera: otra request creó el registro justo antes — lo buscamos de nuevo
          console.warn("[clinical-records PUT] P2002 al crear. meta:", JSON.stringify(createErr?.meta), "patientId:", patientId);
          existing = await prisma.clinicalRecord.findUnique({
            where: { patientId },
            select: { id: true },
          });
        } else {
          throw createErr;
        }
      }
    } else {
      await prisma.clinicalRecord.update({
        where: { id: existing.id },
        data: textData,
      });
    }

    if (!existing?.id) {
      console.error("[clinical-records PUT] existing es null después de create/update. patientId:", patientId);
      return res.status(500).json({ ok: false, error: "No se pudo resolver el registro clínico. Intentá de nuevo." });
    }

    // Reemplazar entradas de odontograma: borrar y recrear por separado
    await prisma.odontogramEntry.deleteMany({ where: { clinicalRecordId: existing.id } });

    if (odontogramEntries.length > 0) {
      await prisma.odontogramEntry.createMany({
        data: odontogramEntries.map((e) => ({ ...e, clinicalRecordId: existing.id })),
        skipDuplicates: true,
      });
    }

    const record = await prisma.clinicalRecord.findFirst({
      where: { id: existing.id },
      include: { odontogramEntries: { orderBy: [{ toothNumber: "asc" }] } },
    });

    return res.json({ ok: true, record: record ? serializeRecord(record) : null });
  } catch (_error) {
    console.error("[clinical-records PUT] error:", _error?.message, "| code:", _error?.code, "| meta:", JSON.stringify(_error?.meta));
    return res.status(500).json({ ok: false, error: "No se pudo actualizar la historia clínica.", ...(process.env.NODE_ENV !== 'production' ? { debug: _error?.code || _error?.message } : {}) });
  }
});

module.exports = router;
