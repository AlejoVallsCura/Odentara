const express = require("express");

const prisma = require("../lib/prisma");
const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const {
  canEditClinicalData,
  canViewClinicalData,
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("../lib/permissions");

const router = express.Router();

function serializeTreatment(t) {
  return {
    id: t.id,
    patientId: t.patientId,
    professionalId: t.professionalId,
    appointmentId: t.appointmentId,
    createdByUserId: t.createdByUserId,
    tooth: t.tooth,
    face: t.face,
    sector: t.sector,
    authorizationNumber: t.authorizationNumber,
    insuranceCode: t.insuranceCode,
    observations: t.observations,
    performedAt: t.performedAt,
    patient: t.patient ? { id: t.patient.id, fullName: t.patient.fullName, dni: t.patient.dni } : null,
    professional: t.professional ? { id: t.professional.id, fullName: t.professional.fullName } : null,
  };
}

function canUseProfessional(permissions, professionalId) {
  if (!professionalId) return true;
  if (canAccessWholeClinic(permissions)) return true;
  return getAccessibleProfessionalIds(permissions).includes(Number(professionalId));
}

async function ensureAccessibleAppointment(permissions, appointmentId, patientId) {
  if (!appointmentId) return true;

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: Number(appointmentId),
      patientId,
      ...(canAccessWholeClinic(permissions)
        ? {}
        : { professionalId: { in: getAccessibleProfessionalIds(permissions) } }),
    },
    select: { id: true },
  });

  return Boolean(appointment);
}

router.get("/", requireAuth, async (req, res) => {
  try {
    if (!canViewClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver tratamientos." });
    }

    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    const treatments = await prisma.treatment.findMany({
      where: {
        deletedAt: null,
        ...(patientId ? { patientId } : {}),
        patient: buildPatientAccessWhere(req.permissions),
      },
      orderBy: [{ performedAt: "desc" }, { id: "desc" }],
      include: {
        patient: { select: { id: true, fullName: true, dni: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });

    return res.json({ ok: true, treatments: treatments.map(serializeTreatment) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los tratamientos." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear tratamientos." });
    }

    const patientId = Number(req.body.patientId);
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions) },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const professionalId = req.body.professionalId ? Number(req.body.professionalId) : null;
    const appointmentId = req.body.appointmentId ? Number(req.body.appointmentId) : null;

    if (!canUseProfessional(req.permissions, professionalId)) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al profesional indicado." });
    }

    if (!(await ensureAccessibleAppointment(req.permissions, appointmentId, patientId))) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al turno indicado." });
    }

    const created = await prisma.treatment.create({
      data: {
        patientId,
        professionalId,
        appointmentId,
        createdByUserId: req.user.id,
        tooth: req.body.tooth ? String(req.body.tooth).trim() : null,
        face: req.body.face ? String(req.body.face).trim() : null,
        sector: req.body.sector ? String(req.body.sector).trim() : null,
        authorizationNumber: req.body.authorizationNumber ? String(req.body.authorizationNumber).trim() : null,
        insuranceCode: req.body.insuranceCode ? String(req.body.insuranceCode).trim() : null,
        observations: req.body.observations ? String(req.body.observations).trim() : null,
        performedAt: req.body.performedAt ? new Date(req.body.performedAt) : new Date(),
        deletedAt: null,
      },
      include: {
        patient: { select: { id: true, fullName: true, dni: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });

    return res.status(201).json({ ok: true, treatment: serializeTreatment(created) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el tratamiento." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar tratamientos." });
    }

    const existing = await prisma.treatment.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions),
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Tratamiento no encontrado o sin acceso." });
    }

    const professionalId =
      req.body.professionalId !== undefined
        ? req.body.professionalId
          ? Number(req.body.professionalId)
          : null
        : existing.professionalId;

    const appointmentId =
      req.body.appointmentId !== undefined
        ? req.body.appointmentId
          ? Number(req.body.appointmentId)
          : null
        : existing.appointmentId;

    if (!canUseProfessional(req.permissions, professionalId)) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al profesional indicado." });
    }

    if (!(await ensureAccessibleAppointment(req.permissions, appointmentId, existing.patientId))) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al turno indicado." });
    }

    const updated = await prisma.treatment.update({
      where: { id: existing.id },
      data: {
        professionalId,
        appointmentId,
        tooth: req.body.tooth !== undefined ? (req.body.tooth ? String(req.body.tooth).trim() : null) : existing.tooth,
        face: req.body.face !== undefined ? (req.body.face ? String(req.body.face).trim() : null) : existing.face,
        sector: req.body.sector !== undefined ? (req.body.sector ? String(req.body.sector).trim() : null) : existing.sector,
        authorizationNumber: req.body.authorizationNumber !== undefined ? (req.body.authorizationNumber ? String(req.body.authorizationNumber).trim() : null) : existing.authorizationNumber,
        insuranceCode: req.body.insuranceCode !== undefined ? (req.body.insuranceCode ? String(req.body.insuranceCode).trim() : null) : existing.insuranceCode,
        observations: req.body.observations !== undefined ? (req.body.observations ? String(req.body.observations).trim() : null) : existing.observations,
        performedAt: req.body.performedAt ? new Date(req.body.performedAt) : existing.performedAt,
        deletedAt: null,
      },
      include: {
        patient: { select: { id: true, fullName: true, dni: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });

    return res.json({ ok: true, treatment: serializeTreatment(updated) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el tratamiento." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar tratamientos." });
    }

    const existing = await prisma.treatment.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions),
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Tratamiento no encontrado o sin acceso." });
    }

    const beforeData = await prisma.treatment.findUnique({
      where: { id: existing.id },
      include: {
        patient: true,
        professional: true,
      },
    });

    await prisma.treatment.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await logDeleteAudit(prisma, req.user.id, "Treatment", existing.id, {
      treatment: beforeData,
    });
    return res.json({ ok: true, message: "Tratamiento eliminado correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar el tratamiento." });
  }
});

module.exports = router;
