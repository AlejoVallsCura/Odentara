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

function buildProfessionalAccessWhere(permissions, clinicId) {
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
  return { deletedAt: null, clinicId };
}

function buildAppointmentAccessWhere(permissions, clinicId) {
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

module.exports = {
  buildProfessionalAccessWhere,
  buildPatientAccessWhere,
  buildAppointmentAccessWhere,
};
