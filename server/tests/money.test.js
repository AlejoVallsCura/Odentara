// Saldos con más de una moneda.
//
// Lo que estos tests protegen es una sola regla, y es la que más plata puede
// costar si se rompe: **los importes de monedas distintas nunca se suman**.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizarMoneda,
  formatearMonto,
  resumirPorMoneda,
  balanceGeneral,
  etiquetaDeSaldo,
  MONEDA_POR_DEFECTO,
} = require("../../shared/money");

const mov = (type, amount, currency) => ({ type, amount, currency });

test("pesos y dólares dan saldos separados, nunca sumados", () => {
  const r = resumirPorMoneda([
    mov("debt", 85000, "ARS"),
    mov("debt", 300, "USD"),
    mov("payment", 5000, "ARS"),
  ]);

  assert.equal(r.length, 2);
  const ars = r.find((x) => x.moneda === "ARS");
  const usd = r.find((x) => x.moneda === "USD");

  assert.equal(ars.deuda, 85000);
  assert.equal(ars.pagado, 5000);
  assert.equal(ars.balance, 80000);

  assert.equal(usd.deuda, 300);
  assert.equal(usd.balance, 300);

  // La comprobación que importa: en ningún lado aparece 85300
  assert.ok(!r.some((x) => x.balance === 85300 || x.deuda === 85300));
});

test("un pago en dólares no cancela una deuda en pesos", () => {
  const r = resumirPorMoneda([mov("debt", 1000, "ARS"), mov("payment", 1000, "USD")]);
  assert.equal(r.find((x) => x.moneda === "ARS").balance, 1000, "la deuda en pesos sigue entera");
  assert.equal(r.find((x) => x.moneda === "USD").balance, -1000, "y queda saldo a favor en dólares");
});

test("los movimientos sin moneda cuentan como pesos", () => {
  // Es el caso de todo lo cargado antes de que existiera el selector.
  const r = resumirPorMoneda([mov("debt", 500, undefined), mov("debt", 500, "")]);
  assert.equal(r.length, 1);
  assert.equal(r[0].moneda, MONEDA_POR_DEFECTO);
  assert.equal(r[0].deuda, 1000);
});

test("una moneda desconocida no hace desaparecer el movimiento del saldo", () => {
  // Preferimos contarlo mal como peso antes que perderlo: un importe que no
  // aparece en ningún saldo es mucho peor que uno mal clasificado.
  const r = resumirPorMoneda([mov("debt", 700, "EUR")]);
  assert.equal(r.length, 1);
  assert.equal(r[0].moneda, "ARS");
  assert.equal(r[0].deuda, 700);
});

test("normalizarMoneda acepta minúsculas y espacios", () => {
  assert.equal(normalizarMoneda(" usd "), "USD");
  assert.equal(normalizarMoneda("ars"), "ARS");
  assert.equal(normalizarMoneda(null), "ARS");
});

test("los pesos se listan primero", () => {
  const r = resumirPorMoneda([mov("debt", 1, "USD"), mov("debt", 1, "ARS")]);
  assert.equal(r[0].moneda, "ARS");
});

test("el símbolo distingue las dos monedas", () => {
  assert.equal(formatearMonto(1000, "ARS"), "$1.000");
  assert.equal(formatearMonto(1000, "USD"), "US$1.000");
  // Sin símbolo, un número suelto se lee como la moneda que uno tenga en la
  // cabeza. Por eso va siempre, también en pesos.
  assert.ok(formatearMonto(1000, "ARS").startsWith("$"));
});

test("etiquetaDeSaldo nombra la moneda en cada estado", () => {
  assert.match(etiquetaDeSaldo(300, "USD").texto, /Debe US\$300/);
  assert.match(etiquetaDeSaldo(-300, "USD").texto, /A favor US\$300/);
  assert.equal(etiquetaDeSaldo(0, "USD").texto, "Al día");
});

test("sin movimientos no hay ninguna moneda", () => {
  assert.deepEqual(resumirPorMoneda([]), []);
});

// ── Balance de la plataforma: cobros contra gastos ──────────────────────────
//
// Es el número que dice si el negocio gana o pierde. La misma regla de siempre:
// pesos y dólares no se suman entre sí.

const monto = (amount, currency) => ({ amount, currency });

test("ingresos y gastos dan un neto por cada moneda", () => {
  const r = balanceGeneral(
    [monto(300000, "ARS"), monto(500, "USD")],
    [monto(80000, "ARS"), monto(120, "USD")]
  );

  assert.equal(r.length, 2);
  const ars = r.find((x) => x.moneda === "ARS");
  const usd = r.find((x) => x.moneda === "USD");

  assert.equal(ars.ingresos, 300000);
  assert.equal(ars.gastos, 80000);
  assert.equal(ars.neto, 220000);

  assert.equal(usd.neto, 380);

  // Lo que no puede pasar: un neto de 220380, que no significa nada.
  assert.ok(!r.some((x) => x.neto === 220380));
});

test("un gasto en una moneda sin ingresos aparece igual", () => {
  // Si el renglón no estuviera, ese gasto sería invisible y el resultado del
  // negocio se vería mejor de lo que es.
  const r = balanceGeneral([monto(300000, "ARS")], [monto(200, "USD")]);
  const usd = r.find((x) => x.moneda === "USD");
  assert.ok(usd, "tiene que existir el renglón en dólares");
  assert.equal(usd.ingresos, 0);
  assert.equal(usd.neto, -200);
});

test("gastar más de lo que entra da neto negativo, no cero", () => {
  const r = balanceGeneral([monto(50000, "ARS")], [monto(80000, "ARS")]);
  assert.equal(r[0].neto, -30000);
});

test("sin moneda, cuenta como pesos", () => {
  const r = balanceGeneral([monto(1000)], [monto(400, "")]);
  assert.equal(r.length, 1);
  assert.equal(r[0].moneda, MONEDA_POR_DEFECTO);
  assert.equal(r[0].neto, 600);
});

test("sin movimientos de ningún lado, no hay renglones", () => {
  assert.deepEqual(balanceGeneral([], []), []);
});

test("los pesos se listan primero", () => {
  const r = balanceGeneral([monto(1, "USD")], [monto(1, "ARS")]);
  assert.equal(r[0].moneda, "ARS");
});
