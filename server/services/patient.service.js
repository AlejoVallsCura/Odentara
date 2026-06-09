// =============================================================================
// patient.service.js — Lógica de negocio de pacientes
// Normalización, serialización y validación de unicidad
// =============================================================================

"use strict";

// -----------------------------------------------------------------------------
// Normalización
// -----------------------------------------------------------------------------

function normalizeDni(value = "") {
  return String(value).replace(/\D/g, "");
}

function normalizePatientName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// -----------------------------------------------------------------------------
// Serialización
// -----------------------------------------------------------------------------

function serializePatient(patient) {
  return {
    id: patient.id,
    fullName: patient.fullName,
    normalizedName: patient.normalizedName,
    dni: patient.dni,
    birthDate: patient.birthDate,
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    insuranceName: patient.insuranceName,
    insurancePlan: patient.insurancePlan,
    credentialNumber: patient.credentialNumber,
    chartNumber: patient.chartNumber,
    active: patient.active,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    stats: {
      appointments: patient._count?.appointments || 0,
      treatments: patient._count?.treatments || 0,
      images: patient._count?.clinicalImages || 0,
    },
  };
}

// -----------------------------------------------------------------------------
// Construcción de payload desde req.body
// -----------------------------------------------------------------------------

function getPatientPayload(body = {}) {
  const trim = (val, max) => (val ? String(val).trim().slice(0, max) : null);
  return {
    fullName:          String(body.fullName || "").trim().slice(0, 255),
    dni:               normalizeDni(body.dni || "").slice(0, 20),
    birthDate:         (() => {
                         if (!body.birthDate) return null;
                         const d = new Date(body.birthDate);
                         return isNaN(d.getTime()) ? null : d;
                       })(),
    phone:             trim(body.phone, 30),
    email:             body.email ? String(body.email).trim().toLowerCase().slice(0, 255) : null,
    address:           trim(body.address, 500),
    insuranceName:     trim(body.insuranceName, 255),
    insurancePlan:     trim(body.insurancePlan, 255),
    credentialNumber:  trim(body.credentialNumber, 100),
    chartNumber:       trim(body.chartNumber, 50),
    active:            body.active !== undefined ? Boolean(body.active) : true,
    summaryNotes:      trim(body.summaryNotes, 5000),
    allergies:         trim(body.allergies, 2000),
    medicalNotes:      trim(body.medicalNotes, 5000),
  };
}

// -----------------------------------------------------------------------------
// Validación de unicidad
// -----------------------------------------------------------------------------

async function validatePatientUniqueness(prisma, payload, clinicId, currentPatientId = null) {
  const conflicts = [];

  const existingByDni = await prisma.patient.findFirst({
    where: {
      dni: payload.dni,
      clinicId,
      deletedAt: null,
      ...(currentPatientId ? { id: { not: currentPatientId } } : {}),
    },
    select: { id: true, fullName: true, dni: true },
  });

  if (existingByDni) {
    conflicts.push(`Ya existe un paciente con el DNI ${existingByDni.dni}.`);
  }

  const existingByName = await prisma.patient.findFirst({
    where: {
      normalizedName: normalizePatientName(payload.fullName),
      clinicId,
      deletedAt: null,
      ...(currentPatientId ? { id: { not: currentPatientId } } : {}),
    },
    select: { id: true, fullName: true },
  });

  if (existingByName) {
    conflicts.push(`Ya existe un paciente con el nombre ${existingByName.fullName}.`);
  }

  return conflicts;
}

// Selector estándar de includes para queries de patient
const PATIENT_INCLUDE = {
  _count: {
    select: {
      appointments: true,
      treatments: true,
      clinicalImages: true,
    },
  },
};

module.exports = {
  normalizeDni,
  normalizePatientName,
  serializePatient,
  getPatientPayload,
  validatePatientUniqueness,
  PATIENT_INCLUDE,
};
