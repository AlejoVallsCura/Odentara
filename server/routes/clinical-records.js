const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/require-permission");
const { buildPatientAccessWhere, canUseProfessional } = require("../lib/access");
const { canEditClinicalData, canViewClinicalData } = require("../lib/permissions");
const {
  normalizarCaraDental,
  clavePosicionOdontograma,
} = require("../../shared/tooth-faces");

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
// compartida por toda la clínica. professionalId informa quién hizo la última
// edición, por eso debe respetar el mismo alcance que cualquier acto profesional.
function resolveEditorProfessionalId(permissions, overrideId) {
  if (overrideId !== undefined && overrideId !== null && overrideId !== "") return Number(overrideId);
  if (permissions.assignedProfessionalId) return permissions.assignedProfessionalId;
  const scoped = permissions.allowedProfessionalIds || [];
  return scoped.length === 1 ? scoped[0] : null;
}

const ESTADOS_DENTALES_VALIDOS = new Set([
  "healthy", "caries", "restored", "absent", "implant",
  "crown", "crown_implant", "endodontics", "orthodontics", "sealant",
]);

function normalizarEntradasOdontograma(rawEntries) {
  const entradas = [];
  const posiciones = new Set();

  for (const raw of rawEntries) {
    const toothNumber = String(raw?.toothNumber || "").trim().slice(0, 10);
    const face = normalizarCaraDental(raw?.face);

    if (!toothNumber || !ESTADOS_DENTALES_VALIDOS.has(raw?.status)) {
      return { error: "El odontograma contiene una pieza o estado inválido." };
    }
    if (face === undefined) {
      return { error: `La cara dental ${String(raw?.face)} no es válida.` };
    }

    const positionKey = clavePosicionOdontograma(toothNumber, face);
    if (posiciones.has(positionKey)) {
      return { error: `La posición ${positionKey} está repetida en el odontograma.` };
    }
    posiciones.add(positionKey);
    entradas.push({ toothNumber, face, positionKey, status: raw.status });
  }

  return { entradas };
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
    return res.status(500).json({
      ok: false,
      error: "No se pudo obtener la historia clínica.",
      ...(process.env.NODE_ENV !== "production" ? { debug: _error?.code || _error?.message } : {}),
    });
  }
});

router.put("/:patientId", requireAuth, puedeEditarHistoriaClinica, async (req, res) => {
  try {
    const prisma = req.prisma;
    const patientId = Number(req.params.patientId);
    const editorProfessionalId = resolveEditorProfessionalId(req.permissions, req.body.professionalId);

    if (editorProfessionalId !== null && !Number.isInteger(editorProfessionalId)) {
      return res.status(400).json({ ok: false, error: "ID de profesional editor inválido." });
    }
    if (!canUseProfessional(req.permissions, editorProfessionalId)) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al profesional editor indicado." });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    if (editorProfessionalId !== null) {
      const editor = await prisma.professional.findFirst({
        where: { id: editorProfessionalId, clinicId: req.user.clinicId, deletedAt: null },
        select: { id: true },
      });
      if (!editor) {
        return res.status(400).json({ ok: false, error: "El profesional editor no pertenece a esta clínica." });
      }
    }

    const reemplazaOdontograma = Object.hasOwn(req.body, "odontogramEntries");
    if (reemplazaOdontograma && !Array.isArray(req.body.odontogramEntries)) {
      return res.status(400).json({ ok: false, error: "odontogramEntries debe ser una lista." });
    }
    const normalizado = reemplazaOdontograma
      ? normalizarEntradasOdontograma(req.body.odontogramEntries)
      : { entradas: [] };
    if (normalizado.error) {
      return res.status(400).json({ ok: false, error: normalizado.error });
    }

    // Los campos ausentes conservan su valor. Un cliente que cambia solo una
    // nota no debe borrar alergias ni observaciones cargadas por otro flujo.
    const textData = { professionalId: editorProfessionalId };
    for (const campo of ["summaryNotes", "allergies", "medicalNotes"]) {
      if (Object.hasOwn(req.body, campo)) textData[campo] = req.body[campo] ?? null;
    }

    // positionKey elimina el NULL del índice único que motivó la separación
    // anterior. Así el snapshot completo puede reemplazarse dentro de la misma
    // transacción: si falla createMany, también se revierten notas y deleteMany.
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.clinicalRecord.upsert({
        where: { patientId },
        create: { patientId, ...textData },
        update: textData,
        select: { id: true },
      });

      if (reemplazaOdontograma) {
        await tx.odontogramEntry.deleteMany({ where: { clinicalRecordId: existing.id } });
        if (normalizado.entradas.length > 0) {
          await tx.odontogramEntry.createMany({
            data: normalizado.entradas.map((entry) => ({ ...entry, clinicalRecordId: existing.id })),
          });
        }
      }

      return tx.clinicalRecord.findUnique({
        where: { patientId },
        include: { odontogramEntries: { orderBy: [{ toothNumber: "asc" }] } },
      });
    });

    return res.json({ ok: true, record: record ? serializeRecord(record) : null });
  } catch (_error) {
    console.error("[clinical-records PUT] error:", _error?.message, "| code:", _error?.code, "| meta:", JSON.stringify(_error?.meta));
    return res.status(500).json({
      ok: false,
      error: "No se pudo actualizar la historia clínica.",
      ...(process.env.NODE_ENV !== "production" ? { debug: _error?.code || _error?.message } : {}),
    });
  }
});

module.exports = router;
