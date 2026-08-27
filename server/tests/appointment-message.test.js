// Plantilla del mensaje de confirmación.
//
// Lo que protegen estos tests es que un texto escrito por una secretaria no
// pueda producir un mensaje roto para un paciente. Los casos son los errores que
// se cometen escribiendo, no los que se cometen programando.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  renderAppointmentMessage,
  validateAppointmentTemplate,
  PLANTILLA_POR_DEFECTO,
  LARGO_MAXIMO,
} = require("../../shared/appointment-message");

const DATOS = {
  paciente: "María García",
  fecha: "24/8/2026",
  hora: "15:30",
  profesional: "Dr. Ejemplo",
  clinica: "Centro Odontológico",
};

test("reemplaza todos los marcadores", () => {
  const salida = renderAppointmentMessage(
    "Hola {paciente}, te esperamos el {fecha} a las {hora} con {profesional} en {clinica}.",
    DATOS
  );
  assert.equal(
    salida,
    "Hola María García, te esperamos el 24/8/2026 a las 15:30 con Dr. Ejemplo en Centro Odontológico."
  );
});

test("repite el mismo marcador tantas veces como aparezca", () => {
  assert.equal(
    renderAppointmentMessage("{paciente}, {paciente}, {paciente}", DATOS),
    "María García, María García, María García"
  );
});

test("una plantilla vacía cae en la de por defecto", () => {
  for (const vacio of ["", "   ", null, undefined]) {
    const salida = renderAppointmentMessage(vacio, DATOS);
    assert.ok(salida.includes("María García"), `falló con ${JSON.stringify(vacio)}`);
    assert.ok(!salida.includes("{"), "no debería quedar ningún marcador sin reemplazar");
  }
});

test("la plantilla por defecto usa el nombre de la clínica, no el del software", () => {
  const salida = renderAppointmentMessage(PLANTILLA_POR_DEFECTO, DATOS);
  assert.ok(salida.includes("Centro Odontológico"));
  assert.ok(!salida.includes("Odentara"), "el mensaje lo firma la clínica");
});

test("un marcador mal escrito queda visible en vez de desaparecer", () => {
  // Si se borrara en silencio, la secretaria vería un mensaje incompleto sin
  // entender por qué. Dejándolo escrito, lo detecta en la vista previa.
  assert.equal(
    renderAppointmentMessage("Hola {pasiente}", DATOS),
    "Hola {pasiente}"
  );
});

test("un dato ausente deja el marcador en vez de escribir 'undefined'", () => {
  assert.equal(
    renderAppointmentMessage("Hola {paciente} con {profesional}", { paciente: "Ana" }),
    "Hola Ana con {profesional}"
  );
});

test("el texto libre y los saltos de línea se conservan", () => {
  const plantilla = "Hola {paciente}.\n\nTe esperamos.\n— Recepción";
  assert.equal(
    renderAppointmentMessage(plantilla, DATOS),
    "Hola María García.\n\nTe esperamos.\n— Recepción"
  );
});

test("validar acepta el vacío: es la forma de volver al texto por defecto", () => {
  assert.deepEqual(validateAppointmentTemplate(""), []);
  assert.deepEqual(validateAppointmentTemplate(null), []);
});

test("validar avisa de marcadores inexistentes sin impedir guardar", () => {
  const problemas = validateAppointmentTemplate("Hola {pasiente} el {fexa}");
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /\{pasiente\}/);
  assert.match(problemas[0], /\{fexa\}/);
});

test("validar rechaza un mensaje excesivamente largo", () => {
  const problemas = validateAppointmentTemplate("x".repeat(LARGO_MAXIMO + 1));
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /caracteres/);
});
