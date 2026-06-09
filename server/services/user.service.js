// =============================================================================
// user.service.js — Lógica de negocio de usuarios
// Normalización de roles y constantes de presentación
// =============================================================================

"use strict";

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------

const ROLE_LABELS = {
  superadmin: "Superadmin",
  admin: "Administrador",
  secretary: "Secretario",
  professional: "Profesional",
};

const ROLE_ALIASES = {
  superadmin:    "superadmin",
  administrador: "admin",
  admin:         "admin",
  secretary:     "secretary",
  secretario:    "secretary",
  professional:  "professional",
  profesional:   "professional",
};

// -----------------------------------------------------------------------------
// Normalización
// -----------------------------------------------------------------------------

function normalizeRequestedRoles(rawRoles = []) {
  return Array.from(
    new Set(
      rawRoles
        .map((role) => ROLE_ALIASES[String(role || "").trim().toLowerCase()])
        .filter(Boolean),
    ),
  );
}

module.exports = {
  ROLE_LABELS,
  ROLE_ALIASES,
  normalizeRequestedRoles,
};
