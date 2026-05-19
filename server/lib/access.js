const {
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("./permissions");

function buildProfessionalAccessWhere(permissions) {
  if (canAccessWholeClinic(permissions)) {
    return { deletedAt: null };
  }

  const ids = getAccessibleProfessionalIds(permissions);
  if (ids.length === 0) {
    return { id: -1, deletedAt: null };
  }

  return { id: { in: ids }, deletedAt: null };
}

function buildPatientAccessWhere(permissions, clinicId) {
  return { deletedAt: null, clinicId };
}

function buildAppointmentAccessWhere(permissions) {
  if (canAccessWholeClinic(permissions)) {
    return { deletedAt: null };
  }

  const ids = getAccessibleProfessionalIds(permissions);
  if (ids.length === 0) {
    return { id: -1, deletedAt: null };
  }

  return {
    deletedAt: null,
    professionalId: { in: ids },
  };
}

module.exports = {
  buildProfessionalAccessWhere,
  buildPatientAccessWhere,
  buildAppointmentAccessWhere,
};
