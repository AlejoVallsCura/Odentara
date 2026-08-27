const {
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("./permissions");

/**
 * Todas las funciones reciben `clinicId` de req.user.clinicId para aislar
 * datos por clínica. En modo "shared DB" esto es crítico; en modo
 * "dedicated DB" el clinicId siempre es el mismo pero se mantiene
 * por consistencia de schema.
 */

/**
 * Filtro que no coincide con ninguna fila, para usuarios sin clínica asignada
 * (el administrador de plataforma). Antes esos casos armaban `clinicId: null`,
 * que Prisma rechaza porque la columna no admite nulos: la consulta fallaba con
 * "Argument `clinicId` is missing" y el endpoint devolvía 500. Como el panel de
 * plataforma sincroniza al entrar, eso llenaba los logs de errores falsos que
 * después dificultan ver los reales.
 */
const NO_ACCESS_WHERE = { id: -1, deletedAt: null };

function hasClinic(clinicId) {
  return clinicId !== null && clinicId !== undefined;
}

function buildProfessionalAccessWhere(permissions, clinicId) {
  if (!hasClinic(clinicId)) return NO_ACCESS_WHERE;

  if (canAccessWholeClinic(permissions)) {
    return { deletedAt: null, clinicId };
  }

  const ids = getAccessibleProfessionalIds(permissions);
  if (ids.length === 0) {
    return { id: -1, clinicId, deletedAt: null };
  }

  return { id: { in: ids }, clinicId, deletedAt: null };
}

function buildPatientAccessWhere(permissions, clinicId) {
  if (!hasClinic(clinicId)) return NO_ACCESS_WHERE;

  return { deletedAt: null, clinicId };
}

function buildAppointmentAccessWhere(permissions, clinicId) {
  if (!hasClinic(clinicId)) return NO_ACCESS_WHERE;

  if (canAccessWholeClinic(permissions)) {
    return { clinicId, deletedAt: null };
  }

  const ids = getAccessibleProfessionalIds(permissions);
  if (ids.length === 0) {
    return { id: -1, clinicId, deletedAt: null };
  }

  return {
    clinicId,
    deletedAt: null,
    professionalId: { in: ids },
  };
}

/**
 * Las dos funciones que siguen devuelven FRAGMENTOS para spreadear dentro de un
 * `where`, no un `where` completo como las tres de arriba. Se combinan siempre
 * con `patient: buildPatientAccessWhere(...)`, que es lo que aísla por clínica.
 *
 * Son dos y no una con un parámetro booleano a propósito: la diferencia entre
 * ellas es una decisión de negocio sobre a quién pertenece cada registro, y un
 * `{ compartido: true }` en el call site escondería esa decisión justo donde
 * nadie la lee. El nombre de la función tiene que decir cuál regla se aplica.
 *
 * @param {object} permissions
 * @param {{ filterProfessionalId?: unknown }} [options] Filtro de VISUALIZACIÓN
 *   opcional (viene de la query string). No restringe el acceso: solo se aplica
 *   a quien ya ve toda la clínica, para que pueda mirar un profesional puntual.
 */

/**
 * Registros que pertenecen a UN profesional: recetas, presupuestos, facturación.
 * Un profesional no ve ni toca los de un colega, aunque compartan el paciente.
 */
function buildOwnedRecordWhere(permissions, options = {}) {
  if (canAccessWholeClinic(permissions)) {
    const filterId = normalizeFilterId(options.filterProfessionalId);
    return filterId === null ? {} : { professionalId: filterId };
  }

  // `{ in: [] }` no matchea ninguna fila, que es exactamente lo que se quiere
  // para un usuario sin profesionales accesibles.
  return { professionalId: { in: getAccessibleProfessionalIds(permissions) } };
}

/**
 * Registros de la ficha del paciente, compartidos por la clínica: archivos
 * clínicos. Los que tienen profesional asignado son de ese profesional; los que
 * quedaron sin asignar (professionalId null) los maneja cualquiera con permiso.
 */
function buildSharedRecordWhere(permissions, options = {}) {
  if (canAccessWholeClinic(permissions)) {
    const filterId = normalizeFilterId(options.filterProfessionalId);
    return filterId === null ? {} : { professionalId: filterId };
  }

  return {
    OR: [
      { professionalId: { in: getAccessibleProfessionalIds(permissions) } },
      { professionalId: null },
    ],
  };
}

/**
 * Un id inválido se ignora en vez de propagarse como NaN. Antes cada call site
 * hacía `Number(req.query.professionalId)` sin validar y un valor no numérico
 * llegaba a Prisma como NaN, que respondía 500 en lugar de ignorar el filtro.
 */
function normalizeFilterId(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * ¿Puede el usuario ACTUAR EN NOMBRE de este profesional?
 *
 * Distinta de las funciones de arriba: esas filtran qué se lee, esta autoriza a
 * qué profesional se le atribuye algo que se escribe. Importa sobre todo en
 * recetas, donde el profesional elegido aporta su matrícula al documento.
 *
 * Estaba duplicada palabra por palabra en billing.service.js y en routes/
 * treatments.js, y no existía en recetas —que es justo donde más pesaba—. Vive
 * acá para que agregar una regla nueva la aplique en los tres lugares.
 *
 * Un professionalId vacío se permite: hay registros que no llevan profesional
 * asignado. Donde el campo es obligatorio, eso ya lo exige la validación previa.
 */
function canUseProfessional(permissions, professionalId) {
  if (!professionalId) return true;
  if (canAccessWholeClinic(permissions)) return true;
  return getAccessibleProfessionalIds(permissions).includes(Number(professionalId));
}

module.exports = {
  canUseProfessional,
  buildProfessionalAccessWhere,
  buildPatientAccessWhere,
  buildAppointmentAccessWhere,
  buildOwnedRecordWhere,
  buildSharedRecordWhere,
};
