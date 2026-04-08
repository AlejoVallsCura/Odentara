const jwt = require("jsonwebtoken");

function normalizeEmail(email = "") {
  return String(email)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "odentara-dev-secret-change-me";
}

function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function getRoleCodes(user) {
  return (user?.roles || []).map((entry) => entry.role.code);
}

function getAllowedProfessionalIds(user) {
  return (user?.professionalScopes || []).map((scope) => scope.professionalId);
}

function serializeUser(user) {
  const roleCodes = getRoleCodes(user);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    active: user.active,
    roles: roleCodes,
    allowedProfessionalIds: getAllowedProfessionalIds(user),
    assignedProfessionalId: user.assignedProfessional?.id || null,
    assignedProfessionalName: user.assignedProfessional?.fullName || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildPermissionSummary(user) {
  const roles = getRoleCodes(user);
  const allowedProfessionalIds = getAllowedProfessionalIds(user);
  const isSuperadmin = roles.includes("superadmin");
  const isAdmin = roles.includes("admin");
  const isSecretary = roles.includes("secretary");
  const isProfessional = roles.includes("professional");

  return {
    roles,
    allowedProfessionalIds,
    assignedProfessionalId: user.assignedProfessional?.id || null,
    assignedProfessionalName: user.assignedProfessional?.fullName || null,
    canAccessWholeClinic:
      isSuperadmin ||
      ((isAdmin || isSecretary) && allowedProfessionalIds.length === 0),
    isSuperadmin,
    isAdmin,
    isSecretary,
    isProfessional,
  };
}

module.exports = {
  normalizeEmail,
  signToken,
  verifyToken,
  serializeUser,
  buildPermissionSummary,
};
