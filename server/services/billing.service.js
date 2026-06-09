// =============================================================================
// billing.service.js — Lógica de negocio de facturación
// Serialización, utilidades de fecha UTC y validación de acceso
// =============================================================================

"use strict";

const {
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("../lib/permissions");

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------

const VALID_TYPES = new Set(["income", "debt", "payment", "adjustment"]);

// -----------------------------------------------------------------------------
// Utilidades de fecha (UTC — para movimientos contables)
// -----------------------------------------------------------------------------

function formatDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDateOnlyInput(value) {
  if (!value) return new Date();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

// -----------------------------------------------------------------------------
// Serialización
// -----------------------------------------------------------------------------

function serializeEntry(entry) {
  return {
    id: entry.id,
    patientId: entry.patientId,
    professionalId: entry.professionalId,
    appointmentId: entry.appointmentId,
    createdByUserId: entry.createdByUserId,
    type: entry.type,
    amount: entry.amount,
    currency: entry.currency,
    description: entry.description,
    date: formatDateOnly(entry.date),
    patient: entry.patient
      ? { id: entry.patient.id, fullName: entry.patient.fullName, dni: entry.patient.dni }
      : null,
    professional: entry.professional
      ? { id: entry.professional.id, fullName: entry.professional.fullName }
      : null,
  };
}

// -----------------------------------------------------------------------------
// Validación de acceso
// -----------------------------------------------------------------------------

function canUseProfessional(permissions, professionalId) {
  if (!professionalId) return true;
  if (canAccessWholeClinic(permissions)) return true;
  return getAccessibleProfessionalIds(permissions).includes(Number(professionalId));
}

async function ensureAccessibleAppointment(prisma, permissions, appointmentId, patientId) {
  if (!appointmentId) return true;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: Number(appointmentId),
      patientId,
      ...(canAccessWholeClinic(permissions)
        ? {}
        : { professionalId: { in: getAccessibleProfessionalIds(permissions) } }),
    },
    select: { id: true },
  });
  return Boolean(appointment);
}

module.exports = {
  VALID_TYPES,
  formatDateOnly,
  parseDateOnlyInput,
  serializeEntry,
  canUseProfessional,
  ensureAccessibleAppointment,
};
