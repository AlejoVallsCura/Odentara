"use strict";

process.env.DATABASE_URL ||= "mysql://test:test@127.0.0.1:3306/odentara_test";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  serializePatient,
  getPatientPayload,
} = require("../services/patient.service");
const router = require("../routes/patients");

function buscarRuta(path, method) {
  return router.stack.find((item) => item.route?.path === path && item.route.methods[method]).route;
}

function respuesta() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("el DTO administrativo no expone antecedentes médicos por defecto", () => {
  const dto = serializePatient({
    id: 1,
    fullName: "Paciente",
    dni: "12345678",
    medicalHistory: { diabetes: true },
  });

  assert.equal(Object.hasOwn(dto, "medicalHistory"), false);
});

test("el DTO clínico incluye antecedentes cuando la ruta ya los autorizó", () => {
  const medicalHistory = { diabetes: true };
  const dto = serializePatient(
    { id: 1, fullName: "Paciente", dni: "12345678", medicalHistory },
    { includeClinicalData: true },
  );

  assert.deepEqual(dto.medicalHistory, medicalHistory);
});

test("el payload administrativo no acepta campos clínicos", () => {
  const payload = getPatientPayload({
    fullName: "Paciente",
    dni: "12345678",
    medicalHistory: { diabetes: true },
    allergies: "penicilina",
    medicalNotes: "dato clínico",
  });

  assert.equal(Object.hasOwn(payload, "medicalHistory"), false);
  assert.equal(Object.hasOwn(payload, "allergies"), false);
  assert.equal(Object.hasOwn(payload, "medicalNotes"), false);
});

test("ai-summary exige un guard clínico además de autenticación", () => {
  const route = buscarRuta("/:id/ai-summary", "post");
  assert.equal(route.stack.some((layer) => layer.handle.name === "permissionGuard"), true);
});

test("una secretaria no supera el guard de estructuración de nota clínica", () => {
  const route = buscarRuta("/:id/ai-structure-note", "post");
  const guard = route.stack.find((layer) => layer.handle.name === "permissionGuard").handle;
  const req = { permissions: { roles: ["secretary"] } };
  const res = respuesta();
  let continuo = false;

  guard(req, res, () => { continuo = true; });

  assert.equal(continuo, false);
  assert.equal(res.statusCode, 403);
});

test("el PUT administrativo descarta medicalHistory aunque llegue en el body", async () => {
  const route = buscarRuta("/:id", "put");
  const handler = route.stack.at(-1).handle;
  let dataActualizada = null;
  const req = {
    params: { id: "4" },
    body: {
      fullName: "Paciente Prueba",
      dni: "12345678",
      medicalHistory: { diabetes: true },
    },
    user: { id: 9, clinicId: 3 },
    permissions: { roles: ["secretary"], canAccessWholeClinic: true },
    prisma: {
      patient: {
        findFirst: async ({ where }) => where.id === 4 ? { id: 4 } : null,
        update: async ({ data }) => {
          dataActualizada = data;
          return { id: 4, fullName: data.fullName, dni: data.dni, medicalHistory: { asma: true } };
        },
      },
    },
  };
  const res = respuesta();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Object.hasOwn(dataActualizada, "medicalHistory"), false);
  assert.equal(Object.hasOwn(res.body.patient, "medicalHistory"), false);
});
