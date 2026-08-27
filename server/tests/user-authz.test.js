const test = require("node:test");
const assert = require("node:assert/strict");

const {
  codigosDeRol,
  mismosRoles,
  esSuperadmin,
  evaluarEdicionDeUsuario,
} = require("../lib/user-authz");

/** Atajo: la evaluación con valores por defecto razonables. */
function evaluar(overrides) {
  return evaluarEdicionDeUsuario({
    rolesDelActor: ["admin"],
    rolesActuales: ["secretary"],
    rolesPedidos: ["secretary"],
    esAutoedicion: false,
    cambiaPassword: false,
    ...overrides,
  });
}

// ── Escalada de privilegios: el agujero que motivó todo esto ────────────────

test("una secretaria NO puede darse el rol admin editándose a sí misma", () => {
  // El caso real: PUT /users/:id dejaba pasar si userId === req.user.id, y
  // después tomaba `roles` del body y los aplicaba con deleteMany + create.
  const rechazo = evaluar({
    rolesDelActor: ["secretary"],
    rolesActuales: ["secretary"],
    rolesPedidos: ["admin"],
    esAutoedicion: true,
  });

  assert.equal(rechazo?.status, 403);
  assert.match(rechazo.error, /tus propios roles/i);
});

test("un profesional tampoco puede escalar a admin", () => {
  const rechazo = evaluar({
    rolesDelActor: ["professional"],
    rolesActuales: ["professional"],
    rolesPedidos: ["professional", "admin"],
    esAutoedicion: true,
  });

  assert.equal(rechazo?.status, 403);
});

test("un no-manager puede editar sus datos si no toca sus roles", () => {
  assert.equal(
    evaluar({
      rolesDelActor: ["secretary"],
      rolesActuales: ["secretary"],
      rolesPedidos: ["secretary"],
      esAutoedicion: true,
    }),
    null,
  );
});

test("un no-manager no puede editar a otro usuario", () => {
  const rechazo = evaluar({
    rolesDelActor: ["secretary"],
    esAutoedicion: false,
  });

  assert.equal(rechazo?.status, 403);
  assert.match(rechazo.error, /tu propio usuario/i);
});

// ── Jerarquía admin / superadmin ────────────────────────────────────────────

test("un admin no puede tocar la cuenta del superadmin", () => {
  // Sin esta regla, un admin podía quitarle el rol al dueño de la clínica y
  // cambiarle la contraseña: se quedaba con la clínica.
  const rechazo = evaluar({
    rolesDelActor: ["admin"],
    rolesActuales: ["superadmin"],
    rolesPedidos: ["superadmin"],
  });

  assert.equal(rechazo?.status, 403);
  assert.match(rechazo.error, /superadmin de la clínica/i);
});

test("un admin no puede cambiarle la contraseña al superadmin", () => {
  const rechazo = evaluar({
    rolesDelActor: ["admin"],
    rolesActuales: ["superadmin"],
    rolesPedidos: ["superadmin"],
    cambiaPassword: true,
  });

  assert.equal(rechazo?.status, 403);
});

test("ni el superadmin puede degradar a otro superadmin desde este panel", () => {
  // El panel no permite ASIGNAR superadmin, así que cualquier cambio de roles
  // sobre uno solo puede quitárselo — y dejar la clínica sin ninguno.
  const rechazo = evaluar({
    rolesDelActor: ["superadmin"],
    rolesActuales: ["superadmin"],
    rolesPedidos: ["admin"],
  });

  assert.equal(rechazo?.status, 403);
  assert.match(rechazo.error, /no se modifican desde este panel/i);
});

test("un superadmin sí puede editar los datos de otro superadmin sin tocar roles", () => {
  assert.equal(
    evaluar({
      rolesDelActor: ["superadmin"],
      rolesActuales: ["superadmin"],
      rolesPedidos: ["superadmin"],
    }),
    null,
  );
});

test("un admin sí puede cambiar los roles de una secretaria", () => {
  assert.equal(
    evaluar({
      rolesDelActor: ["admin"],
      rolesActuales: ["secretary"],
      rolesPedidos: ["professional"],
    }),
    null,
  );
});

test("un superadmin no puede cambiar sus propios roles", () => {
  const rechazo = evaluar({
    rolesDelActor: ["superadmin"],
    rolesActuales: ["superadmin"],
    rolesPedidos: ["superadmin", "professional"],
    esAutoedicion: true,
  });

  assert.equal(rechazo?.status, 403);
});

// ── Contraseñas ─────────────────────────────────────────────────────────────

test("un no-manager no puede cambiar su propia contraseña por este endpoint", () => {
  // Una sesión robada podría usarla para quedarse con la cuenta. El camino es
  // recuperar la contraseña, que exige acceso al mail.
  const rechazo = evaluar({
    rolesDelActor: ["secretary"],
    rolesActuales: ["secretary"],
    rolesPedidos: ["secretary"],
    esAutoedicion: true,
    cambiaPassword: true,
  });

  assert.equal(rechazo?.status, 400);
  assert.match(rechazo.error, /recuperarla desde el login/i);
});

test("un admin sí puede resetear la contraseña de una secretaria", () => {
  assert.equal(evaluar({ cambiaPassword: true }), null);
});

// ── Helpers ─────────────────────────────────────────────────────────────────

test("mismosRoles ignora el orden y los repetidos", () => {
  assert.equal(mismosRoles(["admin", "secretary"], ["secretary", "admin"]), true);
  assert.equal(mismosRoles(["admin", "admin"], ["admin"]), true);
  assert.equal(mismosRoles(["admin"], ["admin", "secretary"]), false);
  assert.equal(mismosRoles([], []), true);
});

test("codigosDeRol lee la forma que devuelve Prisma y tolera ausencias", () => {
  assert.deepEqual(
    codigosDeRol({ roles: [{ role: { code: "admin" } }, { role: { code: "secretary" } }] }),
    ["admin", "secretary"],
  );
  assert.deepEqual(codigosDeRol({ roles: [{ role: null }] }), []);
  assert.deepEqual(codigosDeRol({}), []);
  assert.deepEqual(codigosDeRol(null), []);
});

test("esSuperadmin distingue al dueño de la clínica", () => {
  assert.equal(esSuperadmin({ roles: [{ role: { code: "superadmin" } }] }), true);
  assert.equal(esSuperadmin({ roles: [{ role: { code: "admin" } }] }), false);
  assert.equal(esSuperadmin(null), false);
});
