// Tests de billing.service — correr con: npm test
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  VALID_TYPES,
  formatDateOnly,
  parseDateOnlyInput,
} = require("../services/billing.service");

// ── Fechas UTC (contabilidad no depende de timezone) ──────────────────────────

test("parseDateOnlyInput ancla YYYY-MM-DD a mediodía UTC", () => {
  const d = parseDateOnlyInput("2026-07-03");
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 6);
  assert.equal(d.getUTCDate(), 3);
  assert.equal(d.getUTCHours(), 12); // mediodía UTC evita corrimiento de día en cualquier TZ
});

test("formatDateOnly es inversa de parseDateOnlyInput", () => {
  for (const iso of ["2026-01-01", "2026-12-31", "2024-02-29"]) {
    assert.equal(formatDateOnly(parseDateOnlyInput(iso)), iso);
  }
});

test("formatDateOnly devuelve null con entrada inválida", () => {
  assert.equal(formatDateOnly(null), null);
  assert.equal(formatDateOnly("no-es-fecha"), null);
});

test("parseDateOnlyInput con valor inválido devuelve fecha actual (no crashea)", () => {
  const d = parseDateOnlyInput("garbage");
  assert.ok(d instanceof Date);
  assert.equal(isNaN(d.getTime()), false);
});

// ── Tipos de movimiento ───────────────────────────────────────────────────────

test("VALID_TYPES contiene los 4 tipos contables", () => {
  for (const t of ["income", "debt", "payment", "adjustment"]) {
    assert.ok(VALID_TYPES.has(t), `falta tipo ${t}`);
  }
  assert.equal(VALID_TYPES.size, 4);
});

// ── Acceso a profesionales ────────────────────────────────────────────────────

