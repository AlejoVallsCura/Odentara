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

function buildPatientAccessWhere(permissions) {
  if ((permissions?.roles || []).includes("secretary")) {
    return { deletedAt: null };
  }

  if (canAccessWholeClinic(permissions)) {
    return { deletedAt: null };
  }

  const professionalIds = getAccessibleProfessionalIds(permissions);
  if (professionalIds.length === 0) {
    return { id: -1, deletedAt: null };
  }

  return {
    deletedAt: null,
    OR: [
      { appointments: { some: { professionalId: { in: professionalIds }, deletedAt: null } } },
      { treatments: { some: { professionalId: { in: professionalIds }, deletedAt: null } } },
      { billingEntries: { some: { professionalId: { in: professionalIds }, deletedAt: null } } },
      {
        AND: [
          { appointments: { none: { deletedAt: null } } },
          { treatments: { none: { deletedAt: null } } },
          { billingEntries: { none: { deletedAt: null } } },
        ],
      },
    ],
  };
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
