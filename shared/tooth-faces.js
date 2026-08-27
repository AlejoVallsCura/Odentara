// Contrato único de caras dentales para navegador, API y pruebas.
//
// Una entrada con cara null representa el estado de la pieza completa. No se
// incluye null en CARAS_DENTALES porque no es una cara: se acepta aparte para
// que un valor desconocido nunca termine convertido silenciosamente en ella.

"use strict";

const CARAS_DENTALES = Object.freeze(["M", "D", "V", "P", "O", "I", "L"]);
const CODIGOS_DE_CARA = new Set(CARAS_DENTALES);

function normalizarCaraDental(cara) {
  if (cara === null || cara === undefined || cara === "") return null;
  const codigo = String(cara).trim().toUpperCase();
  return CODIGOS_DE_CARA.has(codigo) ? codigo : undefined;
}

function clavePosicionOdontograma(toothNumber, cara) {
  return `${String(toothNumber)}|${cara ?? "_"}`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CARAS_DENTALES,
    normalizarCaraDental,
    clavePosicionOdontograma,
  };
}

