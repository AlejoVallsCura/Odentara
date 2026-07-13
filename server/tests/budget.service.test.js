// Tests de budget.service — correr con: npm test
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeBudgetItems,
  calculateBudgetTotal,
  getBudgetPayload,
  validateBudgetPayload,
  serializeBudget,
} = require("../services/budget.service");

// ── normalizeBudgetItems ──────────────────────────────────────────────────────

test("normalizeBudgetItems descarta filas sin descripción", () => {
  const items = normalizeBudgetItems([
    { description: "Implante", quantity: 1, unitPrice: 500000 },
    { description: "", quantity: 2, unitPrice: 100 },
    null,
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].description, "Implante");
});

test("normalizeBudgetItems fuerza cantidad mínima 1 y precio no negativo", () => {
  const [item] = normalizeBudgetItems([{ description: "Limpieza", quantity: -3, unitPrice: -50 }]);
  assert.equal(item.quantity, 1);
  assert.equal(item.unitPrice, 0);
});

test("normalizeBudgetItems castea strings numéricos", () => {
  const [item] = normalizeBudgetItems([{ description: "Corona", quantity: "2", unitPrice: "150000.50" }]);
  assert.equal(item.quantity, 2);
  assert.equal(item.unitPrice, 150000.5);
});

// ── calculateBudgetTotal ──────────────────────────────────────────────────────

test("calculateBudgetTotal suma cantidad por precio", () => {
  const items = [
    { description: "a", quantity: 2, unitPrice: 100 },
    { description: "b", quantity: 1, unitPrice: 50 },
  ];
  assert.equal(calculateBudgetTotal(items), 250);
});

test("calculateBudgetTotal aplica descuento y no baja de cero", () => {
  const items = [{ description: "a", quantity: 1, unitPrice: 100 }];
  assert.equal(calculateBudgetTotal(items, 30), 70);
  assert.equal(calculateBudgetTotal(items, 500), 0);
  assert.equal(calculateBudgetTotal(items, -50), 100); // descuento negativo se ignora
});

test("calculateBudgetTotal redondea a 2 decimales", () => {
  const items = [{ description: "a", quantity: 3, unitPrice: 33.333 }];
  assert.equal(calculateBudgetTotal(items), 100.0);
});

// ── getBudgetPayload / validación ─────────────────────────────────────────────

test("getBudgetPayload calcula el total server-side ignorando el total del cliente", () => {
  const payload = getBudgetPayload({
    patientId: 1,
    professionalId: 2,
    title: "Plan",
    items: [{ description: "x", quantity: 2, unitPrice: 100 }],
    total: 999999, // el cliente no puede fijar el total
  });
  assert.equal(payload.total, 200);
});

test("validateBudgetPayload exige paciente, profesional, título e ítems", () => {
  const errors = validateBudgetPayload(getBudgetPayload({}));
  assert.equal(errors.length, 4);
  const ok = validateBudgetPayload(getBudgetPayload({
    patientId: 1, professionalId: 2, title: "Plan",
    items: [{ description: "x", unitPrice: 10 }],
  }));
  assert.equal(ok.length, 0);
});

// ── serializeBudget ───────────────────────────────────────────────────────────

test("serializeBudget expone charged según billingEntryId", () => {
  const base = { id: 1, title: "t", items: "[]", discount: 0, total: 100 };
  assert.equal(serializeBudget({ ...base, billingEntryId: null }).charged, false);
  assert.equal(serializeBudget({ ...base, billingEntryId: 55 }).charged, true);
});

test("serializeBudget tolera items con JSON inválido", () => {
  const out = serializeBudget({ id: 1, title: "t", items: "{corrupto", discount: 0, total: 0 });
  assert.deepEqual(out.items, []);
});
