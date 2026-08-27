const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/require-permission");
const { buildPatientAccessWhere, buildOwnedRecordWhere, canUseProfessional } = require("../lib/access");
const { parseId } = require("../lib/parse-id");
const { canViewClinicalData, canEditClinicalData } = require("../lib/permissions");
const {
  serializePrescription,
  getPrescriptionPayload,
  validatePrescriptionPayload,
  PRESCRIPTION_INCLUDE,
} = require("../services/prescription.service");

const router = express.Router();

const puedeAnularRecetas = requirePermission(
  canEditClinicalData,
  "No tenes permisos para anular recetas.",
);

const puedeEmitirRecetas = requirePermission(
  canEditClinicalData,
  "No tenes permisos para emitir recetas.",
);

const puedeVerRecetas = requirePermission(
  canViewClinicalData,
  "No tenes permisos para ver recetas.",
);

// ── GET /?patientId= ──────────────────────────────────────────────────────────
router.get("/", requireAuth, puedeVerRecetas, async (req, res) => {
  try {
    const prisma = req.prisma;
    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    if (!patientId) {
      return res.status(400).json({ ok: false, error: "Falta el parámetro patientId." });
    }

    // Las recetas son de UN profesional (professionalId no admite null en el
    // modelo) — no debe verlas cualquier profesional de la clínica que
    // atienda al mismo paciente, solo el/los que tiene permitidos quien pide.
    const professionalScope = buildOwnedRecordWhere(req.permissions, {
      filterProfessionalId: req.query.professionalId,
    });

    const prescriptions = await prisma.prescription.findMany({
      where: {
        patientId,
        deletedAt: null,
        ...professionalScope,
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      include: PRESCRIPTION_INCLUDE,
    });

    return res.json({ ok: true, prescriptions: prescriptions.map(serializePrescription) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar las recetas." });
  }
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, puedeEmitirRecetas, async (req, res) => {
  try {
    const prisma = req.prisma;
    const payload = getPrescriptionPayload(req.body);
    const errors = validatePrescriptionPayload(payload);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, error: errors[0], errors });
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: payload.patientId,
        ...buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    // La consulta de abajo comprueba que el profesional sea de esta clínica,
    // pero no que este usuario pueda actuar en su nombre. Sin esto, un
    // odontólogo con alcance restringido podía emitir una receta a nombre de un
    // colega de la misma clínica —y como la matrícula se toma del profesional
    // elegido, el documento salía firmado con la matrícula del otro.
    if (!canUseProfessional(req.permissions, payload.professionalId)) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al profesional indicado." });
    }

    const professional = await prisma.professional.findFirst({
      where: { id: payload.professionalId, clinicId: req.user.clinicId, deletedAt: null },
      select: { id: true, licenseNumber: true },
    });
    if (!professional) {
      return res.status(404).json({ ok: false, error: "Profesional no encontrado." });
    }
    if (!professional.licenseNumber) {
      return res.status(400).json({
        ok: false,
        error: "El profesional no tiene matrícula cargada. Configurala en Configuración → Profesionales.",
        code: "MISSING_LICENSE",
      });
    }

    const created = await prisma.prescription.create({
      data: {
        patientId: payload.patientId,
        professionalId: payload.professionalId,
        createdByUserId: req.user.id,
        diagnosis: payload.diagnosis,
        medications: payload.medications,
        instructions: payload.instructions,
        deletedAt: null,
      },
      include: PRESCRIPTION_INCLUDE,
    });

    return res.status(201).json({ ok: true, prescription: serializePrescription(created) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear la receta." });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, puedeAnularRecetas, async (req, res) => {
  try {
    const prisma = req.prisma;
    const prescriptionId = parseId(req.params.id);
    if (!prescriptionId) return res.status(400).json({ ok: false, error: "ID de receta inválido." });

    const existing = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        deletedAt: null,
        // Un profesional no puede anular la receta de otro colega para el
        // mismo paciente — es de un solo profesional, no de la clínica.
        ...buildOwnedRecordWhere(req.permissions),
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      include: PRESCRIPTION_INCLUDE,
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Receta no encontrada o sin acceso." });
    }

    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: { deletedAt: new Date() },
    });

    return res.json({ ok: true, message: "Receta anulada correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo anular la receta." });
  }
});

module.exports = router;
