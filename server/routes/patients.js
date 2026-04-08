const express = require("express");

const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const {
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
  canManagePatients,
  canEditPatient,
  canDeletePatient,
} = require("../lib/permissions");

const router = express.Router();

function normalizeDni(value = "") {
  return String(value).replace(/\D/g, "");
}

function normalizePatientName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function buildPatientAccessWhere(permissions) {
  if (canAccessWholeClinic(permissions)) {
    return {};
  }

  const professionalIds = getAccessibleProfessionalIds(permissions);

  if (professionalIds.length === 0) {
    return { id: -1 };
  }

  return {
    OR: [
      { appointments: { some: { professionalId: { in: professionalIds } } } },
      { treatments: { some: { professionalId: { in: professionalIds } } } },
      { billingEntries: { some: { professionalId: { in: professionalIds } } } },
    ],
  };
}

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
    clinicalRecord: patient.clinicalRecord
      ? {
          id: patient.clinicalRecord.id,
          summaryNotes: patient.clinicalRecord.summaryNotes,
          allergies: patient.clinicalRecord.allergies,
          medicalNotes: patient.clinicalRecord.medicalNotes,
          updatedAt: patient.clinicalRecord.updatedAt,
        }
      : null,
    stats: {
      appointments: patient._count?.appointments || 0,
      treatments: patient._count?.treatments || 0,
      images: patient._count?.clinicalImages || 0,
    },
  };
}

function getPatientPayload(body = {}) {
  return {
    fullName: String(body.fullName || "").trim(),
    dni: normalizeDni(body.dni || ""),
    birthDate: body.birthDate ? new Date(body.birthDate) : null,
    phone: body.phone ? String(body.phone).trim() : null,
    email: body.email ? String(body.email).trim().toLowerCase() : null,
    address: body.address ? String(body.address).trim() : null,
    insuranceName: body.insuranceName ? String(body.insuranceName).trim() : null,
    insurancePlan: body.insurancePlan ? String(body.insurancePlan).trim() : null,
    credentialNumber: body.credentialNumber ? String(body.credentialNumber).trim() : null,
    chartNumber: body.chartNumber ? String(body.chartNumber).trim() : null,
    active: body.active !== undefined ? Boolean(body.active) : true,
    summaryNotes: body.summaryNotes ? String(body.summaryNotes).trim() : null,
    allergies: body.allergies ? String(body.allergies).trim() : null,
    medicalNotes: body.medicalNotes ? String(body.medicalNotes).trim() : null,
  };
}

async function validatePatientUniqueness(payload, currentPatientId = null) {
  const conflicts = [];

  const existingByDni = await prisma.patient.findFirst({
    where: {
      dni: payload.dni,
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
      ...(currentPatientId ? { id: { not: currentPatientId } } : {}),
    },
    select: { id: true, fullName: true },
  });

  if (existingByName) {
    conflicts.push(`Ya existe un paciente con el nombre ${existingByName.fullName}.`);
  }

  return conflicts;
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const search = String(req.query.q || "").trim();
    const accessWhere = buildPatientAccessWhere(req.permissions);

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
      include: {
        clinicalRecord: true,
        _count: {
          select: {
            appointments: true,
            treatments: true,
            clinicalImages: true,
          },
        },
      },
    });

    return res.json({
      ok: true,
      patients: patients.map(serializePatient),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudieron listar los pacientes.",
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const patientId = Number(req.params.id);

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ...buildPatientAccessWhere(req.permissions),
      },
      include: {
        clinicalRecord: true,
        _count: {
          select: {
            appointments: true,
            treatments: true,
            clinicalImages: true,
          },
        },
      },
    });

    if (!patient) {
      return res.status(404).json({
        ok: false,
        error: "Paciente no encontrado o sin acceso.",
      });
    }

    return res.json({
      ok: true,
      patient: serializePatient(patient),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo obtener el paciente.",
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (!canManagePatients(req.permissions)) {
      return res.status(403).json({
        ok: false,
        error: "No tenes permisos para crear pacientes.",
      });
    }

    const payload = getPatientPayload(req.body);

    if (!payload.fullName || !payload.dni) {
      return res.status(400).json({
        ok: false,
        error: "Nombre completo y DNI son obligatorios.",
      });
    }

    const conflicts = await validatePatientUniqueness(payload);

    if (conflicts.length > 0) {
      return res.status(409).json({
        ok: false,
        error: conflicts[0],
        conflicts,
      });
    }

    const patient = await prisma.patient.create({
      data: {
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
        clinicalRecord: {
          create: {
            summaryNotes: payload.summaryNotes,
            allergies: payload.allergies,
            medicalNotes: payload.medicalNotes,
          },
        },
      },
      include: {
        clinicalRecord: true,
        _count: {
          select: {
            appointments: true,
            treatments: true,
            clinicalImages: true,
          },
        },
      },
    });

    return res.status(201).json({
      ok: true,
      patient: serializePatient(patient),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo crear el paciente.",
    });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    if (!canEditPatient(req.permissions)) {
      return res.status(403).json({
        ok: false,
        error: "No tenes permisos para editar pacientes.",
      });
    }

    const patientId = Number(req.params.id);
    const existingPatient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ...buildPatientAccessWhere(req.permissions),
      },
      include: {
        clinicalRecord: true,
      },
    });

    if (!existingPatient) {
      return res.status(404).json({
        ok: false,
        error: "Paciente no encontrado o sin acceso.",
      });
    }

    const payload = getPatientPayload(req.body);

    if (!payload.fullName || !payload.dni) {
      return res.status(400).json({
        ok: false,
        error: "Nombre completo y DNI son obligatorios.",
      });
    }

    const conflicts = await validatePatientUniqueness(payload, patientId);

    if (conflicts.length > 0) {
      return res.status(409).json({
        ok: false,
        error: conflicts[0],
        conflicts,
      });
    }

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: {
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
        clinicalRecord: existingPatient.clinicalRecord
          ? {
              update: {
                summaryNotes: payload.summaryNotes,
                allergies: payload.allergies,
                medicalNotes: payload.medicalNotes,
              },
            }
          : {
              create: {
                summaryNotes: payload.summaryNotes,
                allergies: payload.allergies,
                medicalNotes: payload.medicalNotes,
              },
            },
      },
      include: {
        clinicalRecord: true,
        _count: {
          select: {
            appointments: true,
            treatments: true,
            clinicalImages: true,
          },
        },
      },
    });

    return res.json({
      ok: true,
      patient: serializePatient(patient),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo actualizar el paciente.",
    });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!canDeletePatient(req.permissions)) {
      return res.status(403).json({
        ok: false,
        error: "Solo el superadmin puede eliminar pacientes.",
      });
    }

    const patientId = Number(req.params.id);

    await prisma.patient.delete({
      where: { id: patientId },
    });

    return res.json({
      ok: true,
      message: "Paciente eliminado correctamente.",
    });
  } catch (error) {
    const message =
      error?.code === "P2003"
        ? "No se puede eliminar el paciente porque tiene registros relacionados."
        : "No se pudo eliminar el paciente.";

    return res.status(400).json({
      ok: false,
      error: message,
    });
  }
});

module.exports = router;
