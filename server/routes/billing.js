const express = require("express");

const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { parseId } = require("../lib/parse-id");
const {
  canViewBilling,
  canManageBilling,
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("../lib/permissions");
const { checkBillingFeature } = require("../lib/plan-limits");
const {
  VALID_TYPES,
  parseDateOnlyInput,
  serializeEntry,
  canUseProfessional,
  ensureAccessibleAppointment,
} = require("../services/billing.service");

const router = express.Router();

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canViewBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver facturacion." });
    }

    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    const accessibleProfessionalIds = getAccessibleProfessionalIds(req.permissions);

    const entries = await prisma.billingEntry.findMany({
      where: {
        deletedAt: null,
        ...(patientId ? { patientId } : {}),
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
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

// ── POST / ────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManageBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear movimientos." });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId }, select: { plan: true } });
    const planCheck = checkBillingFeature(clinic?.plan);
    if (!planCheck.allowed) {
      return res.status(403).json({ ok: false, error: planCheck.error, code: "PLAN_LIMIT" });
    }

    const patientId = Number(req.body.patientId);
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const type = VALID_TYPES.has(req.body.type) ? req.body.type : null;
    if (!type) return res.status(400).json({ ok: false, error: "Tipo de movimiento invalido." });

    const professionalId = req.body.professionalId ? Number(req.body.professionalId) : null;
    const appointmentId  = req.body.appointmentId  ? Number(req.body.appointmentId)  : null;

    if (!professionalId) {
      return res.status(400).json({ ok: false, error: "Debes asignar un profesional al movimiento." });
    }
    if (!canUseProfessional(req.permissions, professionalId)) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al profesional indicado." });
    }
    if (!(await ensureAccessibleAppointment(prisma, req.permissions, appointmentId, patientId))) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al turno indicado." });
    }

    const parsedAmount = parseFloat(req.body.amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ ok: false, error: "El monto debe ser un número válido no negativo." });
    }

    const created = await prisma.billingEntry.create({
      data: {
        patientId,
        professionalId,
        appointmentId,
        createdByUserId: req.user.id,
        type,
        amount: parsedAmount,
        currency: req.body.currency ? String(req.body.currency).trim().toUpperCase() : "ARS",
        description: req.body.description ? String(req.body.description).trim() : null,
        date: parseDateOnlyInput(req.body.date),
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

// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManageBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar movimientos." });
    }

    const entryId = parseId(req.params.id);
    if (!entryId) return res.status(400).json({ ok: false, error: "ID de movimiento inválido." });

    const existing = await prisma.billingEntry.findFirst({
      where: {
        id: entryId,
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Movimiento no encontrado o sin acceso." });
    }

    const professionalId =
      req.body.professionalId !== undefined
        ? (req.body.professionalId ? Number(req.body.professionalId) : null)
        : existing.professionalId;
    const appointmentId =
      req.body.appointmentId !== undefined
        ? (req.body.appointmentId ? Number(req.body.appointmentId) : null)
        : existing.appointmentId;

    if (!canUseProfessional(req.permissions, professionalId)) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al profesional indicado." });
    }
    if (!professionalId) {
      return res.status(400).json({ ok: false, error: "Debes asignar un profesional al movimiento." });
    }
    if (!(await ensureAccessibleAppointment(prisma, req.permissions, appointmentId, existing.patientId))) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al turno indicado." });
    }

    let updatedAmount = existing.amount;
    if (req.body.amount !== undefined) {
      const parsedAmount = parseFloat(req.body.amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ ok: false, error: "El monto debe ser un número válido no negativo." });
      }
      updatedAmount = parsedAmount;
    }

    const updated = await prisma.billingEntry.update({
      where: { id: existing.id },
      data: {
        professionalId,
        appointmentId,
        type: req.body.type && VALID_TYPES.has(req.body.type) ? req.body.type : existing.type,
        amount: updatedAmount,
        currency: req.body.currency ? String(req.body.currency).trim().toUpperCase() : existing.currency,
        description:
          req.body.description !== undefined
            ? (req.body.description ? String(req.body.description).trim() : null)
            : existing.description,
        date: req.body.date ? parseDateOnlyInput(req.body.date) : existing.date,
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

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManageBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar movimientos." });
    }

    const deleteId = parseId(req.params.id);
    if (!deleteId) return res.status(400).json({ ok: false, error: "ID de movimiento inválido." });

    const existing = await prisma.billingEntry.findFirst({
      where: {
        id: deleteId,
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Movimiento no encontrado o sin acceso." });
    }

    const beforeData = await prisma.billingEntry.findUnique({
      where: { id: existing.id },
      include: { patient: true, professional: true },
    });

    await prisma.billingEntry.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await logDeleteAudit(prisma, req.user.id, "BillingEntry", existing.id, { entry: beforeData });

    return res.json({ ok: true, message: "Movimiento eliminado correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar el movimiento." });
  }
});

module.exports = router;
