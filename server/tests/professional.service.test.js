// Tests de professional.service — correr con: npm test
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeColor,
  normalizeSchedules,
  normalizeExceptions,
} = require("../services/professional.service");

// ── normalizeColor ────────────────────────────────────────────────────────────

test("normalizeColor acepta formatos válidos", () => {
  assert.equal(normalizeColor("#0d9488"), "#0d9488");
  assert.equal(normalizeColor("#fff"), "#fff");
  assert.equal(normalizeColor("rgb(13, 148, 136)"), "rgb(13, 148, 136)");
  assert.equal(normalizeColor("hsl(175, 84%, 32%)"), "hsl(175, 84%, 32%)");
});

test("normalizeColor rechaza valores peligrosos o inválidos", () => {
  assert.equal(normalizeColor("red"), null); // nombres no permitidos
  assert.equal(normalizeColor("javascript:alert(1)"), null);
  assert.equal(normalizeColor("#zzz"), null);
  assert.equal(normalizeColor(""), null);
  assert.equal(normalizeColor(null), null);
});

// ── normalizeSchedules ────────────────────────────────────────────────────────

test("normalizeSchedules filtra items incompletos", () => {
  const result = normalizeSchedules([
    { weekday: 1, startTime: "09:00", endTime: "17:00" },
    { weekday: 2 }, // sin horarios → se descarta
    null,
    { startTime: "09:00", endTime: "17:00" }, // sin weekday → se descarta
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].weekday, 1);
});

test("normalizeSchedules castea tipos y defaultea active a true", () => {
  const [s] = normalizeSchedules([{ weekday: "3", startTime: "08:00", endTime: "12:00" }]);
  assert.equal(s.weekday, 3);
  assert.equal(typeof s.weekday, "number");
  assert.equal(s.active, true);
});

test("normalizeSchedules acepta weekday 0 (domingo)", () => {
  const result = normalizeSchedules([{ weekday: 0, startTime: "09:00", endTime: "13:00" }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].weekday, 0);
});

test("normalizeSchedules respeta active false explícito", () => {
  const [s] = normalizeSchedules([{ weekday: 1, startTime: "09:00", endTime: "17:00", active: false }]);
  assert.equal(s.active, false);
});

// ── normalizeExceptions ───────────────────────────────────────────────────────

test("normalizeExceptions filtra items sin fecha o tipo", () => {
  const result = normalizeExceptions([
    { date: "2026-07-09", type: "holiday" },
    { date: "2026-07-10" }, // sin type → se descarta
    { type: "holiday" },     // sin date → se descarta
  ]);
  assert.equal(result.length, 1);
  assert.ok(result[0].date instanceof Date);
});

test("normalizeExceptions normaliza campos opcionales a null", () => {
  const [e] = normalizeExceptions([{ date: "2026-07-09", type: "holiday" }]);
  assert.equal(e.startTime, null);
  assert.equal(e.endTime, null);
  assert.equal(e.reason, null);
});
