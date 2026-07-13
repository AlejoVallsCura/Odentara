// Tests de lib/permissions y user.service — correr con: npm test
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  hasRole,
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
  canManagePatients,
  canManageBilling,
  canDeletePatient,
  canEditClinicalData,
} = require("../lib/permissions");

const { normalizeRequestedRoles, ROLE_ALIASES } = require("../services/user.service");

// ── normalizeRequestedRoles ───────────────────────────────────────────────────

test("normalizeRequestedRoles traduce aliases en español", () => {
  assert.deepEqual(normalizeRequestedRoles(["profesional"]), ["professional"]);
  assert.deepEqual(normalizeRequestedRoles(["secretario"]), ["secretary"]);
  assert.deepEqual(normalizeRequestedRoles(["administrador"]), ["admin"]);
});

test("normalizeRequestedRoles deduplica y descarta inválidos", () => {
  assert.deepEqual(
    normalizeRequestedRoles(["admin", "administrador", "hacker", "", null]),
    ["admin"],
  );
});

test("normalizeRequestedRoles es case-insensitive y trimea", () => {
  assert.deepEqual(normalizeRequestedRoles(["  SUPERADMIN  "]), ["superadmin"]);
});

test("ROLE_ALIASES no permite escalar a roles inexistentes", () => {
  for (const target of Object.values(ROLE_ALIASES)) {
    assert.ok(["superadmin", "admin", "secretary", "professional"].includes(target));
  }
});

// ── Jerarquía de permisos ─────────────────────────────────────────────────────

test("canDeletePatient: solo superadmin", () => {
  assert.equal(canDeletePatient({ roles: ["superadmin"] }), true);
  assert.equal(canDeletePatient({ roles: ["admin"] }), false);
  assert.equal(canDeletePatient({ roles: ["secretary"] }), false);
  assert.equal(canDeletePatient({ roles: ["professional"] }), false);
});

test("canManageBilling: superadmin y admin, no secretary ni professional", () => {
  assert.equal(canManageBilling({ roles: ["superadmin"] }), true);
  assert.equal(canManageBilling({ roles: ["admin"] }), true);
  assert.equal(canManageBilling({ roles: ["secretary"] }), false);
  assert.equal(canManageBilling({ roles: ["professional"] }), false);
});

test("canManagePatients: todos menos professional solo", () => {
  assert.equal(canManagePatients({ roles: ["secretary"] }), true);
  assert.equal(canManagePatients({ roles: ["professional"] }), false);
});

test("canEditClinicalData: solo professional y superadmin", () => {
  assert.equal(canEditClinicalData({ roles: ["professional"] }), true);
  assert.equal(canEditClinicalData({ roles: ["superadmin"] }), true);
  assert.equal(canEditClinicalData({ roles: ["admin"] }), false);
  assert.equal(canEditClinicalData({ roles: ["secretary"] }), false);
});

// ── Helpers de acceso ─────────────────────────────────────────────────────────

test("hasRole tolera permissions null o sin roles", () => {
  assert.equal(hasRole(null, "admin"), false);
  assert.equal(hasRole({}, "admin"), false);
});

test("canAccessWholeClinic requiere flag explícito", () => {
  assert.equal(canAccessWholeClinic({ canAccessWholeClinic: true }), true);
  assert.equal(canAccessWholeClinic({}), false);
  assert.equal(canAccessWholeClinic(null), false);
});

test("getAccessibleProfessionalIds une allowed + assigned sin duplicar", () => {
  const ids = getAccessibleProfessionalIds({
    allowedProfessionalIds: [1, 2],
    assignedProfessionalId: 2,
  });
  assert.deepEqual(ids.sort(), [1, 2]);
});

test("getAccessibleProfessionalIds con permissions vacío devuelve []", () => {
  assert.deepEqual(getAccessibleProfessionalIds(null), []);
  assert.deepEqual(getAccessibleProfessionalIds({}), []);
});
