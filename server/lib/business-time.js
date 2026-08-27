/**
 * Zona horaria de negocio.
 *
 * Estaba declarada por separado en appointment.service.js y en
 * reminder-scheduler.js. Que dos módulos definan la misma zona por su cuenta es
 * un riesgo concreto: si alguna vez hay que cambiarla y se cambia en uno solo,
 * los recordatorios salen a una hora distinta de la que muestra la agenda, y
 * nada falla de forma visible.
 */

const BUSINESS_TIME_ZONE = "America/Buenos_Aires";

/**
 * Fecha en formato YYYY-MM-DD según la zona de negocio.
 *
 * No usar toISOString().slice(0, 10): eso da la fecha en UTC, y una foto sacada
 * a las 21:30 en Argentina aparecería con la fecha del día siguiente.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatBusinessDate(date) {
  // "en-CA" produce directamente YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

module.exports = { BUSINESS_TIME_ZONE, formatBusinessDate };
