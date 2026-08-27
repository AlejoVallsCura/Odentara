// Descuento por clínica sobre el precio del plan.
//
// El descuento es un PORCENTAJE y no un monto fijo, y esa es la decisión que
// manda sobre todo lo demás: cuando sube el precio del plan, el descuento tiene
// que seguir valiendo lo mismo en proporción. Con un monto fijo, un "10% de
// descuento" pactado hoy se convierte solo en 8% el día que el plan aumenta, sin
// que nadie lo haya decidido ni lo vea venir.
//
// Vive en shared/ porque el mismo cálculo lo necesitan el servidor (ingresos
// estimados, monto sugerido de cobro) y el navegador (vista previa mientras se
// edita la clínica). Dos implementaciones del mismo redondeo es la forma más
// fácil de que el panel muestre un número y se cobre otro.

const DESCUENTO_MINIMO = 0.1;
const DESCUENTO_MAXIMO = 100;

/**
 * Deja el descuento en su forma canónica: un número entre 0,1 y 100, o null.
 *
 * El 0 se normaliza a null a propósito. Son lo mismo —no hay descuento— y tener
 * dos representaciones de lo mismo obliga a preguntar por las dos en cada lugar
 * donde se usa; con una sola sobra `if (descuento)`.
 *
 * Devuelve null también para basura (texto, NaN, negativos): un descuento que no
 * se entiende es no tener descuento, nunca uno inventado.
 */
function normalizarDescuento(valor) {
  if (valor === null || valor === undefined || valor === "") return null;

  const numero = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0) return null;

  // Dos decimales: es lo que guarda la base (Decimal(5,2)) y no tiene sentido
  // que la pantalla acepte una precisión que después se pierde al guardar.
  const redondeado = Math.round(numero * 100) / 100;

  if (redondeado < DESCUENTO_MINIMO) return null;
  if (redondeado > DESCUENTO_MAXIMO) return DESCUENTO_MAXIMO;
  return redondeado;
}

const centavos = (n) => Math.round(n * 100) / 100;

/**
 * Precio final de una clínica: el del plan, menos su descuento.
 *
 * Se redondea el AHORRO y el final sale de restar, en vez de redondear los dos
 * por separado. Así `final + ahorro === base` siempre, exacto. Redondeando cada
 * uno por su lado, un 33,33% sobre $129.000 da dos números que no cierran por un
 * centavo, y ese centavo aparece más tarde como una diferencia inexplicable
 * entre lo que dice el panel y lo que se registró como cobro.
 */
function calcularPrecio(precioBase, descuento) {
  const base = Number.isFinite(Number(precioBase)) ? centavos(Number(precioBase)) : 0;
  const porcentaje = normalizarDescuento(descuento);

  if (!porcentaje) {
    return { base, porcentaje: null, ahorro: 0, final: base, bonificada: false };
  }

  const ahorro = centavos((base * porcentaje) / 100);
  return {
    base,
    porcentaje,
    ahorro,
    final: centavos(base - ahorro),
    bonificada: porcentaje >= DESCUENTO_MAXIMO,
  };
}

/**
 * "10%", "0,5%", "12,5%". Coma decimal, que es como se escribe acá, y sin
 * decimales cuando son cero — "10,00%" se lee como si la precisión importara.
 */
function formatearPorcentaje(descuento) {
  const porcentaje = normalizarDescuento(descuento);
  if (!porcentaje) return "";
  const texto = Number.isInteger(porcentaje)
    ? String(porcentaje)
    : String(porcentaje).replace(".", ",");
  return `${texto}%`;
}

/**
 * Texto corto para la etiqueta de la lista de clínicas. El 100% se nombra
 * "Bonificada" y no "100% OFF": es un estado distinto —no paga— y conviene que
 * salte a la vista en una tabla, no que haya que leer el número.
 */
function etiquetaDescuento(descuento) {
  const porcentaje = normalizarDescuento(descuento);
  if (!porcentaje) return "";
  return porcentaje >= DESCUENTO_MAXIMO ? "Bonificada" : `${formatearPorcentaje(porcentaje)} OFF`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DESCUENTO_MINIMO,
    DESCUENTO_MAXIMO,
    normalizarDescuento,
    calcularPrecio,
    formatearPorcentaje,
    etiquetaDescuento,
  };
}
