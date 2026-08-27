// Red de seguridad del scoping por profesional.
//
// Estos tests existen para que un refactor no pueda ampliar en silencio el
// alcance de una consulta sobre datos clínicos. Describen el comportamiento que
// tenían los fragmentos inline en routes/ antes de extraerse: si alguno falla,
// el refactor cambió quién ve qué.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOwnedRecordWhere,
  buildSharedRecordWhere,
  buildPatientAccessWhere,
  canUseProfessional,
} = require("../lib/access");

const WHOLE_CLINIC = { canAccessWholeClinic: true, allowedProfessionalIds: [] };
const SCOPED = { canAccessWholeClinic: false, allowedProfessionalIds: [7, 9] };
const SCOPED_SIN_IDS = { canAccessWholeClinic: false, allowedProfessionalIds: [] };

// ── buildOwnedRecordWhere: recetas, presupuestos, facturación ────────────────

test("owned: quien ve toda la clínica no queda restringido", () => {
  assert.deepEqual(buildOwnedRecordWhere(WHOLE_CLINIC), {});
});

test("owned: un profesional solo ve los registros propios", () => {
  assert.deepEqual(buildOwnedRecordWhere(SCOPED), { professionalId: { in: [7, 9] } });
});

test("owned: sin profesionales accesibles no matchea NINGUNA fila", () => {
  // `{ in: [] }` no devuelve resultados. Es el caso de un usuario mal
  // configurado: tiene que ver cero, nunca todo.
  assert.deepEqual(buildOwnedRecordWhere(SCOPED_SIN_IDS), { professionalId: { in: [] } });
});

test("owned: incluye el assignedProfessionalId además de los allowed", () => {
  assert.deepEqual(
    buildOwnedRecordWhere({ canAccessWholeClinic: false, allowedProfessionalIds: [7], assignedProfessionalId: 3 }),
    { professionalId: { in: [7, 3] } },
  );
});

test("owned: el filtro de visualización solo aplica a quien ve toda la clínica", () => {
  assert.deepEqual(
    buildOwnedRecordWhere(WHOLE_CLINIC, { filterProfessionalId: "4" }),
    { professionalId: 4 },
  );
});

test("owned: un usuario scopeado NO puede ampliar su alcance con el filtro", () => {
  // El caso que hay que blindar: pasar ?professionalId=99 no debe dar acceso a
  // los registros del profesional 99.
  assert.deepEqual(
    buildOwnedRecordWhere(SCOPED, { filterProfessionalId: "99" }),
    { professionalId: { in: [7, 9] } },
  );
});

// ── buildSharedRecordWhere: archivos clínicos ───────────────────────────────

test("shared: quien ve toda la clínica no queda restringido", () => {
  assert.deepEqual(buildSharedRecordWhere(WHOLE_CLINIC), {});
});

test("shared: un profesional ve los propios MÁS los que no tienen dueño", () => {
  assert.deepEqual(buildSharedRecordWhere(SCOPED), {
    OR: [{ professionalId: { in: [7, 9] } }, { professionalId: null }],
  });
});

test("shared: sin ids accesibles sigue viendo los archivos sin dueño", () => {
  // Diferencia deliberada con owned: un archivo sin profesional asignado es de
  // la ficha del paciente, no de nadie en particular.
  assert.deepEqual(buildSharedRecordWhere(SCOPED_SIN_IDS), {
    OR: [{ professionalId: { in: [] } }, { professionalId: null }],
  });
});

test("shared: un usuario scopeado NO puede ampliar su alcance con el filtro", () => {
  assert.deepEqual(buildSharedRecordWhere(SCOPED, { filterProfessionalId: "99" }), {
    OR: [{ professionalId: { in: [7, 9] } }, { professionalId: null }],
  });
});

// ── owned y shared NO son intercambiables ───────────────────────────────────

test("owned y shared difieren para un usuario scopeado", () => {
  // Si alguna vez estos dos son iguales, se colapsó una regla de negocio:
  // las recetas pasarían a ser visibles como los archivos compartidos.
  assert.notDeepEqual(buildOwnedRecordWhere(SCOPED), buildSharedRecordWhere(SCOPED));
});

// ── normalización del filtro ────────────────────────────────────────────────

test("un filtro no numérico se ignora en vez de llegar como NaN a Prisma", () => {
  for (const invalido of ["abc", "", null, undefined, "1.5", {}]) {
    assert.deepEqual(
      buildOwnedRecordWhere(WHOLE_CLINIC, { filterProfessionalId: invalido }),
      {},
      `filtro inválido no ignorado: ${JSON.stringify(invalido)}`,
    );
  }
});

// ── buildPatientAccessWhere: aislamiento por clínica ────────────────────────

test("sin clínica asignada no se accede a ningún paciente", () => {
  // El administrador de plataforma no tiene clinicId.
  assert.deepEqual(buildPatientAccessWhere(WHOLE_CLINIC, null), { id: -1, deletedAt: null });
  assert.deepEqual(buildPatientAccessWhere(WHOLE_CLINIC, undefined), { id: -1, deletedAt: null });
});

test("con clínica asignada se filtra por clinicId", () => {
  assert.deepEqual(buildPatientAccessWhere(SCOPED, 12), { deletedAt: null, clinicId: 12 });
});

test("clinicId 0 no se confunde con ausencia de clínica", () => {
  assert.deepEqual(buildPatientAccessWhere(SCOPED, 0), { deletedAt: null, clinicId: 0 });
});

// -----------------------------------------------------------------------------
// canUseProfessional — a nombre de QUIÉN se puede escribir
// -----------------------------------------------------------------------------
//
// Estos tests vivían en billing.service.test.js, cuando la función estaba
// duplicada ahí y en routes/treatments.js. Al unificarla en lib/access se
// mudaron con ella: es la única copia y estos son sus tests.
//
// Lo que protegen es que un profesional con alcance restringido no pueda
// atribuirle a un colega algo que escribe él. En recetas eso significa firmar
// con la matrícula ajena.

test("canUseProfessional permite si tiene acceso a toda la clínica", () => {
  assert.equal(canUseProfessional({ canAccessWholeClinic: true }, 99), true);
});
test("canUseProfessional permite solo profesionales asignados", () => {
  const perms = { canAccessWholeClinic: false, allowedProfessionalIds: [1, 2] };
  assert.equal(canUseProfessional(perms, 1), true);
  assert.equal(canUseProfessional(perms, 3), false);
});
test("canUseProfessional castea el id a número (viene de req.body)", () => {
  const perms = { canAccessWholeClinic: false, allowedProfessionalIds: [5] };
  assert.equal(canUseProfessional(perms, "5"), true);
});
test("canUseProfessional sin professionalId siempre permite", () => {
  assert.equal(canUseProfessional({ canAccessWholeClinic: false }, null), true);
});
