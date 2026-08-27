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
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[FATAL] JWT_SECRET no está configurado. La app no puede firmar tokens.");
  return secret;
}

// Vida del token de sesión. Estaba en 7 días, lo que significaba que un token
// robado servía una semana entera. Se bajó a 24 horas y, para que nadie tenga
// que volver a loguearse todos los días, el middleware lo renueva solo mientras
// la persona sigue usando la app (ver SESSION_RENEW_AFTER_MS en middleware/auth).
const SESSION_TTL = "24h";

function signToken(payload, options = {}) {
  const jti = crypto.randomBytes(16).toString("hex");
  return jwt.sign({ ...payload, jti }, getJwtSecret(), { expiresIn: SESSION_TTL, ...options });
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
  const assignedProfessionalId = user.assignedProfessional?.id || null;
  const isSuperadmin = roles.includes("superadmin");
  const isAdmin = roles.includes("admin");
  const isSecretary = roles.includes("secretary");
  const isProfessional = roles.includes("professional");
  const isPlatformAdmin = user.isPlatformAdmin || false;

  // Si el usuario tiene algún profesional asignado (por "Asignar Profesionales"
  // o por el vínculo directo del rol Profesional), queda restringido a esos
  // profesionales — el rol Admin ya NO pisa esa restricción. Solo ve toda la
  // clínica si no se le asignó ningún profesional, igual que Secretaria.
  const hasProfessionalScope = allowedProfessionalIds.length > 0 || Boolean(assignedProfessionalId);

  return {
    roles,
    allowedProfessionalIds,
    assignedProfessionalId,
    assignedProfessionalName: user.assignedProfessional?.fullName || null,
    clinicId: user.clinicId || null,
    isPlatformAdmin,
    canAccessWholeClinic:
      isSuperadmin ||
      ((isAdmin || isSecretary) && !hasProfessionalScope),
    isSuperadmin,
    isAdmin,
    isSecretary,
    isProfessional,
  };
}

// El canje entre subdominios ya no usa un JWT que encapsula otro JWT. Pasó a
// ser un token opaco de un solo uso guardado en base (lib/single-use-token.js):
// el anterior era reutilizable dentro de sus 2 minutos y la URL con el codigo
// queda en los logs del reverse proxy.

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
  signClinicSelectionToken,
  verifyClinicSelectionToken,
  serializeUser,
  buildPermissionSummary,
};
