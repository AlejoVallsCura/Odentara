const express = require("express");

const prisma = require("../lib/prisma");
const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const {
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
  canManageProfessionals,
  canManageProfessionalSchedules,
  canViewProfessionals,
} = require("../lib/permissions");

const router = express.Router();

function buildProfessionalAccessWhere(permissions) {
  if (canAccessWholeClinic(permissions)) {
    return { deletedAt: null };
  }

  const ids = getAccessibleProfessionalIds(permissions);
  if (ids.length === 0) {
    return { id: -1 };
  }

  return {
    id: { in: ids },
    deletedAt: null,
  };
}

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

router.get("/", requireAuth, async (req, res) => {
  try {
    if (!canViewProfessionals(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver profesionales." });
    }

    const search = String(req.query.q || "").trim();
    const professionals = await prisma.professional.findMany({
      where: {
        AND: [
          buildProfessionalAccessWhere(req.permissions),
          search
            ? {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" } },
                  { specialty: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ fullName: "asc" }],
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
        schedules: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
        scheduleExceptions: {
          orderBy: [{ date: "asc" }],
        },
        _count: {
          select: {
            appointments: true,
            patientTreatments: true,
          },
        },
      },
    });

    return res.json({
      ok: true,
      professionals: professionals.map(serializeProfessional),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los profesionales." });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    if (!canViewProfessionals(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver profesionales." });
    }

    const professionalId = Number(req.params.id);
    const professional = await prisma.professional.findFirst({
      where: {
        id: professionalId,
        ...buildProfessionalAccessWhere(req.permissions),
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
        schedules: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
        scheduleExceptions: {
          orderBy: [{ date: "asc" }],
        },
        _count: {
          select: {
            appointments: true,
            patientTreatments: true,
          },
        },
      },
    });

    if (!professional) {
      return res.status(404).json({ ok: false, error: "Profesional no encontrado o sin acceso." });
    }

    return res.json({
      ok: true,
      professional: serializeProfessional(professional),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo obtener el profesional." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (!canManageProfessionals(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear profesionales." });
    }

    const fullName = String(req.body.fullName || "").trim();
    const specialty = req.body.specialty ? String(req.body.specialty).trim() : null;
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
    const phone = req.body.phone ? String(req.body.phone).trim() : null;
    const color = req.body.color ? String(req.body.color).trim() : null;
    const active = req.body.active !== undefined ? Boolean(req.body.active) : true;
    const schedules = normalizeSchedules(req.body.schedules || []);
    const exceptions = normalizeExceptions(req.body.exceptions || []);

    if (!fullName) {
      return res.status(400).json({ ok: false, error: "El nombre del profesional es obligatorio." });
    }

    if (email) {
      const existingByEmail = await prisma.professional.findUnique({ where: { email } });
      if (existingByEmail) {
        return res.status(409).json({ ok: false, error: "Ya existe un profesional con ese email." });
      }
    }

    const professional = await prisma.professional.create({
      data: {
        fullName,
        specialty,
        email,
        phone,
        color,
        active,
        deletedAt: null,
        schedules: schedules.length > 0 ? { create: schedules } : undefined,
        scheduleExceptions: exceptions.length > 0 ? { create: exceptions } : undefined,
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
        schedules: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
        scheduleExceptions: {
          orderBy: [{ date: "asc" }],
        },
        _count: {
          select: {
            appointments: true,
            patientTreatments: true,
          },
        },
      },
    });

    return res.status(201).json({
      ok: true,
      professional: serializeProfessional(professional),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el profesional." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    if (!canManageProfessionalSchedules(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar profesionales." });
    }

    const professionalId = Number(req.params.id);
    const existing = await prisma.professional.findFirst({
      where: { id: professionalId, deletedAt: null },
      include: {
        schedules: true,
        scheduleExceptions: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Profesional no encontrado." });
    }

    const canEditCoreData = canManageProfessionals(req.permissions);
    const fullName = canEditCoreData ? String(req.body.fullName || "").trim() : existing.fullName;
    const specialty = canEditCoreData
      ? (req.body.specialty ? String(req.body.specialty).trim() : null)
      : existing.specialty;
    const email = canEditCoreData
      ? (req.body.email ? String(req.body.email).trim().toLowerCase() : null)
      : existing.email;
    const phone = canEditCoreData
      ? (req.body.phone ? String(req.body.phone).trim() : null)
      : existing.phone;
    const color = canEditCoreData
      ? (req.body.color ? String(req.body.color).trim() : null)
      : existing.color;
    const active = canEditCoreData && req.body.active !== undefined ? Boolean(req.body.active) : existing.active;
    const schedules = normalizeSchedules(req.body.schedules || []);
    const exceptions = normalizeExceptions(req.body.exceptions || []);

    if (!fullName) {
      return res.status(400).json({ ok: false, error: "El nombre del profesional es obligatorio." });
    }

    if (canEditCoreData && email) {
      const existingByEmail = await prisma.professional.findFirst({
        where: { email, id: { not: professionalId } },
      });
      if (existingByEmail) {
        return res.status(409).json({ ok: false, error: "Ya existe un profesional con ese email." });
      }
    }

    const professional = await prisma.professional.update({
      where: { id: professionalId },
      data: {
        fullName,
        specialty,
        email,
        phone,
        color,
        active,
        deletedAt: null,
        schedules: {
          deleteMany: {},
          create: schedules,
        },
        scheduleExceptions: {
          deleteMany: {},
          create: exceptions,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
        schedules: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
        scheduleExceptions: {
          orderBy: [{ date: "asc" }],
        },
        _count: {
          select: {
            appointments: true,
            patientTreatments: true,
          },
        },
      },
    });

    return res.json({
      ok: true,
      professional: serializeProfessional(professional),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el profesional." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!canManageProfessionals(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar profesionales." });
    }

    const professionalId = Number(req.params.id);
    const existing = await prisma.professional.findFirst({
      where: { id: professionalId, deletedAt: null },
      include: {
        schedules: true,
        scheduleExceptions: true,
      },
    });

    if (!existing || existing.deletedAt) {
      return res.status(404).json({ ok: false, error: "Profesional no encontrado." });
    }

    await prisma.professional.update({
      where: { id: professionalId },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });

    await logDeleteAudit(prisma, req.user.id, "Professional", professionalId, {
      professional: existing,
    });

    return res.json({
      ok: true,
      message: "Profesional eliminado correctamente.",
    });
  } catch (error) {
    const message =
      error?.code === "P2003"
        ? "No se puede eliminar el profesional porque tiene registros relacionados."
        : "No se pudo eliminar el profesional.";

    return res.status(400).json({ ok: false, error: message });
  }
});

module.exports = router;
