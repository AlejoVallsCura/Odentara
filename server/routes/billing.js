const express = require("express");

const prisma = require("../lib/prisma");
const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const {
  canViewBilling,
  canManageBilling,
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("../lib/permissions");

const router = express.Router();
const VALID_TYPES = new Set(["income", "debt", "payment", "adjustment"]);

function serializeEntry(entry) {
  return {
    id: entry.id,
    patientId: entry.patientId,
    professionalId: entry.professionalId,
    appointmentId: entry.appointmentId,
    createdByUserId: entry.createdByUserId,
    type: entry.type,
    amount: entry.amount,
    currency: entry.currency,
    description: entry.description,
    date: entry.date,
    patient: entry.patient ? { id: entry.patient.id, fullName: entry.patient.fullName, dni: entry.patient.dni } : null,
    professional: entry.professional ? { id: entry.professional.id, fullName: entry.professional.fullName } : null,
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
    if (!canViewBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver facturacion." });
    }

    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    const accessibleProfessionalIds = getAccessibleProfessionalIds(req.permissions);
    const entries = await prisma.billingEntry.findMany({
      where: {
        deletedAt: null,
        ...(patientId ? { patientId } : {}),
        patient: buildPatientAccessWhere(req.permissions),
        ...(canAccessWholeClinic(req.permissions)
          ? {}
          : { professionalId: { in: accessibleProfessionalIds.length ? accessibleProfessionalIds : [-1] } }),
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: {
        patient: { select: { id: true, fullName: true, dni: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });

    return res.json({ ok: true, entries: entries.map(serializeEntry) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo listar la facturacion." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (!canManageBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear movimientos." });
    }

    const patientId = Number(req.body.patientId);
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions) },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const type = VALID_TYPES.has(req.body.type) ? req.body.type : null;
    if (!type) {
      return res.status(400).json({ ok: false, error: "Tipo de movimiento invalido." });
    }

    const professionalId = req.body.professionalId ? Number(req.body.professionalId) : null;
    const appointmentId = req.body.appointmentId ? Number(req.body.appointmentId) : null;

    if (!professionalId) {
      return res.status(400).json({ ok: false, error: "Debes asignar un profesional al movimiento." });
    }

    if (!canUseProfessional(req.permissions, professionalId)) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al profesional indicado." });
    }

    if (!(await ensureAccessibleAppointment(req.permissions, appointmentId, patientId))) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al turno indicado." });
    }

    const created = await prisma.billingEntry.create({
      data: {
        patientId,
        professionalId,
        appointmentId,
        createdByUserId: req.user.id,
        type,
        amount: req.body.amount,
        currency: req.body.currency ? String(req.body.currency).trim().toUpperCase() : "ARS",
        description: req.body.description ? String(req.body.description).trim() : null,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        deletedAt: null,
      },
      include: {
        patient: { select: { id: true, fullName: true, dni: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });

    return res.status(201).json({ ok: true, entry: serializeEntry(created) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el movimiento." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    if (!canManageBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar movimientos." });
    }

    const existing = await prisma.billingEntry.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions),
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Movimiento no encontrado o sin acceso." });
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

    if (!professionalId) {
      return res.status(400).json({ ok: false, error: "Debes asignar un profesional al movimiento." });
    }

    if (!(await ensureAccessibleAppointment(req.permissions, appointmentId, existing.patientId))) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al turno indicado." });
    }

    const updated = await prisma.billingEntry.update({
      where: { id: existing.id },
      data: {
        professionalId,
        appointmentId,
        type: req.body.type && VALID_TYPES.has(req.body.type) ? req.body.type : existing.type,
        amount: req.body.amount !== undefined ? req.body.amount : existing.amount,
        currency: req.body.currency ? String(req.body.currency).trim().toUpperCase() : existing.currency,
        description: req.body.description !== undefined ? (req.body.description ? String(req.body.description).trim() : null) : existing.description,
        date: req.body.date ? new Date(req.body.date) : existing.date,
        deletedAt: null,
      },
      include: {
        patient: { select: { id: true, fullName: true, dni: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });

    return res.json({ ok: true, entry: serializeEntry(updated) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el movimiento." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!canManageBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar movimientos." });
    }

    const existing = await prisma.billingEntry.findFirst({
      where: {
        id: Number(req.params.id),
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions),
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Movimiento no encontrado o sin acceso." });
    }

    const beforeData = await prisma.billingEntry.findUnique({
      where: { id: existing.id },
      include: {
        patient: true,
        professional: true,
      },
    });

    await prisma.billingEntry.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await logDeleteAudit(prisma, req.user.id, "BillingEntry", existing.id, {
      entry: beforeData,
    });
    return res.json({ ok: true, message: "Movimiento eliminado correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar el movimiento." });
  }
});

module.exports = router;
