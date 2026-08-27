// =============================================================================
// professional.service.js — Lógica de negocio de profesionales
// Serialización y normalización de schedules/exceptions
// =============================================================================

"use strict";

// -----------------------------------------------------------------------------
// Serialización
// -----------------------------------------------------------------------------

function serializeProfessional(professional) {
  return {
    id: professional.id,
    fullName: professional.fullName,
    specialty: professional.specialty,
    email: professional.email,
    phone: professional.phone,
    color: professional.color,
    licenseNumber: professional.licenseNumber,
    active: professional.active,
    userId: professional.userId,
    createdAt: professional.createdAt,
    updatedAt: professional.updatedAt,
    assignedUser: professional.user
      ? {
          id: professional.user.id,
          email: professional.user.email,
          fullName: professional.user.fullName,
        }
      : null,
    schedules: (professional.schedules || []).map((schedule) => ({
      id: schedule.id,
      weekday: schedule.weekday,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      active: schedule.active,
    })),
    exceptions: (professional.scheduleExceptions || []).map((exception) => ({
      id: exception.id,
      date: exception.date,
      type: exception.type,
      startTime: exception.startTime,
      endTime: exception.endTime,
      reason: exception.reason,
    })),
    stats: {
      appointments: professional._count?.appointments || 0,
      treatments: professional._count?.patientTreatments || 0,
    },
  };
}

// -----------------------------------------------------------------------------
// Normalización de schedules y exceptions
// -----------------------------------------------------------------------------

function normalizeSchedules(schedules = []) {
  return schedules
    .filter((item) => item && item.startTime && item.endTime && item.weekday !== undefined)
    .map((item) => ({
      weekday: Number(item.weekday),
      startTime: String(item.startTime),
      endTime: String(item.endTime),
      active: item.active !== undefined ? Boolean(item.active) : true,
    }));
}

function normalizeExceptions(exceptions = []) {
  return exceptions
    .filter((item) => item && item.date && item.type)
    .map((item) => ({
      date: new Date(item.date),
      type: item.type,
      startTime: item.startTime ? String(item.startTime) : null,
      endTime: item.endTime ? String(item.endTime) : null,
      reason: item.reason ? String(item.reason).trim() : null,
    }));
}

// -----------------------------------------------------------------------------
// Validación de color
// -----------------------------------------------------------------------------

// Cada formato va anclado de punta a punta.
//
// El regex anterior era /^#[0-9a-fA-F]{3,8}$|^rgb(|^hsl(/ y el `$` cerraba
// SOLO la rama hex: `^rgb(` no tenia fin, asi que
// `rgb(0,0,0)" onload="alert(1)` pasaba entero y quedaba guardado para
// inyectarse despues en un atributo de estilo.
//
// Se conservan los tres formatos —hay tests que los declaran validos— pero cada
// uno tiene que coincidir COMPLETO, sin cola.
const FORMATOS_DE_COLOR = [
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/,
  /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/,
];

function normalizeColor(rawColor) {
  if (!rawColor) return null;
  const color = String(rawColor).trim();
  return FORMATOS_DE_COLOR.some((re) => re.test(color)) ? color : null;
}


// Selector estándar de includes para queries de professional
const PROFESSIONAL_INCLUDE = {
  user: { select: { id: true, email: true, fullName: true } },
  schedules: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
  scheduleExceptions: { orderBy: [{ date: "asc" }] },
  _count: { select: { appointments: true, patientTreatments: true } },
};

module.exports = {
  serializeProfessional,
  normalizeSchedules,
  normalizeExceptions,
  normalizeColor,
  PROFESSIONAL_INCLUDE,
};
