const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requirePermission, requireAnyPermission } = require("../middleware/require-permission");
const {
  buildPatientAccessWhere,
  buildOwnedRecordWhere,
  canUseProfessional,
} = require("../lib/access");
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

const puedeCargarMovimientosEnCuentaCorriente = requirePermission(
  canManageBilling,
  "No tenes permisos para cargar movimientos en cuenta corriente.",
);

const puedeCrearPresupuestos = requirePermission(
  canEditClinicalData,
  "No tenes permisos para crear presupuestos.",
);

const puedeEliminarPresupuestos = requirePermission(
  canEditClinicalData,
  "No tenes permisos para eliminar presupuestos.",
);

// Un presupuesto lo mira tanto quien maneja la parte clínica (lo armó) como
// quien maneja la facturación (lo cobra): alcanza con cualquiera de los dos.
const puedeVerPresupuestos = requireAnyPermission(
  [canViewClinicalData, canManageBilling],
  "No tenes permisos para ver presupuestos.",
);

// ── GET /?patientId= ──────────────────────────────────────────────────────────
router.get("/", requireAuth, puedeVerPresupuestos, async (req, res) => {
  try {
    const prisma = req.prisma;
    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    if (!patientId) {
      return res.status(400).json({ ok: false, error: "Falta el parámetro patientId." });
    }

    // Los presupuestos son de UN profesional — un profesional no debe ver los
    // presupuestos de otro colega para el mismo paciente. Un admin con un
    // profesional asignado queda igual de restringido que cualquier otro rol
    // scopeado (canAccessWholeClinic ya contempla esto); solo ve todo si no
    // tiene ningún profesional asignado.
    const professionalScope = buildOwnedRecordWhere(req.permissions, {
      filterProfessionalId: req.query.professionalId,
    });

    const budgets = await prisma.budget.findMany({
      where: {
        patientId,
        deletedAt: null,
        ...professionalScope,
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
router.post("/", requireAuth, puedeCrearPresupuestos, async (req, res) => {
  try {
    const prisma = req.prisma;
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

    // El permiso clínico habilita la acción, pero no permite atribuirla a un
    // colega fuera del alcance profesional asignado al usuario.
    if (!canUseProfessional(req.permissions, payload.professionalId)) {
      return res.status(403).json({ ok: false, error: "No tenes acceso al profesional indicado." });
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
router.post("/:id/charge", requireAuth, puedeCargarMovimientosEnCuentaCorriente, async (req, res) => {
  try {
    const prisma = req.prisma;
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
router.delete("/:id", requireAuth, puedeEliminarPresupuestos, async (req, res) => {
  try {
    const prisma = req.prisma;
    const budgetId = parseId(req.params.id);
    if (!budgetId) return res.status(400).json({ ok: false, error: "ID de presupuesto inválido." });

    const existing = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        deletedAt: null,
        // Un profesional no puede eliminar el presupuesto de otro colega para
        // el mismo paciente — es de un solo profesional, no de la clínica.
        ...buildOwnedRecordWhere(req.permissions),
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

    return res.json({ ok: true, message: "Presupuesto eliminado correctamente." });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: "No se pudo eliminar el presupuesto." });
  }
});

module.exports = router;
