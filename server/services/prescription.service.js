// =============================================================================
// prescription.service.js — Lógica de negocio de recetas digitales
// Serialización y validación de payload
// =============================================================================

"use strict";

// -----------------------------------------------------------------------------
// Serialización
// -----------------------------------------------------------------------------

function serializePrescription(prescription) {
  return {
    id: prescription.id,
    patientId: prescription.patientId,
    professionalId: prescription.professionalId,
    createdByUserId: prescription.createdByUserId,
    diagnosis: prescription.diagnosis,
    medications: prescription.medications,
    instructions: prescription.instructions,
    issuedAt: prescription.issuedAt,
    createdAt: prescription.createdAt,
    patient: prescription.patient
      ? {
          id: prescription.patient.id,
          fullName: prescription.patient.fullName,
          dni: prescription.patient.dni,
          birthDate: prescription.patient.birthDate,
          insuranceName: prescription.patient.insuranceName,
          insurancePlan: prescription.patient.insurancePlan,
          credentialNumber: prescription.patient.credentialNumber,
        }
      : null,
    professional: prescription.professional
      ? {
          id: prescription.professional.id,
          fullName: prescription.professional.fullName,
          specialty: prescription.professional.specialty,
          licenseNumber: prescription.professional.licenseNumber,
        }
      : null,
  };
}

// -----------------------------------------------------------------------------
// Payload y validación
// -----------------------------------------------------------------------------

function getPrescriptionPayload(body = {}) {
  const trim = (val, max) => (val ? String(val).trim().slice(0, max) : null);
  return {
    patientId: Number(body.patientId) || null,
    professionalId: Number(body.professionalId) || null,
    diagnosis: trim(body.diagnosis, 2000),
    medications: trim(body.medications, 5000) || "",
    instructions: trim(body.instructions, 5000),
  };
}

function validatePrescriptionPayload(payload) {
  const errors = [];
  if (!payload.patientId) errors.push("Falta el paciente.");
  if (!payload.professionalId) errors.push("Falta el profesional que emite la receta.");
  if (!payload.medications) errors.push("La receta debe incluir al menos un medicamento.");
  return errors;
}

// Selector estándar de includes para queries de prescription
const PRESCRIPTION_INCLUDE = {
  patient: {
    select: {
      id: true, fullName: true, dni: true, birthDate: true,
      insuranceName: true, insurancePlan: true, credentialNumber: true,
    },
  },
  professional: {
    select: { id: true, fullName: true, specialty: true, licenseNumber: true },
  },
};

module.exports = {
  serializePrescription,
  getPrescriptionPayload,
  validatePrescriptionPayload,
  PRESCRIPTION_INCLUDE,
};
