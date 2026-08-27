"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  CARAS_DENTALES,
  normalizarCaraDental,
  clavePosicionOdontograma,
} = require("../../shared/tooth-faces");

test("el contrato compartido incluye la cara palatina P", () => {
  assert.ok(CARAS_DENTALES.includes("P"));
  assert.equal(normalizarCaraDental("P"), "P");
});

test("una cara desconocida se rechaza en vez de convertirse en pieza completa", () => {
  assert.equal(normalizarCaraDental("X"), undefined);
  assert.equal(normalizarCaraDental(null), null);
});

test("la clave de posición distingue una cara de la pieza completa", () => {
  assert.equal(clavePosicionOdontograma("16", "P"), "16|P");
  assert.equal(clavePosicionOdontograma("16", null), "16|_");
});

