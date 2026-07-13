const express = require("express");

const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { parseId } = require("../lib/parse-id");
const {
  canViewClinicalData,
  canEditClinicalData,
  canManageBilling,
} = require("../lib/permissions");
const { checkBillingFeature } = require("../lib/plan-limits");
const {
  getBudgetPayload,
  validateBudgetPayload,
  serializeBudget,
  BUDGET_INCLUDE,
} = require("../services/budget.service");

const router = express.Router();

// ── GET /?patientId= ──────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canViewClinicalData(req.permissions) && !canManageBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver presupuestos." });
    }

    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    if (!patientId) {
      return res.status(400).json({ ok: false, error: "Falta el parámetro patientId." });
    }

    const budgets = await prisma.budget.findMany({
      where: {
        patientId,
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      include: BUDGET_INCLUDE,
    });

    return res.json({ ok: true, budgets: budgets.map(serializeBudget) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los presupuestos." });
  }
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear presupuestos." });
    }

    const payload = getBudgetPayload(req.body);
    const errors = validateBudgetPayload(payload);
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
      select: { id: true },
    });
    if (!professional) {
      return res.status(404).json({ ok: false, error: "Profesional no encontrado." });
    }

    const created = await prisma.budget.create({
      data: {
        patientId: payload.patientId,
        professionalId: payload.professionalId,
        createdByUserId: req.user.id,
        title: payload.title,
        items: JSON.stringify(payload.items),
        discount: payload.discount,
        total: payload.total,
        currency: payload.currency,
        notes: payload.notes,
        deletedAt: null,
      },
      include: BUDGET_INCLUDE,
    });

    return res.status(201).json({ ok: true, budget: serializeBudget(created) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el presupuesto." });
  }
});

// ── POST /:id/charge — cargar el presupuesto como deuda en cuenta corriente ──
router.post("/:id/charge", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManageBilling(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para cargar movimientos en cuenta corriente." });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId }, select: { plan: true } });
    const planCheck = checkBillingFeature(clinic?.plan);
    if (!planCheck.allowed) {
      return res.status(403).json({ ok: false, error: planCheck.error, code: "PLAN_LIMIT" });
    }

    const budgetId = parseId(req.params.id);
    if (!budgetId) return res.status(400).json({ ok: false, error: "ID de presupuesto inválido." });

    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      include: BUDGET_INCLUDE,
    });
    if (!budget) {
      return res.status(404).json({ ok: false, error: "Presupuesto no encontrado o sin acceso." });
    }
    if (budget.billingEntryId) {
      return res.status(409).json({ ok: false, error: "Este presupuesto ya fue cargado como deuda." });
    }

    // Transacción: crear la deuda y vincularla al presupuesto de forma atómica
    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.billingEntry.create({
        data: {
          patientId: budget.patientId,
          professionalId: budget.professionalId,
          createdByUserId: req.user.id,
          type: "debt",
          amount: budget.total,
          currency: budget.currency,
          description: `Presupuesto: ${budget.title}`,
          date: new Date(),
          deletedAt: null,
        },
      });
      return tx.budget.update({
        where: { id: budget.id },
        data: { billingEntryId: entry.id },
        include: BUDGET_INCLUDE,
      });
    });

    return res.json({ ok: true, budget: serializeBudget(updated) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo cargar el presupuesto como deuda." });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditClinicalData(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar presupuestos." });
    }

    const budgetId = parseId(req.params.id);
    if (!budgetId) return res.status(400).json({ ok: false, error: "ID de presupuesto inválido." });

    const existing = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        deletedAt: null,
        patient: buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      include: BUDGET_INCLUDE,
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Presupuesto no encontrado o sin acceso." });
    }
    if (existing.billingEntryId) {
      return res.status(409).json({
        ok: false,
        error: "No se puede eliminar: el presupuesto ya fue cargado como deuda. Anulá primero el movimiento en cuenta corriente.",
      });
    }

    await prisma.budget.update({
      where: { id: budgetId },
      data: { deletedAt: new Date() },
    });

    await logDeleteAudit(prisma, req.user.id, "Budget", budgetId, { budget: existing });

    return res.json({ ok: true, message: "Presupuesto eliminado correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar el presupuesto." });
  }
});

module.exports = router;
