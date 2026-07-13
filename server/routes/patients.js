const express = require("express");

const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const { buildPatientAccessWhere } = require("../lib/access");
const { parseId } = require("../lib/parse-id");
const {
  canManagePatients,
  canEditPatient,
  canDeletePatient,
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

const router = express.Router();

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
router.post("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManagePatients(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear pacientes." });
    }

    const payload = getPatientPayload(req.body);

    if (!payload.fullName || !payload.dni) {
      return res.status(400).json({ ok: false, error: "Nombre completo y DNI son obligatorios." });
    }

    const conflicts = await validatePatientUniqueness(prisma, payload, req.user.clinicId);
    if (conflicts.length > 0) {
      return res.status(409).json({ ok: false, error: conflicts[0], conflicts });
    }

    const patient = await prisma.patient.create({
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
        active: payload.active,
        deletedAt: null,
      },
      include: PATIENT_INCLUDE,
    });

    return res.status(201).json({ ok: true, patient: serializePatient(patient) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el paciente." });
  }
});

// ── POST /import ──────────────────────────────────────────────────────────────
router.post("/import", sensitiveLimiter, requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManagePatients(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear pacientes." });
    }

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
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditPatient(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar pacientes." });
    }

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
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canDeletePatient(req.permissions)) {
      return res.status(403).json({ ok: false, error: "Solo el superadmin puede eliminar pacientes." });
    }

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

    await logDeleteAudit(prisma, req.user.id, "Patient", patientId, { patient: existingPatient });

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
