// Descuento por clínica.
//
// La regla que protegen estos tests: el descuento es una PROPORCIÓN del precio
// del plan, así que cuando el plan aumenta el descuento acompaña solo. Y la
// segunda, más chica pero más molesta si se rompe: lo que se ahorra más lo que
// se paga tiene que dar exactamente el precio de lista, sin centavos sueltos.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  DESCUENTO_MAXIMO,
  normalizarDescuento,
  calcularPrecio,
  formatearPorcentaje,
  etiquetaDescuento,
} = require("../../shared/plan-pricing");

test("el ejemplo del pedido: Pro a 129.000 con 10% descuenta 12.900", () => {
  const r = calcularPrecio(129000, 10);
  assert.equal(r.ahorro, 12900);
  assert.equal(r.final, 116100);
  assert.equal(r.bonificada, false);
});

test("el descuento se mantiene cuando aumenta el plan", () => {
  // Es la razón de ser del porcentaje. Con un monto fijo de $12.900, el mismo
  // acuerdo pasaría a ser 8,3% después del aumento sin que nadie lo decida.
  const antes = calcularPrecio(129000, 10);
  const despues = calcularPrecio(155000, 10);

  assert.equal(despues.ahorro, 15500);
  assert.equal(despues.final, 139500);
  assert.equal(antes.ahorro / antes.base, despues.ahorro / despues.base, "misma proporción");
});

test("100% deja la clínica bonificada, sin pagar nada", () => {
  const r = calcularPrecio(129000, 100);
  assert.equal(r.final, 0);
  assert.equal(r.ahorro, 129000);
  assert.equal(r.bonificada, true);
  assert.equal(etiquetaDescuento(100), "Bonificada");
});

test("lo que se paga más lo que se ahorra da el precio de lista, exacto", () => {
  // Un porcentaje con decimales periódicos es donde esto se rompe si se redondea
  // cada parte por su lado.
  for (const porcentaje of [33.33, 7.77, 0.1, 66.67, 12.5]) {
    const r = calcularPrecio(129000, porcentaje);
    assert.equal(r.final + r.ahorro, r.base, `no cierra con ${porcentaje}%`);
  }
});

test("el mínimo es 0,1% y lo que quede por debajo no es descuento", () => {
  assert.equal(normalizarDescuento(0.1), 0.1);
  assert.equal(normalizarDescuento(0.04), null, "0,04 redondea a 0,04 y queda bajo el mínimo");
  assert.equal(normalizarDescuento(0), null);
  assert.equal(calcularPrecio(129000, 0.1).ahorro, 129);
});

test("no se puede descontar más del 100%: nadie le paga a la clínica", () => {
  assert.equal(normalizarDescuento(150), DESCUENTO_MAXIMO);
  assert.equal(calcularPrecio(129000, 150).final, 0);
});

test("un descuento negativo o ilegible es no tener descuento, no uno inventado", () => {
  assert.equal(normalizarDescuento(-10), null);
  assert.equal(normalizarDescuento("gratis"), null);
  assert.equal(normalizarDescuento(NaN), null);
  assert.equal(normalizarDescuento(undefined), null);
  assert.equal(normalizarDescuento(null), null);
  assert.equal(calcularPrecio(129000, "gratis").final, 129000, "se cobra el precio de lista");
});

test("acepta coma decimal, que es como se escribe acá", () => {
  assert.equal(normalizarDescuento("12,5"), 12.5);
  assert.equal(normalizarDescuento("12.5"), 12.5);
});

test("sin descuento, el precio final es el del plan", () => {
  const r = calcularPrecio(129000, null);
  assert.equal(r.final, 129000);
  assert.equal(r.porcentaje, null);
  assert.equal(r.ahorro, 0);
  assert.equal(etiquetaDescuento(null), "");
});

test("una clínica sin plan no tiene precio ni se rompe al descontarle", () => {
  const r = calcularPrecio(0, 50);
  assert.equal(r.base, 0);
  assert.equal(r.final, 0);
  assert.equal(r.ahorro, 0);
});

test("el porcentaje se muestra con coma y sin decimales de relleno", () => {
  assert.equal(formatearPorcentaje(10), "10%");
  assert.equal(formatearPorcentaje(12.5), "12,5%");
  assert.equal(formatearPorcentaje(0.5), "0,5%");
  assert.equal(formatearPorcentaje(100), "100%");
  assert.equal(formatearPorcentaje(null), "");
});

test("etiquetaDescuento distingue rebaja de bonificación", () => {
  assert.equal(etiquetaDescuento(10), "10% OFF");
  assert.equal(etiquetaDescuento(99.99), "99,99% OFF");
  assert.equal(etiquetaDescuento(100), "Bonificada");
});
