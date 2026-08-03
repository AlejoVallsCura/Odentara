const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { parseId } = require("../lib/parse-id");
const { canViewClinicalData, canEditClinicalData, canAccessWholeClinic, getAccessibleProfessionalIds } = require("../lib/permissions");
const {
  serializePrescription,
  getPrescriptionPayload,
  validatePrescriptionPayload,
  PRESCRIPTION_INCLUDE,
} = require("../services/prescription.service");

const router = express.Router();

// ── GET /?patientId= ──────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canViewClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver recetas." });
    }

    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    if (!patientId) {
      return res.status(400).json({ ok: false, error: "Falta el parámetro patientId." });
    }

    // Las recetas son de UN profesional (professionalId no admite null en el
    // modelo) — no debe verlas cualquier profesional de la clínica que
    // atienda al mismo paciente, solo el/los que tiene permitidos quien pide.
    const professionalScope = canAccessWholeClinic(req.permissions)
      ? (req.query.professionalId ? { professionalId: Number(req.query.professionalId) } : {})
      : { professionalId: { in: getAccessibleProfessionalIds(req.permissions) } };

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
router.post("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para emitir recetas." });
    }

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
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para anular recetas." });
    }

    const prescriptionId = parseId(req.params.id);
    if (!prescriptionId) return res.status(400).json({ ok: false, error: "ID de receta inválido." });

    const existing = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        deletedAt: null,
        // Un profesional no puede anular la receta de otro colega para el
        // mismo paciente — es de un solo profesional, no de la clínica.
        ...(canAccessWholeClinic(req.permissions)
          ? {}
          : { professionalId: { in: getAccessibleProfessionalIds(req.permissions) } }),
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
