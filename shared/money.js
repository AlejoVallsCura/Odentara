// Monedas y saldos.
//
// La decisión que ordena todo este archivo: **los saldos NO se suman entre
// monedas**. Un paciente puede deber $85.000 y US$ 300 al mismo tiempo, y esos
// son dos saldos, no uno de 85.300.
//
// La alternativa —convertir todo a una moneda— exige una cotización, y usar la
// del día para movimientos viejos haría que la deuda de un paciente cambie sola
// todas las mañanas sin que nadie toque nada. Si algún día hace falta, el camino
// correcto es guardar la cotización de cada movimiento al cargarlo; mientras
// tanto, dos saldos separados es la respuesta honesta.
//
// Vive en shared/ porque lo usan el navegador (para mostrar y agrupar) y el
// servidor (para validar qué moneda se acepta).

"use strict";

const MONEDAS = [
  { codigo: "ARS", simbolo: "$", label: "Pesos" },
  { codigo: "USD", simbolo: "US$", label: "Dólares" },
];

const MONEDA_POR_DEFECTO = "ARS";

const CODIGOS = new Set(MONEDAS.map((m) => m.codigo));

/**
 * Toda moneda desconocida cae en pesos.
 *
 * Es deliberado que no falle: estos valores vienen de registros viejos y de
 * formularios, y un movimiento con la moneda mal escrita tiene que seguir
 * apareciendo en la cuenta —contarlo como peso es mucho menos grave que
 * hacerlo desaparecer del saldo—.
 */
function normalizarMoneda(valor) {
  const codigo = String(valor || "").trim().toUpperCase();
  return CODIGOS.has(codigo) ? codigo : MONEDA_POR_DEFECTO;
}

function simboloDe(moneda) {
  const encontrada = MONEDAS.find((m) => m.codigo === normalizarMoneda(moneda));
  return encontrada ? encontrada.simbolo : "$";
}

/**
 * Importe con su símbolo. El símbolo va SIEMPRE, incluso en pesos: en una
 * pantalla donde conviven las dos monedas, un número sin símbolo se lee como
 * la moneda que uno tenga en la cabeza, y ahí es donde se cometen los errores.
 */
function formatearMonto(monto, moneda) {
  const numero = Number(monto) || 0;
  return `${simboloDe(moneda)}${numero.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

/**
 * Agrupa movimientos por moneda y devuelve cargos, pagos y saldo de cada una.
 *
 * @param {Array<{type: string, amount: number, currency?: string}>} movimientos
 * @returns {Array<{moneda: string, deuda: number, pagado: number, balance: number}>}
 *          ordenado con pesos primero, que es lo que más se usa.
 */
function resumirPorMoneda(movimientos = []) {
  const porMoneda = new Map();

  for (const mov of movimientos) {
    const moneda = normalizarMoneda(mov.currency);
    if (!porMoneda.has(moneda)) {
      porMoneda.set(moneda, { moneda, deuda: 0, pagado: 0 });
    }
    const acumulado = porMoneda.get(moneda);
    const monto = Number(mov.amount) || 0;

    if (mov.type === "debt") acumulado.deuda += monto;
    else if (mov.type === "income" || mov.type === "payment") acumulado.pagado += monto;
  }

  return [...porMoneda.values()]
    .map((x) => ({ ...x, balance: x.deuda - x.pagado }))
    .sort((a, b) => {
      if (a.moneda === MONEDA_POR_DEFECTO) return -1;
      if (b.moneda === MONEDA_POR_DEFECTO) return 1;
      return a.moneda.localeCompare(b.moneda);
    });
}

/**
 * Balance de la plataforma: lo cobrado contra lo gastado, moneda por moneda.
 *
 * Devuelve un renglón por cada moneda que aparezca en cualquiera de las dos
 * listas — si hubo un gasto en dólares y ningún cobro en dólares, el renglón
 * existe igual con ingresos en 0. Ocultarlo daría la impresión de que ese gasto
 * no pasó.
 *
 * Igual que resumirPorMoneda, no suma entre monedas. Un "total general" que
 * mezcle pesos y dólares no significa nada, y acá el número que sale es el
 * resultado del negocio: es el peor lugar para inventar una conversión con una
 * cotización que nadie eligió.
 *
 * @param {Array<{amount: number, currency?: string}>} ingresos
 * @param {Array<{amount: number, currency?: string}>} gastos
 * @returns {Array<{moneda: string, ingresos: number, gastos: number, neto: number}>}
 */
function balanceGeneral(ingresos = [], gastos = []) {
  const porMoneda = new Map();

  const asegurar = (moneda) => {
    if (!porMoneda.has(moneda)) {
      porMoneda.set(moneda, { moneda, ingresos: 0, gastos: 0 });
    }
    return porMoneda.get(moneda);
  };

  for (const item of ingresos) {
    asegurar(normalizarMoneda(item.currency)).ingresos += Number(item.amount) || 0;
  }
  for (const item of gastos) {
    asegurar(normalizarMoneda(item.currency)).gastos += Number(item.amount) || 0;
  }

  return [...porMoneda.values()]
    .map((x) => ({ ...x, neto: x.ingresos - x.gastos }))
    .sort((a, b) => {
      if (a.moneda === MONEDA_POR_DEFECTO) return -1;
      if (b.moneda === MONEDA_POR_DEFECTO) return 1;
      return a.moneda.localeCompare(b.moneda);
    });
}

/**
 * Etiqueta del estado de un saldo. Positivo = debe, negativo = tiene a favor.
 */
function etiquetaDeSaldo(balance, moneda) {
  if (balance > 0) return { texto: `Debe ${formatearMonto(balance, moneda)}`, estado: "debe" };
  if (balance < 0) return { texto: `A favor ${formatearMonto(Math.abs(balance), moneda)}`, estado: "a-favor" };
  return { texto: "Al día", estado: "al-dia" };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MONEDAS,
    MONEDA_POR_DEFECTO,
    normalizarMoneda,
    simboloDe,
    formatearMonto,
    resumirPorMoneda,
    balanceGeneral,
    etiquetaDeSaldo,
  };
}
