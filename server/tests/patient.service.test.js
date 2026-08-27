// Tests de patient.service — correr con: npm test
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeDni,
  normalizePatientName,
  getPatientPayload,
  serializePatient,
} = require("../services/patient.service");

// ── normalizeDni ──────────────────────────────────────────────────────────────

test("normalizeDni elimina todo lo que no sea dígito", () => {
  assert.equal(normalizeDni("12.345.678"), "12345678");
  assert.equal(normalizeDni(" 12 345 678 "), "12345678");
  assert.equal(normalizeDni("DNI 12345678"), "12345678");
});

test("normalizeDni con valores vacíos o inválidos", () => {
  assert.equal(normalizeDni(""), "");
  assert.equal(normalizeDni(), "");
  assert.equal(normalizeDni("abc"), "");
});

// ── normalizePatientName ──────────────────────────────────────────────────────

test("normalizePatientName pasa a minúsculas y quita tildes", () => {
  assert.equal(normalizePatientName("José Pérez"), "jose perez");
  assert.equal(normalizePatientName("MARÍA GÓMEZ"), "maria gomez");
});

test("normalizePatientName colapsa espacios múltiples", () => {
  assert.equal(normalizePatientName("  Juan   Carlos  López "), "juan carlos lopez");
});

// ── getPatientPayload ─────────────────────────────────────────────────────────

test("getPatientPayload normaliza campos básicos", () => {
  const payload = getPatientPayload({
    fullName: "  Ana Díaz  ",
    dni: "34.567.890",
    email: "  ANA@Test.COM ",
    phone: " 1155667788 ",
  });
  assert.equal(payload.fullName, "Ana Díaz");
  assert.equal(payload.dni, "34567890");
  assert.equal(payload.email, "ana@test.com");
  assert.equal(payload.phone, "1155667788");
  assert.equal(payload.active, true);
});

test("getPatientPayload trata birthDate inválida como null", () => {
  assert.equal(getPatientPayload({ birthDate: "no-es-fecha" }).birthDate, null);
  assert.equal(getPatientPayload({}).birthDate, null);
});

test("getPatientPayload parsea birthDate válida como Date", () => {
  const payload = getPatientPayload({ birthDate: "1990-05-15" });
  assert.ok(payload.birthDate instanceof Date);
  assert.equal(isNaN(payload.birthDate.getTime()), false);
});

test("getPatientPayload trunca campos a su longitud máxima", () => {
  const payload = getPatientPayload({ fullName: "x".repeat(300), phone: "1".repeat(50) });
  assert.equal(payload.fullName.length, 255);
  assert.equal(payload.phone.length, 30);
});

test("getPatientPayload respeta active explícito", () => {
  assert.equal(getPatientPayload({ active: false }).active, false);
  assert.equal(getPatientPayload({ active: 0 }).active, false);
});

// ── serializePatient ──────────────────────────────────────────────────────────

test("serializePatient incluye stats con defaults en 0", () => {
  const out = serializePatient({ id: 1, fullName: "Test", dni: "123" });
  assert.deepEqual(out.stats, { appointments: 0, treatments: 0, images: 0 });
});

test("serializePatient mapea _count a stats", () => {
  const out = serializePatient({
    id: 1,
    fullName: "Test",
    _count: { appointments: 5, treatments: 2, clinicalImages: 3 },
  });
  assert.deepEqual(out.stats, { appointments: 5, treatments: 2, images: 3 });
});

// -----------------------------------------------------------------------------
// toDisplayCasePatientName — formato uniforme del nombre
// -----------------------------------------------------------------------------
//
// El caso real: en una clínica cargaban en MAYÚSCULA, en minúscula y mezclado,
// y el listado quedaba con tres estilos distintos. Estos tests fijan que entre
// como entre, salga siempre igual.

const { toDisplayCasePatientName } = require("../services/patient.service");

test("unifica mayúsculas, minúsculas y mezclas al mismo resultado", () => {
  for (const entrada of ["MARÍA GARCÍA", "maría garcía", "María garcía", "mArÍa GaRcÍa"]) {
    assert.equal(toDisplayCasePatientName(entrada), "María García");
  }
});

test("conserva los acentos (eso lo saca normalizePatientName, no esta)", () => {
  assert.equal(toDisplayCasePatientName("josé peña"), "José Peña");
  assert.equal(toDisplayCasePatientName("ÑANDÚ ÁÉÍÓÚ"), "Ñandú Áéíóú");
});

test("deja las partículas en minúscula salvo que abran el nombre", () => {
  assert.equal(toDisplayCasePatientName("JUAN DE LA CRUZ"), "Juan de la Cruz");
  assert.equal(toDisplayCasePatientName("maría del carmen lópez"), "María del Carmen López");
  assert.equal(toDisplayCasePatientName("de la cruz juan"), "De la Cruz Juan");
});

test("capitaliza después de guiones y apóstrofos", () => {
  assert.equal(toDisplayCasePatientName("ana-maría d'angelo"), "Ana-María D'Angelo");
});

test("colapsa espacios de más y tolera entradas vacías", () => {
  assert.equal(toDisplayCasePatientName("  juan   pérez  "), "Juan Pérez");
  assert.equal(toDisplayCasePatientName(""), "");
  assert.equal(toDisplayCasePatientName(null), "");
  assert.equal(toDisplayCasePatientName(undefined), "");
});
