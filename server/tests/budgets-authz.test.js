"use strict";

process.env.DATABASE_URL ||= "mysql://test:test@127.0.0.1:3306/odentara_test";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const router = require("../routes/budgets");

function obtenerHandlerPost() {
  const capa = router.stack.find((item) => item.route?.path === "/" && item.route.methods.post);
  return capa.route.stack.at(-1).handle;
}

function crearRespuesta() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("un profesional restringido no crea un presupuesto a nombre de un colega", async () => {
  let creaciones = 0;
  const req = {
    body: {
      patientId: 4,
      professionalId: 99,
      title: "Tratamiento",
      items: [{ description: "Consulta", quantity: 1, unitPrice: 1000 }],
      discount: 0,
      currency: "ARS",
    },
    user: { id: 10, clinicId: 3 },
    permissions: {
      roles: ["professional"],
      assignedProfessionalId: 7,
      allowedProfessionalIds: [],
      canAccessWholeClinic: false,
    },
    prisma: {
      patient: { findFirst: async () => ({ id: 4 }) },
      professional: { findFirst: async () => ({ id: 99 }) },
      budget: {
        create: async () => {
          creaciones += 1;
          return { id: 1, items: "[]", total: 1000 };
        },
      },
    },
  };
  const res = crearRespuesta();

  await obtenerHandlerPost()(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(creaciones, 0);
});

