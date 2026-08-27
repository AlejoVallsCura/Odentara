// Decisión de cuándo corre el backup automático.
//
// Es la parte con más formas silenciosas de fallar: si la ventana está mal, el
// backup no corre nunca y nadie se entera hasta que hace falta restaurar. Si el
// slot no es estable, varios workers corren el mismo backup a la vez.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  correspondeAhora,
  partesLocales,
  intentoQueCorresponde,
  slotDeIntento,
  slotsDelTurno,
  alertaDeBackups,
  MAX_INTENTOS,
} = require("../lib/backup-schedule-rules");

// Las fechas se construyen en UTC y se evalúan en horario argentino (UTC-3).
// 06:00 UTC = 03:00 en Buenos Aires.
const utc = (iso) => new Date(iso);

const DIARIO_3AM = { enabled: true, frequency: "daily", hour: 3, minute: 0, weekday: 1 };

test("partesLocales convierte a horario argentino, no al del servidor", () => {
  const p = partesLocales(utc("2026-08-24T06:00:00Z"));
  assert.equal(p.hora, 3, "06:00 UTC son las 03:00 en Buenos Aires");
  assert.equal(p.fechaIso, "2026-08-24");
});

test("no corre si está desactivado", () => {
  assert.equal(correspondeAhora({ ...DIARIO_3AM, enabled: false }, utc("2026-08-24T06:00:00Z")), null);
});

test("corre en el horario configurado", () => {
  assert.ok(correspondeAhora(DIARIO_3AM, utc("2026-08-24T06:00:00Z")));
});

test("corre dentro de la ventana, no solo en el minuto exacto", () => {
  // El chequeo es cada 5 minutos: exigir el minuto exacto significaría saltearse
  // el backup casi siempre.
  assert.ok(correspondeAhora(DIARIO_3AM, utc("2026-08-24T06:07:00Z")), "7 minutos después sí");
});

test("el turno sigue vivo un par de horas, para poder reintentarlo", () => {
  // La ventana era de 10 minutos. Se amplió cuando un fallo de conexión a las
  // 03:00 dejó el día sin backup: con 10 minutos no había lugar para un
  // reintento espaciado. Quien limita las corridas es MAX_INTENTOS, no esto.
  assert.ok(correspondeAhora(DIARIO_3AM, utc("2026-08-24T06:45:00Z")), "45 minutos después sí");
  assert.ok(correspondeAhora(DIARIO_3AM, utc("2026-08-24T07:50:00Z")), "casi 2 horas después sí");
  assert.equal(correspondeAhora(DIARIO_3AM, utc("2026-08-24T08:05:00Z")), null, "pasadas 2 horas ya no");
});

test("no corre antes de la hora", () => {
  assert.equal(correspondeAhora(DIARIO_3AM, utc("2026-08-24T05:59:00Z")), null);
});

test("el slot es el mismo para todos los workers del mismo turno", () => {
  // De esto depende que la unicidad en base sirva de coordinación: dos procesos
  // que evalúan en instantes distintos de la misma ventana deben producir la
  // misma cadena.
  const a = correspondeAhora(DIARIO_3AM, utc("2026-08-24T06:01:00Z"));
  const b = correspondeAhora(DIARIO_3AM, utc("2026-08-24T07:40:00Z"));
  assert.equal(a, b);
  assert.equal(a, "auto-2026-08-24T03:00");
});

test("el slot cambia de un día al siguiente", () => {
  const hoy = correspondeAhora(DIARIO_3AM, utc("2026-08-24T06:00:00Z"));
  const manana = correspondeAhora(DIARIO_3AM, utc("2026-08-25T06:00:00Z"));
  assert.notEqual(hoy, manana);
});

test("lunes a viernes: no corre sábado ni domingo", () => {
  const cfg = { ...DIARIO_3AM, frequency: "weekdays" };
  // 2026-08-24 es lunes; 29 sábado; 30 domingo.
  assert.ok(correspondeAhora(cfg, utc("2026-08-24T06:00:00Z")), "lunes sí");
  assert.ok(correspondeAhora(cfg, utc("2026-08-28T06:00:00Z")), "viernes sí");
  assert.equal(correspondeAhora(cfg, utc("2026-08-29T06:00:00Z")), null, "sábado no");
  assert.equal(correspondeAhora(cfg, utc("2026-08-30T06:00:00Z")), null, "domingo no");
});

test("semanal: solo el día elegido", () => {
  const miercoles = { ...DIARIO_3AM, frequency: "weekly", weekday: 3 };
  assert.equal(correspondeAhora(miercoles, utc("2026-08-24T06:00:00Z")), null, "lunes no");
  assert.ok(correspondeAhora(miercoles, utc("2026-08-26T06:00:00Z")), "miércoles sí");
});

test("un horario nocturno no se corre el día equivocado por la zona horaria", () => {
  // 23:30 en Argentina son las 02:30 UTC del día SIGUIENTE. Si se usara la fecha
  // UTC, el slot llevaría el día de mañana y el backup de dos noches seguidas
  // podría compartir slot o saltearse.
  const cfg = { enabled: true, frequency: "daily", hour: 23, minute: 30, weekday: 1 };
  const slot = correspondeAhora(cfg, utc("2026-08-25T02:30:00Z"));
  assert.equal(slot, "auto-2026-08-24T23:30", "la fecha es la argentina, no la UTC");
});

// ── Reintentos dentro de un mismo turno ─────────────────────────────────────
//
// El caso real que motivó esto: el 25/8 a las 03:00 mysqldump no pudo conectar
// a la base, el turno quedó reservado por ese intento fallido, y ese día no
// hubo backup. Nadie se enteró hasta mirar la pantalla dos días después.

const AHORA = new Date("2026-08-25T06:00:00.000Z");
const haceMinutos = (m) => new Date(AHORA.getTime() - m * 60000);

test("sin corridas previas, corresponde el primer intento", () => {
  assert.equal(intentoQueCorresponde([], AHORA), 1);
});

test("un intento fallido se reintenta, que es todo el punto", () => {
  const corridas = [{ status: "error", startedAt: haceMinutos(25) }];
  assert.equal(intentoQueCorresponde(corridas, AHORA), 2);
});

test("los reintentos se espacian: no sirve reintentar a los 5 minutos", () => {
  // La causa típica es que la base estaba momentáneamente inalcanzable, y eso
  // no se arregla en el tiempo que tarda el próximo tick.
  const corridas = [{ status: "error", startedAt: haceMinutos(5) }];
  assert.equal(intentoQueCorresponde(corridas, AHORA), null);
});

test("después de agotar los intentos se deja de insistir", () => {
  const corridas = Array.from({ length: MAX_INTENTOS }, () => ({
    status: "error",
    startedAt: haceMinutos(60),
  }));
  assert.equal(intentoQueCorresponde(corridas, AHORA), null);
});

test("un turno que ya salió bien no se vuelve a correr", () => {
  const corridas = [
    { status: "error", startedAt: haceMinutos(60) },
    { status: "ok", startedAt: haceMinutos(30) },
  ];
  assert.equal(intentoQueCorresponde(corridas, AHORA), null);
});

test("mientras hay uno corriendo, nadie arranca otro", () => {
  const corridas = [{ status: "running", startedAt: haceMinutos(2) }];
  assert.equal(intentoQueCorresponde(corridas, AHORA), null);
});

test("una corrida colgada deja de bloquear pasado un rato", () => {
  // Un worker que se murió a mitad del dump deja la fila en "running" para
  // siempre. Sin esto, un solo proceso caído congela el backup del turno.
  const corridas = [{ status: "running", startedAt: haceMinutos(45) }];
  assert.equal(intentoQueCorresponde(corridas, AHORA), 1);
});

test("el primer intento conserva el slot pelado", () => {
  // Las corridas ya guardadas usan ese formato: cambiarlo las dejaría huérfanas.
  assert.equal(slotDeIntento("auto-2026-08-25T03:00", 1), "auto-2026-08-25T03:00");
  assert.equal(slotDeIntento("auto-2026-08-25T03:00", 2), "auto-2026-08-25T03:00#2");
});

test("cada intento tiene su propio slot, así dos workers no chocan", () => {
  const slots = slotsDelTurno("auto-2026-08-25T03:00");
  assert.equal(slots.length, MAX_INTENTOS);
  assert.equal(new Set(slots).size, MAX_INTENTOS, "todos distintos");
});

// ── Aviso de salud ──────────────────────────────────────────────────────────
//
// El modo de falla real no es que un backup falle: es que falle y nadie se
// entere. Una fila roja en una tabla larga no es un aviso.

const DIARIO = { enabled: true, frequency: "daily" };
const haceHoras = (h) => new Date(AHORA.getTime() - h * 3600000);

test("sin ningún backup exitoso, avisa fuerte", () => {
  const a = alertaDeBackups([{ status: "error", startedAt: haceHoras(1) }], AHORA, DIARIO);
  assert.equal(a.nivel, "error");
  assert.match(a.mensaje, /ningún backup exitoso/i);
});

test("con un backup exitoso reciente no molesta", () => {
  const a = alertaDeBackups([{ status: "ok", startedAt: haceHoras(3) }], AHORA, DIARIO);
  assert.equal(a, null);
});

test("avisa cuando el último exitoso quedó viejo para la frecuencia", () => {
  const a = alertaDeBackups([{ status: "ok", startedAt: haceHoras(72) }], AHORA, DIARIO);
  assert.equal(a.nivel, "error");
  assert.match(a.mensaje, /3 días/);
});

test("un fallo seguido de un reintento exitoso no dispara alarma de error", () => {
  // Justo el caso que los reintentos vienen a resolver: si avisáramos igual,
  // el aviso perdería sentido y se aprendería a ignorarlo.
  const a = alertaDeBackups([
    { status: "error", startedAt: haceHoras(4) },
    { status: "ok", startedAt: haceHoras(3) },
  ], AHORA, DIARIO);
  assert.equal(a, null);
});

test("si el último intento falló pero hay copia reciente, avisa suave", () => {
  const a = alertaDeBackups([
    { status: "ok", startedAt: haceHoras(20) },
    { status: "error", startedAt: haceHoras(1) },
  ], AHORA, DIARIO);
  assert.equal(a.nivel, "aviso");
});

test("con el automático apagado no se reclama antigüedad", () => {
  // Sin programación no hay promesa que incumplir: los backups son manuales.
  const a = alertaDeBackups([{ status: "ok", startedAt: haceHoras(500) }], AHORA,
    { enabled: false, frequency: "daily" });
  assert.equal(a, null);
});

test("el semanal tolera más días que el diario", () => {
  const corridas = [{ status: "ok", startedAt: haceHoras(72) }];
  assert.equal(alertaDeBackups(corridas, AHORA, { enabled: true, frequency: "weekly" }), null);
  assert.equal(alertaDeBackups(corridas, AHORA, DIARIO).nivel, "error");
});
