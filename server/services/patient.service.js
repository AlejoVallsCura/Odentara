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

// Partículas que van en minúscula cuando no abren el nombre: "Juan de la Cruz",
// no "Juan De La Cruz". Si la partícula es la primera palabra sí se capitaliza
// ("De la Cruz, María" cargado en ese orden), porque un nombre no puede empezar
// en minúscula.
const PARTICULAS_MINUSCULA = new Set([
  "de", "del", "la", "las", "lo", "los", "y", "e", "da", "das", "do", "dos",
  "van", "von", "der", "den", "di", "du", "le", "el", "al", "bin", "ibn",
]);

/**
 * Deja el nombre en "Primera Letra Mayúscula" sin importar cómo lo hayan
 * tipeado: MARÍA GARCÍA, maría garcía y María garcía terminan todos en
 * "María García".
 *
 * Se aplica en la escritura y no en el render a propósito. Normalizar solo al
 * mostrar deja la base sucia, y el nombre no sale únicamente por la pantalla de
 * pacientes: también va a recetas, presupuestos, la impresión de la historia
 * clínica y las exportaciones. Cada una de esas salidas tendría que acordarse de
 * aplicar el mismo formato, y alguna se iba a olvidar.
 *
 * Ojo: NO se tocan los acentos. Eso es tarea de `normalizePatientName`, que
 * arma la clave de búsqueda; acá se conserva el nombre tal como se escribe.
 */
function toDisplayCasePatientName(value = "") {
  // El default `= ""` solo cubre `undefined`. Sin este guardia, un `fullName`
  // null del body —que llega así desde la importación cuando la celda está
  // vacía— pasa por String() y se convierte en el nombre "Null".
  if (value === null || value === undefined) return "";

  const limpio = String(value).trim().replace(/\s+/g, " ");
  if (!limpio) return "";

  return limpio
    .split(" ")
    .map((palabra, indice) => {
      const minuscula = palabra.toLocaleLowerCase("es");

      if (indice > 0 && PARTICULAS_MINUSCULA.has(minuscula)) {
        return minuscula;
      }

      // Se capitaliza después de cada guion y de cada apóstrofo, no solo al
      // principio de la palabra: "ana-maría" → "Ana-María" y "d'angelo" →
      // "D'Angelo". Sin esto quedarían "Ana-maría" y "D'angelo".
      return minuscula.replace(
        /(^|[-'’])(\p{L})/gu,
        (_, separador, letra) => separador + letra.toLocaleUpperCase("es")
      );
    })
    .join(" ");
}

// -----------------------------------------------------------------------------
// Antecedentes médicos (cuestionario de la ficha)
// -----------------------------------------------------------------------------

// Claves booleanas (casilleros Sí/No) y de texto del cuestionario médico.
// Se usan como fuente única de verdad para sanitizar el JSON que entra.
const MEDICAL_BOOL_KEYS = [
  "cardiacos", "presionAlta", "presionBaja", "hepatitis", "ulcerasEstomago",
  "diabetes", "asma", "venereasSida", "fiebreReumatica", "epilepsia",
  "desmayos", "problemasHepaticos", "embarazo", "examenHiv", "problemasRenales",
  "servicioUrgencia", "bajoTratamiento", "reaccionAlergica", "sangradoExcesivo",
  "tomaMedicamentos", "fuma",
];
const MEDICAL_TEXT_KEYS = ["bajoTratamientoCual", "reaccionAlergicaCual", "medicamentosCuales"];

// Devuelve un objeto limpio con solo las claves conocidas, o null si no vino nada.
function sanitizeMedicalHistory(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const k of MEDICAL_BOOL_KEYS) {
    if (raw[k] !== undefined) out[k] = Boolean(raw[k]);
  }
  for (const k of MEDICAL_TEXT_KEYS) {
    if (raw[k] !== undefined && raw[k] !== null) out[k] = String(raw[k]).trim().slice(0, 500);
  }
  return Object.keys(out).length > 0 ? out : null;
}

// -----------------------------------------------------------------------------
// Serialización
// -----------------------------------------------------------------------------

function serializePatient(patient, { includeClinicalData = false } = {}) {
  const dto = {
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

  // El directorio de pacientes también lo usan roles administrativos. Los
  // antecedentes se agregan únicamente cuando la ruta ya autorizó datos clínicos.
  if (includeClinicalData) dto.medicalHistory = patient.medicalHistory ?? null;
  return dto;
}

// -----------------------------------------------------------------------------
// Construcción de payload desde req.body
// -----------------------------------------------------------------------------

function getPatientPayload(body = {}) {
  const trim = (val, max) => (val ? String(val).trim().slice(0, max) : null);
  return {
    fullName:          toDisplayCasePatientName(body.fullName).slice(0, 255),
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
  };
}

function getPatientClinicalPayload(body = {}) {
  const payload = {};
  // La ausencia significa "no tocar". Un null explícito, en cambio, permite
  // limpiar el cuestionario desde una pantalla clínica autorizada.
  if (Object.hasOwn(body, "medicalHistory")) {
    payload.medicalHistory = sanitizeMedicalHistory(body.medicalHistory);
  }
  return payload;
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
  toDisplayCasePatientName,
  serializePatient,
  getPatientPayload,
  getPatientClinicalPayload,
  validatePatientUniqueness,
  PATIENT_INCLUDE,
};
