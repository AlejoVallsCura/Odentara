const crypto = require("crypto");
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

function signToken(payload, options = {}) {
  const jti = crypto.randomBytes(16).toString("hex");
  return jwt.sign({ ...payload, jti }, getJwtSecret(), { expiresIn: "7d", ...options });
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
    isPlatformAdmin: user.isPlatformAdmin || false,
    clinicId: user.clinicId || null,
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
  const isPlatformAdmin = user.isPlatformAdmin || false;

  return {
    roles,
    allowedProfessionalIds,
    assignedProfessionalId: user.assignedProfessional?.id || null,
    assignedProfessionalName: user.assignedProfessional?.fullName || null,
    clinicId: user.clinicId || null,
    isPlatformAdmin,
    canAccessWholeClinic:
      isSuperadmin ||
      ((isAdmin || isSecretary) && allowedProfessionalIds.length === 0),
    isSuperadmin,
    isAdmin,
    isSecretary,
    isProfessional,
  };
}

/**
 * Crea un token de intercambio de corta vida (2 min) que encapsula el JWT real.
 * Se usa para pasar el token al subdominio de clínica via URL sin exponer el JWT principal.
 * No requiere estado en el servidor — es auto-validante por firma.
 */
function signExchangeToken(rawJwt) {
  return jwt.sign({ xjwt: rawJwt }, getJwtSecret(), { expiresIn: "2m" });
}

/**
 * Verifica el token de intercambio y devuelve el JWT original.
 * Lanza error si el token es inválido o expiró.
 */
function verifyExchangeToken(exchangeToken) {
  const payload = jwt.verify(exchangeToken, getJwtSecret());
  if (!payload.xjwt) throw new Error("Exchange token sin JWT embebido");
  return payload.xjwt;
}

/**
 * Token de corta vida (10 min) que acredita que el usuario verificó su contraseña
 * y puede elegir entre las clínicas listadas en `userIds`.
 */
function signClinicSelectionToken(userIds) {
  return jwt.sign({ type: "clinic-selection", userIds }, getJwtSecret(), { expiresIn: "10m" });
}

function verifyClinicSelectionToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  if (payload.type !== "clinic-selection" || !Array.isArray(payload.userIds)) {
    throw new Error("Token de selección inválido");
  }
  return payload;
}

module.exports = {
  normalizeEmail,
  signToken,
  verifyToken,
  signExchangeToken,
  verifyExchangeToken,
  signClinicSelectionToken,
  verifyClinicSelectionToken,
  serializeUser,
  buildPermissionSummary,
};
