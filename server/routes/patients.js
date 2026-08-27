const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/require-permission");
const { buildPatientAccessWhere } = require("../lib/access");
const { parseId } = require("../lib/parse-id");
const {
  canManagePatients,
  canEditPatient,
  canDeletePatient,
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
} = require("../lib/permissions");
const { sensitiveLimiter } = require("../middleware/rate-limit");
const {
  normalizeDni,
  normalizePatientName,
  serializePatient,
  getPatientPayload,
  validatePatientUniqueness,
  PATIENT_INCLUDE,
} = require("../services/patient.service");
const {
  isConfigured: isPhotoImportConfigured,
  extractPatientsFromImages,
} = require("../services/patient-extraction.service");
const {
  isConfigured: isAiConfigured,
  generatePatientSummary,
  structureClinicalNote,
} = require("../services/ai-clinical.service");
const {
  getAiQuotaStatus,
  normalizeAiUsage,
  getAiExtractionLimit,
} = require("../lib/plan-limits");

const router = express.Router();

const puedeCrearPacientes = requirePermission(
  canManagePatients,
  "No tenes permisos para crear pacientes.",
);

const puedeEditarLaHistoriaClinica = requirePermission(
  canManagePatients,
  "No tenés permisos para editar la historia clínica.",
);

const puedeEditarPacientes = requirePermission(
  canEditPatient,
  "No tenes permisos para editar pacientes.",
);

const puedeEliminarPacientes = requirePermission(
  canDeletePatient,
  "Solo el superadmin puede eliminar pacientes.",
);

const puedeImportarPacientes = requirePermission(
  canManagePatients,
  "No tenes permisos para importar pacientes.",
);

// Etiquetas legibles del cuestionario médico (para armar el dossier del resumen).
const MH_LABELS = {
  cardiacos: "problemas cardíacos", presionAlta: "presión alta", presionBaja: "presión baja",
  hepatitis: "hepatitis", ulcerasEstomago: "úlceras de estómago", diabetes: "diabetes",
  asma: "asma", venereasSida: "enfermedades venéreas/SIDA", fiebreReumatica: "fiebre reumática",
  epilepsia: "epilepsia/convulsiones", desmayos: "desmayos", problemasHepaticos: "problemas hepáticos",
  embarazo: "embarazo", examenHiv: "examen HIV", problemasRenales: "problemas renales",
  servicioUrgencia: "asociado a servicio de urgencia", sangradoExcesivo: "sangrado excesivo al lastimarse/extraer",
  fuma: "fuma",
};

// ¿El plan de la clínica incluye funciones de IA? (inicial = no). Devuelve {ok} o {error}.
async function requireAiPlan(prisma, clinicId) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { plan: true } });
  if (getAiExtractionLimit(clinic?.plan) === 0) {
    return { ok: false, error: "Tu plan no incluye las funciones con IA. Actualizá al plan Clínica o Pro." };
  }
  return { ok: true };
}

// Arma el texto-dossier del paciente para el resumen pre-consulta.
function buildPatientDossier(patient) {
  const lines = [];
  let age = "";
  if (patient.birthDate) {
    const a = Math.abs(new Date(Date.now() - new Date(patient.birthDate).getTime()).getUTCFullYear() - 1970);
    age = `, ${a} años`;
  }
  lines.push(`Paciente: ${patient.fullName}${age}.`);

  const mh = patient.medicalHistory || {};
  const conditions = Object.keys(MH_LABELS).filter((k) => mh[k] === true).map((k) => MH_LABELS[k]);
  if (conditions.length) lines.push(`Antecedentes marcados: ${conditions.join(", ")}.`);
  if (mh.bajoTratamientoCual) lines.push(`Bajo tratamiento médico por: ${mh.bajoTratamientoCual}.`);
  if (mh.reaccionAlergicaCual) lines.push(`Alergias a medicamentos: ${mh.reaccionAlergicaCual}.`);
  if (mh.medicamentosCuales) lines.push(`Medicación que toma: ${mh.medicamentosCuales}.`);

  const rec = (patient.clinicalRecords || [])[0];
  if (rec?.allergies) lines.push(`Alergias (ficha): ${rec.allergies}.`);
  if (rec?.medicalNotes) lines.push(`Notas médicas: ${rec.medicalNotes}.`);
  if (rec?.summaryNotes) lines.push(`Observaciones: ${rec.summaryNotes}.`);

  const treatments = patient.treatments || [];
  if (treatments.length) {
    const t = treatments.slice(0, 6).map((x) => {
      const d = x.performedAt ? new Date(x.performedAt).toLocaleDateString("es-AR") : "";
      return `${d} pieza ${x.tooth || "-"}${x.observations ? `: ${x.observations}` : ""}`;
    });
    lines.push(`Últimos tratamientos:\n- ${t.join("\n- ")}`);
  }

  const pendingBudgets = (patient.budgets || []).filter((b) => !b.billingEntryId);
  if (pendingBudgets.length) {
    lines.push(`Presupuestos sin cerrar: ${pendingBudgets.map((b) => `${b.title} ($${Number(b.total).toLocaleString("es-AR")})`).join("; ")}.`);
  }

  const rx = (patient.prescriptions || [])[0];
  if (rx?.medications) lines.push(`Última receta: ${String(rx.medications).replace(/\n/g, ", ")}.`);

  return lines.join("\n");
}

/**
 * Traduce un fallo de las funciones de IA a algo que se le pueda mostrar a un
 * odontólogo, y deja el detalle en el log del servidor.
 *
 * Antes se devolvía `error.message` tal cual. Cuando el SDK de Anthropic falla,
 * ese mensaje ES el cuerpo crudo de la API, así que al profesional le aparecía
 * en pantalla `401 {"type":"authentication_error"...}`. No le sirve para nada,
 * y expone qué proveedor se usa y cómo está configurado.
 *
 * Los errores que construye el propio servicio (NOT_CONFIGURED, REFUSAL,
 * INVALID_INPUT) sí llevan un texto pensado para leerse, y se pasan tal cual.
 */
function responderErrorIa(res, error, contexto) {
  const CONOCIDOS = {
    NOT_CONFIGURED: 503,
    INVALID_INPUT: 400,
    REFUSAL: 422,
  };

  const status = CONOCIDOS[error.code];
  if (status) {
    return res.status(status).json({ ok: false, error: error.message, code: error.code });
  }

  // Un 401 del proveedor es un problema de configuración, no del usuario ni un
  // fallo pasajero: conviene que se distinga de un 500 genérico para que quien
  // administra sepa dónde mirar.
  const esAuth = /401|authentication_error|API key/i.test(String(error.message || ""));
  console.error(`[${contexto}]`, error);

  return res.status(esAuth ? 503 : 500).json({
    ok: false,
    code: esAuth ? "AI_AUTH" : "AI_ERROR",
    error: esAuth
      ? "Las funciones de IA no están disponibles: hay un problema con la configuración del servicio. Avisale a quien administra el sistema."
      : "No se pudo completar la operación con IA. Probá de nuevo en un momento.",
  });
}

// ── GET /ai/status — ¿están disponibles las funciones de IA (resumen/dictado)? ──
router.get("/ai/status", requireAuth, async (req, res) => {
  try {
    const clinic = await req.prisma.clinic.findUnique({
      where: { id: req.user.clinicId }, select: { plan: true },
    });
    const available = isAiConfigured() && getAiExtractionLimit(clinic?.plan) !== 0;
    return res.json({ ok: true, available });
  } catch (_e) {
    return res.json({ ok: true, available: false });
  }
});

// ── POST /:id/ai-summary — resumen/alerta pre-consulta desde la ficha ──────────
router.post("/:id/ai-summary", sensitiveLimiter, requireAuth, async (req, res) => {
  try {
    const patientId = parseId(req.params.id);
    if (!patientId) return res.status(400).json({ ok: false, error: "ID de paciente inválido." });

    const gate = await requireAiPlan(req.prisma, req.user.clinicId);
    if (!gate.ok) return res.status(403).json({ ok: false, error: gate.error, code: "plan-not-included" });

    // La ficha clínica (antecedentes/notas) y los tratamientos son compartidos
    // por toda la clínica — cualquier profesional con acceso al paciente los ve.
    // Presupuestos y recetas siguen siendo privados: un profesional solo ve los
    // propios; superadmin/admin/secretary con acceso a toda la clínica ven todo.
    const wholeClinic = canAccessWholeClinic(req.permissions);
    const ownIds = getAccessibleProfessionalIds(req.permissions);
    const ownOnlyWhere = wholeClinic ? {} : { professionalId: { in: ownIds } };

    const patient = await req.prisma.patient.findFirst({
      where: { id: patientId, ...buildPatientAccessWhere(req.permissions, req.user.clinicId) },
      include: {
        clinicalRecords: {
          select: { allergies: true, medicalNotes: true, summaryNotes: true },
        },
        treatments: { where: { deletedAt: null }, orderBy: { performedAt: "desc" }, take: 8 },
        budgets: { where: { deletedAt: null, ...ownOnlyWhere }, orderBy: { issuedAt: "desc" }, take: 5 },
        prescriptions: { where: { deletedAt: null, ...ownOnlyWhere }, orderBy: { issuedAt: "desc" }, take: 3 },
      },
    });
    if (!patient) return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });

    const summary = await generatePatientSummary(buildPatientDossier(patient));
    return res.json({ ok: true, summary });
  } catch (error) {
    return responderErrorIa(res, error, "patients/ai-summary");
  }
});

// ── POST /:id/ai-structure-note — limpia una nota dictada por voz ──────────────
router.post("/:id/ai-structure-note", sensitiveLimiter, requireAuth, puedeEditarLaHistoriaClinica, async (req, res) => {
  try {
    const gate = await requireAiPlan(req.prisma, req.user.clinicId);
    if (!gate.ok) return res.status(403).json({ ok: false, error: gate.error, code: "plan-not-included" });

    const { note, odontogramActions } = await structureClinicalNote(req.body.transcript);
    return res.json({ ok: true, note, odontogramActions });
  } catch (error) {
    return responderErrorIa(res, error, "patients/ai-structure-note");
  }
});

// ── GET /extract-photo/status — ¿está disponible la extracción por foto? ──────
// available depende de: (1) API key configurada en el servidor y (2) que el plan
// de la clínica incluya IA y no haya agotado la cuota mensual.
router.get("/extract-photo/status", requireAuth, async (req, res) => {
  try {
    const configured = isPhotoImportConfigured();
    const clinic = await req.prisma.clinic.findUnique({
      where: { id: req.user.clinicId },
      select: { plan: true, aiUsage: true },
    });
    const quota = getAiQuotaStatus(clinic?.plan, clinic?.aiUsage);
    return res.json({
      ok: true,
      available: configured && quota.allowed,
      configured,
      quota: {
        included: quota.reason !== "plan-not-included",
        limit: quota.limit === Infinity ? null : quota.limit,
        used: quota.used,
        remaining: quota.remaining === Infinity ? null : quota.remaining,
        reason: quota.reason || null,
      },
    });
  } catch (_error) {
    return res.json({ ok: true, available: isPhotoImportConfigured() });
  }
});

// ── POST /extract-photo — extrae pacientes de fotos con IA (no crea nada) ─────
router.post("/extract-photo", sensitiveLimiter, requireAuth, puedeImportarPacientes, async (req, res) => {
  try {
    // Chequeo de plan y cuota mensual antes de gastar el llamado a la IA
    const clinic = await req.prisma.clinic.findUnique({
      where: { id: req.user.clinicId },
      select: { plan: true, aiUsage: true },
    });
    const quota = getAiQuotaStatus(clinic?.plan, clinic?.aiUsage);
    if (!quota.allowed) {
      const msg = quota.reason === "plan-not-included"
        ? "Tu plan no incluye la importación con IA. Actualizá al plan Clínica o Pro."
        : `Alcanzaste el límite mensual de importación con IA (${quota.limit} este mes). Se renueva el mes que viene.`;
      return res.status(403).json({ ok: false, error: msg, code: quota.reason });
    }

    const patients = await extractPatientsFromImages(req.body.images);

    // Sumar al contador mensual (por paciente extraído)
    if (patients.length > 0 && quota.limit !== Infinity) {
      const usage = normalizeAiUsage(clinic?.aiUsage);
      usage.count += patients.length;
      await req.prisma.clinic.update({
        where: { id: req.user.clinicId },
        data: { aiUsage: usage },
      });
    }

    return res.json({ ok: true, patients, quotaRemaining: quota.remaining === Infinity ? null : Math.max(0, quota.remaining - patients.length) });
  } catch (error) {
    return responderErrorIa(res, error, "patients/extract-photo");
  }
});

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    const search = String(req.query.q || "").trim();
    const accessWhere = buildPatientAccessWhere(req.permissions, req.user.clinicId);

    const patients = await prisma.patient.findMany({
      where: {
        AND: [
          accessWhere,
          search
            ? {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" } },
                  { normalizedName: { contains: normalizePatientName(search) } },
                  { dni: { contains: normalizeDni(search) } },
                  { phone: { contains: search, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ fullName: "asc" }],
      // Sin _count: la lista no usa las stats por paciente (turnos/tratamientos/imágenes).
      // Evita 3 subconsultas por paciente en cada carga. Las stats se calculan en GET /:id.
    });

    return res.json({ ok: true, patients: patients.map(serializePatient) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los pacientes." });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    const patientId = parseId(req.params.id);
    if (!patientId) return res.status(400).json({ ok: false, error: "ID de paciente inválido." });

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ...buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      include: PATIENT_INCLUDE,
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    return res.json({ ok: true, patient: serializePatient(patient) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo obtener el paciente." });
  }
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, puedeCrearPacientes, async (req, res) => {
  try {
    const prisma = req.prisma;
    const payload = getPatientPayload(req.body);

    if (!payload.fullName || !payload.dni) {
      return res.status(400).json({ ok: false, error: "Nombre completo y DNI son obligatorios." });
    }

    const conflicts = await validatePatientUniqueness(prisma, payload, req.user.clinicId);
    if (conflicts.length > 0) {
      return res.status(409).json({ ok: false, error: conflicts[0], conflicts });
    }

    // Si ya existe un paciente borrado (soft-delete) con el mismo DNI, la
    // constraint única @@unique([clinicId, dni]) sigue ocupada por esa fila
    // aunque esté "borrada" — hay que restaurarla en vez de insertar una nueva,
    // o el create de abajo falla con P2002.
    const deletedMatch = await prisma.patient.findFirst({
      where: { clinicId: req.user.clinicId, dni: payload.dni, NOT: { deletedAt: null } },
    });

    const patient = deletedMatch
      ? await prisma.patient.update({
          where: { id: deletedMatch.id },
          data: {
            fullName: payload.fullName,
            normalizedName: normalizePatientName(payload.fullName),
            birthDate: payload.birthDate,
            phone: payload.phone,
            email: payload.email,
            address: payload.address,
            insuranceName: payload.insuranceName,
            insurancePlan: payload.insurancePlan,
            credentialNumber: payload.credentialNumber,
            chartNumber: payload.chartNumber,
            medicalHistory: payload.medicalHistory ?? undefined,
            active: true,
            deletedAt: null,
          },
          include: PATIENT_INCLUDE,
        })
      : await prisma.patient.create({
          data: {
            clinicId: req.user.clinicId,
            fullName: payload.fullName,
            normalizedName: normalizePatientName(payload.fullName),
            dni: payload.dni,
            birthDate: payload.birthDate,
            phone: payload.phone,
            email: payload.email,
            address: payload.address,
            insuranceName: payload.insuranceName,
            insurancePlan: payload.insurancePlan,
            credentialNumber: payload.credentialNumber,
            chartNumber: payload.chartNumber,
            medicalHistory: payload.medicalHistory ?? undefined,
            active: payload.active,
            deletedAt: null,
          },
          include: PATIENT_INCLUDE,
        });

    return res.status(201).json({ ok: true, patient: serializePatient(patient) });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ ok: false, error: "Ya existe un paciente con ese DNI o número de ficha." });
    }
    return res.status(500).json({ ok: false, error: "No se pudo crear el paciente." });
  }
});

// ── POST /import ──────────────────────────────────────────────────────────────
router.post("/import", sensitiveLimiter, requireAuth, puedeCrearPacientes, async (req, res) => {
  try {
    const prisma = req.prisma;
    const rows = Array.isArray(req.body.patients) ? req.body.patients : [];
    if (rows.length === 0) {
      return res.status(400).json({ ok: false, error: "No se recibieron filas para importar." });
    }
    if (rows.length > 500) {
      return res.status(400).json({ ok: false, error: "Máximo 500 pacientes por importación." });
    }

    const clinicId = req.user.clinicId;

    const existingPatients = await prisma.patient.findMany({
      where: { clinicId },
      select: {
        id: true, dni: true, phone: true, email: true, address: true,
        birthDate: true, insuranceName: true, insurancePlan: true,
        credentialNumber: true, deletedAt: true,
      },
    });
    const existingMap = new Map(existingPatients.map((p) => [p.dni, p]));

    const created = [];
    const updated = [];
    const skipped = [];
    const errors  = [];

    // Fase 1 — clasificar todas las filas en memoria (sin queries)
    const toCreate = []; // { row, payload }
    const toUpdate = []; // { row, payload, id, data, fields }
    const seenDnis = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowNum  = i + 1;
      const payload = getPatientPayload(rows[i]);

      if (!payload.fullName) { errors.push({ row: rowNum, reason: "Nombre vacío" }); continue; }
      if (!payload.dni)      { errors.push({ row: rowNum, name: payload.fullName, reason: "DNI vacío o inválido" }); continue; }
      if (!payload.phone)    { errors.push({ row: rowNum, name: payload.fullName, reason: "Teléfono vacío" }); continue; }

      if (seenDnis.has(payload.dni)) {
        skipped.push({ row: rowNum, name: payload.fullName, dni: payload.dni, reason: "DNI duplicado en el archivo" });
        continue;
      }
      seenDnis.add(payload.dni);

      const existing = existingMap.get(payload.dni);

      if (existing) {
        if (existing.deletedAt) {
          const restore = {
            deletedAt: null, active: true,
            phone:            payload.phone            || existing.phone,
            email:            payload.email            || existing.email,
            address:          payload.address          || existing.address,
            birthDate:        payload.birthDate        || existing.birthDate,
            insuranceName:    payload.insuranceName    || existing.insuranceName,
            insurancePlan:    payload.insurancePlan    || existing.insurancePlan,
            credentialNumber: payload.credentialNumber || existing.credentialNumber,
          };
          toUpdate.push({ row: rowNum, payload, id: existing.id, data: restore, fields: ["restaurado"] });
          continue;
        }

        const fillable = ["phone", "email", "address", "birthDate", "insuranceName", "insurancePlan", "credentialNumber"];
        const patch = {};
        for (const field of fillable) {
          if (!existing[field] && payload[field]) patch[field] = payload[field];
        }
        if (Object.keys(patch).length > 0) {
          toUpdate.push({ row: rowNum, payload, id: existing.id, data: patch, fields: Object.keys(patch) });
        } else {
          skipped.push({ row: rowNum, name: payload.fullName, dni: payload.dni, reason: "Sin datos nuevos" });
        }
        continue;
      }

      toCreate.push({ row: rowNum, payload });
    }

    // Fase 2 — ejecutar en chunks paralelos (25 queries simultáneas por chunk)
    const CHUNK_SIZE = 25;
    const chunks = (arr) => {
      const out = [];
      for (let i = 0; i < arr.length; i += CHUNK_SIZE) out.push(arr.slice(i, i + CHUNK_SIZE));
      return out;
    };

    for (const chunk of chunks(toCreate)) {
      await Promise.all(chunk.map(async ({ row, payload }) => {
        try {
          const patient = await prisma.patient.create({
            data: {
              clinicId,
              fullName:         payload.fullName,
              normalizedName:   normalizePatientName(payload.fullName),
              dni:              payload.dni,
              birthDate:        payload.birthDate,
              phone:            payload.phone,
              email:            payload.email,
              address:          payload.address,
              insuranceName:    payload.insuranceName,
              insurancePlan:    payload.insurancePlan,
              credentialNumber: payload.credentialNumber,
              chartNumber:      payload.chartNumber,
              medicalHistory:   payload.medicalHistory ?? undefined,
              active:           true,
              deletedAt:        null,
            },
          });
          created.push({ id: patient.id, name: patient.fullName, dni: patient.dni });
        } catch (err) {
          if (err.code === "P2002") {
            skipped.push({ row, name: payload.fullName, dni: payload.dni, reason: "DNI ya existe (constraint)" });
          } else {
            errors.push({ row, name: payload.fullName, reason: err.message });
          }
        }
      }));
    }

    for (const chunk of chunks(toUpdate)) {
      await Promise.all(chunk.map(async ({ row, payload, id, data, fields }) => {
        try {
          await prisma.patient.update({ where: { id }, data });
          updated.push({ id, name: payload.fullName, dni: payload.dni, fields });
        } catch (err) {
          errors.push({ row, name: payload.fullName, reason: err.message });
        }
      }));
    }

    return res.status(201).json({
      ok: true,
      created: created.length, updated: updated.length,
      skipped: skipped.length, errors: errors.length,
      detail: { created, updated, skipped, errors },
    });
  } catch (error) {
    console.error("[patients/import]", error);
    return res.status(500).json({ ok: false, error: "No se pudo importar los pacientes." });
  }
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put("/:id", requireAuth, puedeEditarPacientes, async (req, res) => {
  try {
    const prisma = req.prisma;
    const patientId = parseId(req.params.id);
    if (!patientId) return res.status(400).json({ ok: false, error: "ID de paciente inválido." });

    const existingPatient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ...buildPatientAccessWhere(req.permissions, req.user.clinicId),
      },
      select: { id: true },
    });

    if (!existingPatient) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado o sin acceso." });
    }

    const payload = getPatientPayload(req.body);

    if (!payload.fullName || !payload.dni) {
      return res.status(400).json({ ok: false, error: "Nombre completo y DNI son obligatorios." });
    }

    const conflicts = await validatePatientUniqueness(prisma, payload, req.user.clinicId, patientId);
    if (conflicts.length > 0) {
      return res.status(409).json({ ok: false, error: conflicts[0], conflicts });
    }

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        fullName:         payload.fullName,
        normalizedName:   normalizePatientName(payload.fullName),
        dni:              payload.dni,
        birthDate:        payload.birthDate,
        phone:            payload.phone,
        email:            payload.email,
        address:          payload.address,
        insuranceName:    payload.insuranceName,
        insurancePlan:    payload.insurancePlan,
        credentialNumber: payload.credentialNumber,
        chartNumber:      payload.chartNumber,
        medicalHistory:   payload.medicalHistory ?? undefined,
        active:           payload.active,
        deletedAt:        null,
      },
      include: PATIENT_INCLUDE,
    });

    return res.json({ ok: true, patient: serializePatient(patient) });
  } catch (error) {
    console.error("[patients PUT]", error);
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el paciente." });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, puedeEliminarPacientes, async (req, res) => {
  try {
    const prisma = req.prisma;
    const patientId = parseId(req.params.id);
    if (!patientId) return res.status(400).json({ ok: false, error: "ID de paciente inválido." });

    const existingPatient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: req.user.clinicId },
      select: { id: true, deletedAt: true },
    });

    if (!existingPatient || existingPatient.deletedAt) {
      return res.status(404).json({ ok: false, error: "Paciente no encontrado." });
    }

    await prisma.patient.update({
      where: { id: patientId },
      data: { active: false, deletedAt: new Date() },
    });

    return res.json({ ok: true, message: "Paciente eliminado correctamente." });
  } catch (error) {
    const message =
      error?.code === "P2003"
        ? "No se puede eliminar el paciente porque tiene registros relacionados."
        : "No se pudo eliminar el paciente.";
    return res.status(400).json({ ok: false, error: message });
  }
});

module.exports = router;
