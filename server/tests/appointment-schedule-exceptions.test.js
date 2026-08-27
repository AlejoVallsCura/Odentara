// Excepciones de horario del profesional (OD-APT-06).
//
// Se creaban desde la API, se guardaban y se devolvían, pero NUNCA participaban
// de la validación de turnos: un día bloqueado o un feriado seguía aceptando
// turnos. El `select` de validateAppointmentPayload ni siquiera las traía.
//
// Estas pruebas fijan la precedencia, que sale del enum ScheduleExceptionType:
// `unavailable` bloquea y `special_hours` REEMPLAZA al horario semanal.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  scheduleAllowsAppointment,
  parseDateOnly,
} = require("../services/appointment.service");

const FECHA = "2026-09-10";
const OTRA_FECHA = "2026-09-11";
const DIA_SEMANA = parseDateOnly(FECHA).getDay();

// Horario habitual: ese día de semana, de 09:00 a 17:00.
const HORARIO_SEMANAL = [
  { active: true, weekday: DIA_SEMANA, startTime: "09:00", endTime: "17:00" },
];

const turno = (time, durationMinutes = 30) => ({
  date: FECHA,
  time,
  durationMinutes,
  isOverbook: false,
});

const excepcion = (type, { fecha = FECHA, startTime = null, endTime = null } = {}) => ({
  date: parseDateOnly(fecha),
  type,
  startTime,
  endTime,
});

// ── Sin excepciones: manda el horario semanal ────────────────────────────────

test("sin excepciones, el horario semanal decide", () => {
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("10:00"), []), true);
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("18:00"), []), false);
});

test("un turno que empieza dentro pero termina fuera del horario no entra", () => {
  // 16:30 + 60 min = 17:30, y el horario cierra 17:00
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("16:30", 60), []), false);
});

// ── unavailable ──────────────────────────────────────────────────────────────

test("unavailable sin franja bloquea el día entero", () => {
  const excepciones = [excepcion("unavailable")];
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("10:00"), excepciones), false);
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("16:00"), excepciones), false);
});

test("unavailable con franja bloquea solo esa franja", () => {
  // Se ausenta de 12:00 a 14:00
  const excepciones = [excepcion("unavailable", { startTime: "12:00", endTime: "14:00" })];
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("12:30"), excepciones), false);
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("10:00"), excepciones), true);
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("15:00"), excepciones), true);
});

test("un turno que se monta sobre el borde de la franja bloqueada no entra", () => {
  const excepciones = [excepcion("unavailable", { startTime: "12:00", endTime: "14:00" })];
  // 11:30 + 60 = 12:30, se pisa con el arranque de la ausencia
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("11:30", 60), excepciones), false);
  // 11:00 + 60 = 12:00, termina justo cuando empieza: no se pisa
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("11:00", 60), excepciones), true);
});

// ── special_hours ────────────────────────────────────────────────────────────

test("special_hours reemplaza al horario semanal, no se le suma", () => {
  // Ese día atiende 18:00–20:00 en vez de 09:00–17:00
  const excepciones = [excepcion("special_hours", { startTime: "18:00", endTime: "20:00" })];
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("18:30"), excepciones), true);
  // 10:00 entra en el horario habitual, pero ese día no rige
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("10:00"), excepciones), false);
});

test("unavailable gana sobre special_hours el mismo día", () => {
  const excepciones = [
    excepcion("special_hours", { startTime: "18:00", endTime: "20:00" }),
    excepcion("unavailable"),
  ];
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("18:30"), excepciones), false);
});

// ── Alcance por fecha ────────────────────────────────────────────────────────

test("una excepción de otra fecha no afecta al turno", () => {
  const excepciones = [excepcion("unavailable", { fecha: OTRA_FECHA })];
  assert.equal(scheduleAllowsAppointment(HORARIO_SEMANAL, turno("10:00"), excepciones), true);
});

test("sin horario semanal cargado no se puede reservar", () => {
  assert.equal(scheduleAllowsAppointment([], turno("10:00"), []), false);
});

test("un horario inactivo no habilita turnos", () => {
  const inactivo = [{ active: false, weekday: DIA_SEMANA, startTime: "09:00", endTime: "17:00" }];
  assert.equal(scheduleAllowsAppointment(inactivo, turno("10:00"), []), false);
});
