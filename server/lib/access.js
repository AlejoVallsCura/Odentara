const {
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("./permissions");

function buildProfessionalAccessWhere(permissions) {
  if (canAccessWholeClinic(permissions)) {
    return {};
  }

  const ids = getAccessibleProfessionalIds(permissions);
  if (ids.length === 0) {
    return { id: -1 };
  }

  return { id: { in: ids } };
}

function buildPatientAccessWhere(permissions) {
  if (canAccessWholeClinic(permissions)) {
    return {};
  }

  const professionalIds = getAccessibleProfessionalIds(permissions);
  if (professionalIds.length === 0) {
    return { id: -1 };
  }

  return {
    OR: [
      { appointments: { some: { professionalId: { in: professionalIds } } } },
      { treatments: { some: { professionalId: { in: professionalIds } } } },
      { billingEntries: { some: { professionalId: { in: professionalIds } } } },
    ],
  };
}

function buildAppointmentAccessWhere(permissions) {
  if (canAccessWholeClinic(permissions)) {
    return {};
  }

  const ids = getAccessibleProfessionalIds(permissions);
  if (ids.length === 0) {
    return { id: -1 };
  }

  return {
    professionalId: { in: ids },
  };
}

module.exports = {
  buildProfessionalAccessWhere,
  buildPatientAccessWhere,
  buildAppointmentAccessWhere,
};
