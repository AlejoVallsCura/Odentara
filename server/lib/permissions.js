function hasRole(permissions, role) {
  return (permissions?.roles || []).includes(role);
}

function canAccessWholeClinic(permissions) {
  return Boolean(permissions?.canAccessWholeClinic);
}

function getAccessibleProfessionalIds(permissions) {
  const ids = new Set(permissions?.allowedProfessionalIds || []);

  if (permissions?.assignedProfessionalId) {
    ids.add(permissions.assignedProfessionalId);
  }

  return [...ids];
}

function canManagePatients(permissions) {
  return (
    hasRole(permissions, "superadmin") ||
    hasRole(permissions, "admin") ||
    hasRole(permissions, "secretary")
  );
}

function canManageProfessionals(permissions) {
  return hasRole(permissions, "superadmin") || hasRole(permissions, "admin");
}

function canViewProfessionals(permissions) {
  return (
    canManageProfessionals(permissions) ||
    hasRole(permissions, "secretary") ||
    hasRole(permissions, "professional")
  );
}

function canManageAppointments(permissions) {
  return (
    hasRole(permissions, "superadmin") ||
    hasRole(permissions, "admin") ||
    hasRole(permissions, "secretary")
  );
}

function canEditAppointments(permissions) {
  return canManageAppointments(permissions) || hasRole(permissions, "professional");
}

function canViewBilling(permissions) {
  return (
    hasRole(permissions, "superadmin") ||
    hasRole(permissions, "admin") ||
    hasRole(permissions, "secretary") ||
    hasRole(permissions, "professional")
  );
}

function canManageBilling(permissions) {
  return (
    hasRole(permissions, "superadmin") ||
    hasRole(permissions, "admin") ||
    hasRole(permissions, "secretary")
  );
}

function canEditClinicalData(permissions) {
  return (
    hasRole(permissions, "superadmin") ||
    hasRole(permissions, "admin") ||
    hasRole(permissions, "secretary") ||
    hasRole(permissions, "professional")
  );
}

function canEditPatient(permissions) {
  return canManagePatients(permissions) || hasRole(permissions, "professional");
}

function canDeletePatient(permissions) {
  return hasRole(permissions, "superadmin");
}

module.exports = {
  hasRole,
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
  canManagePatients,
  canManageProfessionals,
  canViewProfessionals,
  canManageAppointments,
  canEditAppointments,
  canViewBilling,
  canManageBilling,
  canEditClinicalData,
  canEditPatient,
  canDeletePatient,
};
