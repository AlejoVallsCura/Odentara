// =============================================================================
// budget.service.js — Lógica de negocio de presupuestos de tratamiento
// Serialización, validación de ítems y cálculo de totales
// =============================================================================

"use strict";

// -----------------------------------------------------------------------------
// Ítems y totales
// -----------------------------------------------------------------------------

// Normaliza los ítems del presupuesto: descarta filas inválidas, castea números
function normalizeBudgetItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item) => ({
      description: item?.description ? String(item.description).trim().slice(0, 255) : "",
      quantity: Math.max(1, Math.round(Number(item?.quantity) || 1)),
      unitPrice: Math.max(0, Number(item?.unitPrice) || 0),
    }))
    .filter((item) => item.description && item.unitPrice >= 0);
}

// El total SIEMPRE se calcula server-side — nunca se confía en el total del cliente
function calculateBudgetTotal(items, discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const safeDiscount = Math.max(0, Number(discount) || 0);
  return Math.max(0, Math.round((subtotal - safeDiscount) * 100) / 100);
}

// -----------------------------------------------------------------------------
// Payload y validación
// -----------------------------------------------------------------------------

function getBudgetPayload(body = {}) {
  const items = normalizeBudgetItems(body.items);
  const discount = Math.max(0, Number(body.discount) || 0);
  return {
    patientId: Number(body.patientId) || null,
    professionalId: Number(body.professionalId) || null,
    title: body.title ? String(body.title).trim().slice(0, 191) : "",
    items,
    discount,
    total: calculateBudgetTotal(items, discount),
    currency: body.currency ? String(body.currency).trim().toUpperCase().slice(0, 3) : "ARS",
    notes: body.notes ? String(body.notes).trim().slice(0, 5000) : null,
  };
}

function validateBudgetPayload(payload) {
  const errors = [];
  if (!payload.patientId) errors.push("Falta el paciente.");
  if (!payload.professionalId) errors.push("Falta el profesional responsable.");
  if (!payload.title) errors.push("El presupuesto debe tener un título.");
  if (payload.items.length === 0) errors.push("El presupuesto debe incluir al menos un ítem con descripción y precio.");
  return errors;
}

// -----------------------------------------------------------------------------
// Serialización
// -----------------------------------------------------------------------------

function serializeBudget(budget) {
  let items = [];
  try {
    items = JSON.parse(budget.items || "[]");
  } catch (_err) {
    items = [];
  }
  return {
    id: budget.id,
    patientId: budget.patientId,
    professionalId: budget.professionalId,
    createdByUserId: budget.createdByUserId,
    billingEntryId: budget.billingEntryId,
    charged: Boolean(budget.billingEntryId),
    title: budget.title,
    items,
    discount: Number(budget.discount),
    total: Number(budget.total),
    currency: budget.currency,
    notes: budget.notes,
    issuedAt: budget.issuedAt,
    createdAt: budget.createdAt,
    patient: budget.patient
      ? {
          id: budget.patient.id,
          fullName: budget.patient.fullName,
          dni: budget.patient.dni,
          insuranceName: budget.patient.insuranceName,
          insurancePlan: budget.patient.insurancePlan,
        }
      : null,
    professional: budget.professional
      ? {
          id: budget.professional.id,
          fullName: budget.professional.fullName,
          specialty: budget.professional.specialty,
          licenseNumber: budget.professional.licenseNumber,
        }
      : null,
  };
}

// Selector estándar de includes para queries de budget
const BUDGET_INCLUDE = {
  patient: {
    select: { id: true, fullName: true, dni: true, insuranceName: true, insurancePlan: true },
  },
  professional: {
    select: { id: true, fullName: true, specialty: true, licenseNumber: true },
  },
};

module.exports = {
  normalizeBudgetItems,
  calculateBudgetTotal,
  getBudgetPayload,
  validateBudgetPayload,
  serializeBudget,
  BUDGET_INCLUDE,
};
