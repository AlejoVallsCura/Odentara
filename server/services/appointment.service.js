// =============================================================================
// appointment.service.js — Lógica de negocio de turnos
// Serialización, validación, helpers de fecha/hora y schedule
// =============================================================================

"use strict";

const {
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("../lib/permissions");

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------

const VALID_STATUSES = new Set(["not_sent", "sent", "confirmed", "rescheduled", "cancelled"]);
const VALID_CHANNELS = new Set(["whatsapp", "phone", "email", "manual"]);
const BUSINESS_TIME_ZONE = "America/Buenos_Aires";

// -----------------------------------------------------------------------------
// Utilidades de fecha/hora (zona horaria de negocio)
// -----------------------------------------------------------------------------

function getBusinessNowParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function getTodayIsoLocal() {
  const now = getBusinessNowParts();
  return `${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`;
}

function parseDateOnly(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatLocalTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseDateTime(dateStr, timeStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  const [hours, minutes] = String(timeStr).split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
}

function timeToMinutes(timeStr = "") {
  const [hours, minutes] = String(timeStr).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function currentMinutes() {
  const now = getBusinessNowParts();
  return now.hour * 60 + now.minute;
}

// -----------------------------------------------------------------------------
// Serialización
// -----------------------------------------------------------------------------

function serializeAppointment(appointment) {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    professionalId: appointment.professionalId,
    createdByUserId: appointment.createdByUserId,
    date: formatLocalDate(appointment.date),
    startTime: formatLocalTime(appointment.startTime),
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    isOverbook: appointment.isOverbook,
    confirmationChannel: appointment.confirmationChannel,
    confirmationSentAt: appointment.confirmationSentAt,
    confirmationResponseAt: appointment.confirmationResponseAt,
    cancellationReason: appointment.cancellationReason,
    notes: appointment.notes,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    patient: appointment.patient
      ? {
          id: appointment.patient.id,
          fullName: appointment.patient.fullName,
          dni: appointment.patient.dni,
          phone: appointment.patient.phone,
        }
      : null,
    professional: appointment.professional
      ? {
          id: appointment.professional.id,
          fullName: appointment.professional.fullName,
          color: appointment.professional.color,
        }
      : null,
    createdByUser: appointment.createdByUser
      ? {
          id: appointment.createdByUser.id,
          email: appointment.createdByUser.email,
          fullName: appointment.createdByUser.fullName,
        }
      : null,
  };
}

// -----------------------------------------------------------------------------
// Lógica de schedule
// -----------------------------------------------------------------------------

function getAppointmentEndMinutes(payload) {
  const start = timeToMinutes(payload.time);
  if (start === null) return null;
  const duration = payload.isOverbook ? 15 : Number(payload.durationMinutes || 0);
  return start + duration;
}

function scheduleAllowsAppointment(schedules = [], payload) {
  const start = timeToMinutes(payload.time);
  const end = getAppointmentEndMinutes(payload);
  if (start === null || end === null) return false;

  const weekday = parseDateOnly(payload.date).getDay();
  return schedules.some((item) => {
    if (!item.active || item.weekday !== weekday) return false;
    const scheduleStart = timeToMinutes(item.startTime);
    const scheduleEnd = timeToMinutes(item.endTime);
    if (scheduleStart === null || scheduleEnd === null) return false;
    return start >= scheduleStart && end <= scheduleEnd;
  });
}

// -----------------------------------------------------------------------------
// Validación de acceso
// -----------------------------------------------------------------------------

function canAccessProfessional(permissions, professionalId) {
  if (canAccessWholeClinic(permissions)) return true;
  return getAccessibleProfessionalIds(permissions).includes(professionalId);
}

// -----------------------------------------------------------------------------
// Validación de payload
// -----------------------------------------------------------------------------

async function validateAppointmentPayload(
  prisma,
  payload,
  permissions,
  clinicId,
  currentAppointmentId = null,
  existingAppointment = null
) {
  if (!payload.patientId || !payload.professionalId || !payload.date || !payload.time) {
    return "Paciente, profesional, fecha y hora son obligatorios.";
  }

  if (!canAccessProfessional(permissions, payload.professionalId)) {
    return "No tenes acceso al profesional seleccionado.";
  }

  const patient = await prisma.patient.findFirst({
    where: { id: payload.patientId, clinicId },
    select: { id: true, deletedAt: true },
  });

  if (!patient || patient.deletedAt) {
    return "El paciente seleccionado no existe.";
  }

  const professional = await prisma.professional.findFirst({
    where: { id: payload.professionalId, clinicId },
    select: { id: true, active: true, deletedAt: true, schedules: true },
  });

  const validDurations = payload.isOverbook ? [15] : [30, 60, 90, 120];
  if (!validDurations.includes(Number(payload.durationMinutes || 0))) {
    return payload.isOverbook
      ? "El sobreturno solo puede durar 15 minutos."
      : "La duración del turno no es válida.";
  }

  if (!professional || professional.deletedAt || !professional.active) {
    return "El profesional seleccionado no existe o está inactivo.";
  }

  const keepsSameSlot =
    existingAppointment &&
    formatLocalDate(existingAppointment.date) === payload.date &&
    formatLocalTime(existingAppointment.startTime) === payload.time &&
    existingAppointment.professionalId === payload.professionalId &&
    existingAppointment.patientId === payload.patientId &&
    existingAppointment.isOverbook === payload.isOverbook;

  const todayIso = getTodayIsoLocal();
  if (payload.date < todayIso && !keepsSameSlot) {
    return "No se pueden crear turnos para dias anteriores.";
  }

  if (payload.date === todayIso) {
    const selectedMinutes = timeToMinutes(payload.time);
    if (
      selectedMinutes !== null &&
      selectedMinutes < currentMinutes() &&
      !payload.isOverbook &&
      !keepsSameSlot
    ) {
      return "Los horarios pasados de hoy solo admiten sobreturnos.";
    }
  }

  if (!scheduleAllowsAppointment(professional.schedules || [], payload)) {
    return "La duración elegida no entra dentro del horario disponible del profesional.";
  }

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      professionalId: payload.professionalId,
      date: parseDateOnly(payload.date),
      deletedAt: null,
      status: { notIn: ["cancelled", "rescheduled"] },
      ...(currentAppointmentId ? { id: { not: currentAppointmentId } } : {}),
    },
    select: { id: true, isOverbook: true, startTime: true, durationMinutes: true },
  });

  const start = timeToMinutes(payload.time);
  const end = getAppointmentEndMinutes(payload);
  if (start === null || end === null) return "La hora seleccionada no es válida.";

  const hasOverlap = existingAppointments.some((item) => {
    const existingStart = item.startTime.getHours() * 60 + item.startTime.getMinutes();
    const existingEnd = existingStart + item.durationMinutes;

    if (payload.isOverbook) {
      if (!item.isOverbook) return false;
      return start < existingEnd && end > existingStart;
    }

    if (item.isOverbook) return false;
    return start < existingEnd && end > existingStart;
  });

  if (hasOverlap) {
    return payload.isOverbook
      ? "Ya existe un sobreturno en ese horario para el profesional."
      : "Ese rango horario ya está ocupado para el profesional.";
  }

  return null;
}

// -----------------------------------------------------------------------------
// Construcción de payload desde req.body
// -----------------------------------------------------------------------------

function buildAppointmentPayload(body, existing = null) {
  return {
    patientId: Number(body.patientId ?? existing?.patientId),
    professionalId: Number(body.professionalId ?? existing?.professionalId),
    date: String(body.date || (existing ? formatLocalDate(existing.date) : "")).trim(),
    time: String(body.time || (existing ? formatLocalTime(existing.startTime) : "")).trim(),
    durationMinutes: Number(body.durationMinutes ?? existing?.durationMinutes ?? 30),
    status: VALID_STATUSES.has(body.status) ? body.status : (existing?.status ?? "not_sent"),
    isOverbook: body.isOverbook !== undefined ? Boolean(body.isOverbook) : (existing?.isOverbook ?? false),
    confirmationChannel: body.confirmationChannel
      ? (VALID_CHANNELS.has(body.confirmationChannel) ? body.confirmationChannel : (existing?.confirmationChannel ?? null))
      : (existing?.confirmationChannel ?? null),
    confirmationSentAt:
      body.confirmationSentAt !== undefined
        ? (body.confirmationSentAt ? new Date(body.confirmationSentAt) : null)
        : (existing?.confirmationSentAt ?? null),
    confirmationResponseAt:
      body.confirmationResponseAt !== undefined
        ? (body.confirmationResponseAt ? new Date(body.confirmationResponseAt) : null)
        : (existing?.confirmationResponseAt ?? null),
    cancellationReason:
      body.cancellationReason !== undefined
        ? (body.cancellationReason ? String(body.cancellationReason).trim() : null)
        : (existing?.cancellationReason ?? null),
    notes:
      body.notes !== undefined
        ? (body.notes ? String(body.notes).trim() : null)
        : (existing?.notes ?? null),
  };
}

// Selector estándar de includes para todas las queries de appointment
const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, fullName: true, dni: true, phone: true } },
  professional: { select: { id: true, fullName: true, color: true } },
  createdByUser: { select: { id: true, email: true, fullName: true } },
};

module.exports = {
  VALID_STATUSES,
  VALID_CHANNELS,
  APPOINTMENT_INCLUDE,
  getTodayIsoLocal,
  parseDateOnly,
  formatLocalDate,
  formatLocalTime,
  parseDateTime,
  timeToMinutes,
  serializeAppointment,
  buildAppointmentPayload,
  validateAppointmentPayload,
};
