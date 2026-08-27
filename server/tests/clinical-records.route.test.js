"use strict";

process.env.DATABASE_URL ||= "mysql://test:test@127.0.0.1:3306/odentara_test";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const router = require("../routes/clinical-records");

function obtenerHandlerPut() {
  const capa = router.stack.find((item) => item.route?.path === "/:patientId" && item.route.methods.put);
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

function crearPrismaBase({ alCrearEntradas } = {}) {
  const llamadas = {
    transacciones: 0,
    borrados: 0,
    entradasCreadas: [],
    actualizaciones: [],
  };

  const prisma = {
    patient: {
      findFirst: async () => ({ id: 4 }),
    },
    professional: {
      findFirst: async ({ where }) => ({ id: where.id }),
    },
    clinicalRecord: {
      findUnique: async () => ({ id: 8 }),
      findFirst: async () => ({
        id: 8,
        patientId: 4,
        professionalId: 7,
        summaryNotes: "nota",
        allergies: null,
        medicalNotes: null,
        odontogramEntries: [],
      }),
      update: async ({ data }) => {
        llamadas.actualizaciones.push(data);
        return { id: 8 };
      },
      create: async () => ({ id: 8 }),
      upsert: async ({ create, update }) => {
        llamadas.actualizaciones.push(Object.keys(update).length ? update : create);
        return { id: 8 };
      },
    },
    odontogramEntry: {
      deleteMany: async () => { llamadas.borrados += 1; return { count: 1 }; },
      createMany: async ({ data }) => {
        llamadas.entradasCreadas.push(...data);
        if (alCrearEntradas) return alCrearEntradas(data);
        return { count: data.length };
      },
    },
  };

  prisma.$transaction = async (callback) => {
    llamadas.transacciones += 1;
    return callback(prisma);
  };

  return { prisma, llamadas };
}

function crearRequest(prisma, body, permissions = {}) {
  return {
    prisma,
    body,
    params: { patientId: "4" },
    user: { id: 20, clinicId: 3 },
    permissions: {
      roles: ["professional"],
      assignedProfessionalId: 7,
      allowedProfessionalIds: [],
      canAccessWholeClinic: false,
      ...permissions,
    },
  };
}

test("guardar la cara P conserva P en la entrada persistida", async () => {
  const { prisma, llamadas } = crearPrismaBase();
  const req = crearRequest(prisma, {
    professionalId: 7,
    odontogramEntries: [{ toothNumber: "16", face: "P", status: "caries" }],
  });
  const res = crearRespuesta();

  await obtenerHandlerPut()(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(llamadas.entradasCreadas[0].face, "P");
});

test("un PUT sin odontogramEntries no reemplaza el odontograma", async () => {
  const { prisma, llamadas } = crearPrismaBase();
  const req = crearRequest(prisma, { professionalId: 7, summaryNotes: "solo cambia la nota" });
  const res = crearRespuesta();

  await obtenerHandlerPut()(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(llamadas.borrados, 0);
  assert.equal(llamadas.entradasCreadas.length, 0);
});

test("un PUT con odontogramEntries vacío elimina explícitamente el odontograma", async () => {
  const { prisma, llamadas } = crearPrismaBase();
  const req = crearRequest(prisma, { professionalId: 7, odontogramEntries: [] });
  const res = crearRespuesta();

  await obtenerHandlerPut()(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(llamadas.borrados, 1);
  assert.equal(llamadas.entradasCreadas.length, 0);
});

test("texto y odontograma se guardan dentro de una única transacción", async () => {
  const { prisma, llamadas } = crearPrismaBase();
  const req = crearRequest(prisma, {
    professionalId: 7,
    summaryNotes: "nota nueva",
    odontogramEntries: [{ toothNumber: "16", face: "V", status: "restored" }],
  });
  const res = crearRespuesta();

  await obtenerHandlerPut()(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(llamadas.transacciones, 1);
});

test("no permite atribuir la edición a un profesional fuera del alcance", async () => {
  const { prisma, llamadas } = crearPrismaBase();
  const req = crearRequest(prisma, { professionalId: 99, summaryNotes: "nota" });
  const res = crearRespuesta();

  await obtenerHandlerPut()(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(llamadas.actualizaciones.length, 0);
});
