const test = require("node:test");
const assert = require("node:assert/strict");

const { requirePermission, requireAnyPermission } = require("../middleware/require-permission");

// Dobles mínimos de Express. Solo se necesita registrar qué se respondió y si
// se dejó pasar la request: el middleware no toca nada más.
function crearRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function correr(guard, permissions) {
  const req = permissions === undefined ? {} : { permissions };
  const res = crearRes();
  let vecesQueLlamoNext = 0;
  guard(req, res, () => {
    vecesQueLlamoNext += 1;
  });
  return { res, vecesQueLlamoNext };
}

// ── requirePermission ────────────────────────────────────────────────────────

test("con permiso, deja pasar y no responde nada", () => {
  const guard = requirePermission(() => true, "No tenes permisos para ver recetas.");
  const { res, vecesQueLlamoNext } = correr(guard, {});

  assert.equal(vecesQueLlamoNext, 1);
  assert.equal(res.statusCode, null, "no debe responder si deja pasar");
});

test("sin permiso, responde 403 y no continúa", () => {
  const guard = requirePermission(() => false, "No tenes permisos para ver recetas.");
  const { res, vecesQueLlamoNext } = correr(guard, {});

  assert.equal(vecesQueLlamoNext, 0);
  assert.equal(res.statusCode, 403);
});

test("el mensaje de la ruta llega textual al usuario", () => {
  // Es el motivo por el que cada guard declara su propio mensaje en vez de uno
  // genérico: le dice a la persona qué acción intentó.
  const mensaje = "No tenes permisos para anular recetas.";
  const guard = requirePermission(() => false, mensaje);
  const { res } = correr(guard, {});

  assert.deepEqual(res.body, { ok: false, error: mensaje });
});

test("el check recibe req.permissions y nada más", () => {
  const permisos = { assignedProfessionalId: 7 };
  let recibido = null;
  const guard = requirePermission((p) => {
    recibido = p;
    return true;
  }, "mensaje");

  correr(guard, permisos);
  assert.equal(recibido, permisos);
});

test("sin req.permissions responde 403 en vez de explotar", () => {
  // requireAuth siempre completa req.permissions antes de llegar acá, así que
  // esto no debería pasar. Se cubre igual porque la alternativa —una excepción
  // que se va al error handler de Express— daría un 500 genérico en vez de un
  // 403 entendible, y sería difícil de diagnosticar.
  const guard = requirePermission((p) => Boolean(p?.puedeTodo), "No tenes permisos para ver recetas.");
  const { res, vecesQueLlamoNext } = correr(guard, undefined);

  assert.equal(vecesQueLlamoNext, 0);
  assert.equal(res.statusCode, 403);
});

// ── requireAnyPermission ─────────────────────────────────────────────────────

test("alcanza con que pase una sola de las condiciones", () => {
  // El caso real: un presupuesto lo puede ver quien maneja datos clínicos o
  // quien maneja facturación.
  const guard = requireAnyPermission(
    [() => false, () => true],
    "No tenes permisos para ver presupuestos.",
  );
  const { res, vecesQueLlamoNext } = correr(guard, {});

  assert.equal(vecesQueLlamoNext, 1);
  assert.equal(res.statusCode, null);
});

test("la primera condición verdadera también alcanza", () => {
  const guard = requireAnyPermission([() => true, () => false], "mensaje");
  const { vecesQueLlamoNext } = correr(guard, {});

  assert.equal(vecesQueLlamoNext, 1);
});

test("con todas las condiciones falsas responde 403", () => {
  const mensaje = "No tenes permisos para ver presupuestos.";
  const guard = requireAnyPermission([() => false, () => false], mensaje);
  const { res, vecesQueLlamoNext } = correr(guard, {});

  assert.equal(vecesQueLlamoNext, 0);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { ok: false, error: mensaje });
});

test("sin req.permissions responde 403 en vez de explotar", () => {
  const guard = requireAnyPermission(
    [(p) => Boolean(p?.a), (p) => Boolean(p?.b)],
    "No tenes permisos para ver presupuestos.",
  );
  const { res, vecesQueLlamoNext } = correr(guard, undefined);

  assert.equal(vecesQueLlamoNext, 0);
  assert.equal(res.statusCode, 403);
});
