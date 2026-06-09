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

function normalizeColor(rawColor) {
  if (!rawColor) return null;
  const color = String(rawColor).trim();
  return /^#[0-9a-fA-F]{3,8}$|^rgb\(|^hsl\(/.test(color) ? color : null;
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
