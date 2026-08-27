// Autorizaciones de un solo uso (OD-AUTH-10).
//
// La descarga del backup completo y el canje de sesión entre subdominios usaban
// firmas SIN ESTADO: reutilizables dentro de su ventana, y con la URL quedando
// en los logs del reverse proxy. Estaban calibradas al revés de lo que
// protegían — los archivos de un paciente tenían token en base con tope de usos,
// y la base entera una firma replicable.
//
// Lo que hay que garantizar acá es lo que la firma no podía dar: que un token
// sirva UNA sola vez, aunque lo reclamen dos pedidos a la vez.
//
// No se toca la base: se le inyecta un doble a la librería. Lo que se prueba es
// la lógica del reclamo, no Prisma.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

// ── Doble de prisma ──────────────────────────────────────────────────────────
//
// updateMany se comporta como el motor: aplica el filtro y devuelve cuántas
// filas tocó. Es lo que hace que el reclamo sea atómico.

function crearPrismaFalso() {
  const filas = new Map();
  return {
    _filas: filas,
    singleUseToken: {
      async create({ data }) {
        filas.set(data.token, { usedAt: null, ...data });
        return data;
      },
      async updateMany({ where, data }) {
        const fila = filas.get(where.token);
        if (!fila) return { count: 0 };
        if (where.scope !== undefined && fila.scope !== where.scope) return { count: 0 };
        if (where.usedAt === null && fila.usedAt !== null) return { count: 0 };
        if (where.expiresAt?.gt && !(fila.expiresAt > where.expiresAt.gt)) return { count: 0 };
        Object.assign(fila, data);
        return { count: 1 };
      },
      async findUnique({ where }) {
        return filas.get(where.token) || null;
      },
      async deleteMany({ where }) {
        let count = 0;
        for (const [token, fila] of filas) {
          if (fila.expiresAt < where.expiresAt.lt) { filas.delete(token); count++; }
        }
        return { count };
      },
    },
  };
}

/** Carga single-use-token.js con el prisma falso en lugar del real. */
function cargarLibreria(prismaFalso) {
  const rutaLib = require.resolve("../lib/single-use-token");
  const rutaPrisma = require.resolve("../lib/prisma");
  delete require.cache[rutaLib];
  require.cache[rutaPrisma] = { id: rutaPrisma, filename: rutaPrisma, loaded: true, exports: prismaFalso };
  const lib = require("../lib/single-use-token");
  delete require.cache[rutaPrisma];
  return lib;
}

// ── Pruebas ──────────────────────────────────────────────────────────────────

test("un token recién emitido se puede reclamar y devuelve su payload", async () => {
  const lib = cargarLibreria(crearPrismaFalso());
  const token = await lib.emitirAutorizacion({
    scope: "backup-download",
    payload: { archivo: "odentara-db-20260827.sql.gz" },
    ttlSegundos: 300,
  });

  const payload = await lib.reclamarAutorizacion({ scope: "backup-download", token });
  assert.equal(payload.archivo, "odentara-db-20260827.sql.gz");
});

test("EL MISMO TOKEN NO SIRVE DOS VECES", async () => {
  const lib = cargarLibreria(crearPrismaFalso());
  const token = await lib.emitirAutorizacion({
    scope: "backup-download",
    payload: { archivo: "backup.sql.gz" },
    ttlSegundos: 300,
  });

  assert.ok(await lib.reclamarAutorizacion({ scope: "backup-download", token }));
  // Este es el caso que la firma sin estado NO cubría: la URL queda en los logs
  // del proxy y se podía volver a usar hasta que venciera.
  assert.equal(await lib.reclamarAutorizacion({ scope: "backup-download", token }), null);
});

test("dos reclamos simultáneos: uno gana y el otro no", async () => {
  const lib = cargarLibreria(crearPrismaFalso());
  const token = await lib.emitirAutorizacion({
    scope: "auth-exchange",
    payload: { userId: 7 },
    ttlSegundos: 120,
  });

  const [a, b] = await Promise.all([
    lib.reclamarAutorizacion({ scope: "auth-exchange", token }),
    lib.reclamarAutorizacion({ scope: "auth-exchange", token }),
  ]);

  const ganadores = [a, b].filter(Boolean);
  assert.equal(ganadores.length, 1, "exactamente un reclamo tiene que prosperar");
  assert.equal(ganadores[0].userId, 7);
});

test("un token de un scope no sirve en otro", async () => {
  const lib = cargarLibreria(crearPrismaFalso());
  const token = await lib.emitirAutorizacion({
    scope: "auth-exchange",
    payload: { userId: 1 },
    ttlSegundos: 120,
  });

  // Sin el scope, un código emitido para saltar de subdominio serviría para
  // bajarse la base entera.
  assert.equal(await lib.reclamarAutorizacion({ scope: "backup-download", token }), null);
  assert.ok(await lib.reclamarAutorizacion({ scope: "auth-exchange", token }));
});

test("un token vencido no se puede reclamar", async () => {
  const prismaFalso = crearPrismaFalso();
  const lib = cargarLibreria(prismaFalso);
  const token = await lib.emitirAutorizacion({
    scope: "backup-download",
    payload: { archivo: "x.sql.gz" },
    ttlSegundos: 300,
  });

  prismaFalso._filas.get(token).expiresAt = new Date(Date.now() - 1000);
  assert.equal(await lib.reclamarAutorizacion({ scope: "backup-download", token }), null);
});

test("un token inventado no se puede reclamar", async () => {
  const lib = cargarLibreria(crearPrismaFalso());
  assert.equal(await lib.reclamarAutorizacion({ scope: "backup-download", token: "a".repeat(64) }), null);
  assert.equal(await lib.reclamarAutorizacion({ scope: "backup-download", token: "" }), null);
  assert.equal(await lib.reclamarAutorizacion({ scope: "backup-download", token: null }), null);
});

test("los tokens son largos, aleatorios y distintos entre sí", async () => {
  const lib = cargarLibreria(crearPrismaFalso());
  const emitidos = new Set();
  for (let i = 0; i < 50; i++) {
    const token = await lib.emitirAutorizacion({ scope: "auth-exchange", payload: {}, ttlSegundos: 60 });
    assert.match(token, /^[0-9a-f]{64}$/, "64 hex = 32 bytes de aleatoriedad");
    emitidos.add(token);
  }
  assert.equal(emitidos.size, 50, "no puede repetirse ninguno");
});

test("la purga borra solo lo vencido", async () => {
  const prismaFalso = crearPrismaFalso();
  const lib = cargarLibreria(prismaFalso);
  const vivo = await lib.emitirAutorizacion({ scope: "auth-exchange", payload: {}, ttlSegundos: 300 });
  const muerto = await lib.emitirAutorizacion({ scope: "auth-exchange", payload: {}, ttlSegundos: 300 });
  prismaFalso._filas.get(muerto).expiresAt = new Date(Date.now() - 1000);

  assert.equal(await lib.purgarAutorizacionesVencidas(), 1);
  assert.ok(prismaFalso._filas.has(vivo));
  assert.ok(!prismaFalso._filas.has(muerto));
});
