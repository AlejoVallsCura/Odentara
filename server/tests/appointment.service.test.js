// Tests de appointment.service — correr con: npm test
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  VALID_STATUSES,
  VALID_CHANNELS,
  getTodayIsoLocal,
  parseDateOnly,
  formatLocalDate,
  formatLocalTime,
  parseDateTime,
  timeToMinutes,
  serializeAppointment,
} = require("../services/appointment.service");

// ── timeToMinutes ─────────────────────────────────────────────────────────────

test("timeToMinutes convierte HH:MM a minutos", () => {
  assert.equal(timeToMinutes("00:00"), 0);
  assert.equal(timeToMinutes("08:30"), 510);
  assert.equal(timeToMinutes("23:59"), 1439);
});

test("timeToMinutes devuelve null con entrada inválida", () => {
  assert.equal(timeToMinutes(""), null);
  assert.equal(timeToMinutes("abc"), null);
  assert.equal(timeToMinutes(), null);
});

// ── parseDateOnly / formatLocalDate (round-trip) ──────────────────────────────

test("parseDateOnly interpreta YYYY-MM-DD como fecha local", () => {
  const d = parseDateOnly("2026-07-03");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6); // julio = 6 (0-indexed)
  assert.equal(d.getDate(), 3);
});

test("formatLocalDate es inversa de parseDateOnly", () => {
  for (const iso of ["2026-01-01", "2026-12-31", "2024-02-29"]) {
    assert.equal(formatLocalDate(parseDateOnly(iso)), iso);
  }
});

// ── parseDateTime / formatLocalTime ───────────────────────────────────────────

test("parseDateTime combina fecha y hora locales", () => {
  const d = parseDateTime("2026-07-03", "14:30");
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 30);
  assert.equal(formatLocalTime(d), "14:30");
});

test("formatLocalTime rellena con ceros", () => {
  assert.equal(formatLocalTime(new Date(2026, 0, 1, 8, 5)), "08:05");
});

// ── getTodayIsoLocal ──────────────────────────────────────────────────────────

test("getTodayIsoLocal devuelve formato YYYY-MM-DD", () => {
  assert.match(getTodayIsoLocal(), /^\d{4}-\d{2}-\d{2}$/);
});

// ── Constantes ────────────────────────────────────────────────────────────────

test("VALID_STATUSES contiene los 5 estados del sistema", () => {
  for (const s of ["not_sent", "sent", "confirmed", "rescheduled", "cancelled"]) {
    assert.ok(VALID_STATUSES.has(s), `falta status ${s}`);
  }
  assert.equal(VALID_STATUSES.size, 5);
});

test("VALID_CHANNELS contiene los canales de confirmación", () => {
  for (const c of ["whatsapp", "phone", "email", "manual"]) {
    assert.ok(VALID_CHANNELS.has(c), `falta canal ${c}`);
  }
});

// ── serializeAppointment ──────────────────────────────────────────────────────

test("serializeAppointment formatea fecha y hora en local", () => {
  const out = serializeAppointment({
    id: 1,
    date: new Date(2026, 6, 3),
    startTime: new Date(2026, 6, 3, 9, 15),
    durationMinutes: 30,
    status: "confirmed",
    patient: null,
    professional: null,
    createdByUser: null,
  });
  assert.equal(out.date, "2026-07-03");
  assert.equal(out.startTime, "09:15");
  assert.equal(out.patient, null);
});

test("serializeAppointment expone solo campos seguros del paciente", () => {
  const out = serializeAppointment({
    id: 1,
    date: new Date(2026, 6, 3),
    startTime: new Date(2026, 6, 3, 9, 0),
    patient: { id: 7, fullName: "Ana", dni: "123", phone: "111", email: "secreto@x.com" },
  });
  assert.deepEqual(Object.keys(out.patient), ["id", "fullName", "dni", "phone"]);
});
