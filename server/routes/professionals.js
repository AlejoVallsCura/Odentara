const express = require("express");

const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const {
  hasRole,
  canManageProfessionals,
  canManageProfessionalSchedules,
  canViewProfessionals,
} = require("../lib/permissions");
const { buildProfessionalAccessWhere } = require("../lib/access");
const { checkProfessionalLimit } = require("../lib/plan-limits");
const { parseId } = require("../lib/parse-id");
const {
  serializeProfessional,
  normalizeSchedules,
  normalizeExceptions,
  normalizeColor,
  PROFESSIONAL_INCLUDE,
} = require("../services/professional.service");

const router = express.Router();

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canViewProfessionals(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver profesionales." });
    }

    const search = String(req.query.q || "").trim();
    const professionals = await prisma.professional.findMany({
      where: {
        AND: [
          buildProfessionalAccessWhere(req.permissions, req.user.clinicId),
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
      include: PROFESSIONAL_INCLUDE,
    });

    return res.json({ ok: true, professionals: professionals.map(serializeProfessional) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los profesionales." });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canViewProfessionals(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para ver profesionales." });
    }

    const professionalId = parseId(req.params.id);
    if (!professionalId) return res.status(400).json({ ok: false, error: "ID de profesional inválido." });

    const professional = await prisma.professional.findFirst({
      where: {
        id: professionalId,
        ...buildProfessionalAccessWhere(req.permissions, req.user.clinicId),
      },
      include: PROFESSIONAL_INCLUDE,
    });

    if (!professional) {
      return res.status(404).json({ ok: false, error: "Profesional no encontrado o sin acceso." });
    }

    return res.json({ ok: true, professional: serializeProfessional(professional) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo obtener el profesional." });
  }
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManageProfessionals(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear profesionales." });
    }

    const fullName  = String(req.body.fullName || "").trim();
    const specialty = req.body.specialty ? String(req.body.specialty).trim() : null;
    const email     = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
    const phone     = req.body.phone ? String(req.body.phone).trim() : null;
    const color     = normalizeColor(req.body.color);
    const active    = req.body.active !== undefined ? Boolean(req.body.active) : true;
    const schedules  = normalizeSchedules(req.body.schedules || []);
    const exceptions = normalizeExceptions(req.body.exceptions || []);

    if (!fullName) {
      return res.status(400).json({ ok: false, error: "El nombre del profesional es obligatorio." });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId }, select: { plan: true } });

    if (email) {
      const existingByEmail = await prisma.professional.findFirst({
        where: { email, clinicId: req.user.clinicId, deletedAt: null },
      });
      if (existingByEmail) {
        return res.status(409).json({ ok: false, error: "Ya existe un profesional con ese email." });
      }
    }

    let professional;
    try {
      professional = await prisma.$transaction(async (tx) => {
        const currentCount = await tx.professional.count({
          where: { clinicId: req.user.clinicId, deletedAt: null },
        });
        const planCheck = checkProfessionalLimit(clinic?.plan, currentCount);
        if (!planCheck.allowed) {
          const err = new Error(planCheck.error);
          err.code = "PLAN_LIMIT";
          throw err;
        }
        return tx.professional.create({
          data: {
            clinicId: req.user.clinicId,
            fullName, specialty, email, phone, color, active,
            deletedAt: null,
            schedules:  schedules.length  > 0 ? { create: schedules  } : undefined,
            scheduleExceptions: exceptions.length > 0 ? { create: exceptions } : undefined,
          },
          include: PROFESSIONAL_INCLUDE,
        });
      });
    } catch (err) {
      if (err.code === "PLAN_LIMIT") {
        return res.status(403).json({ ok: false, error: err.message, code: "PLAN_LIMIT" });
      }
      return res.status(500).json({ ok: false, error: "No se pudo crear el profesional." });
    }

    return res.status(201).json({ ok: true, professional: serializeProfessional(professional) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el profesional." });
  }
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    const professionalId = parseId(req.params.id);
    if (!professionalId) return res.status(400).json({ ok: false, error: "ID de profesional inválido." });

    const isProfessionalEditingOwn =
      hasRole(req.permissions, "professional") &&
      req.permissions?.assignedProfessionalId === professionalId;

    if (!canManageProfessionalSchedules(req.permissions) && !isProfessionalEditingOwn) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar profesionales." });
    }

    const existing = await prisma.professional.findFirst({
      where: { id: professionalId, clinicId: req.user.clinicId, deletedAt: null },
      include: { schedules: true, scheduleExceptions: true },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Profesional no encontrado." });
    }

    const canEditCore = canManageProfessionals(req.permissions);
    const fullName  = canEditCore ? String(req.body.fullName || "").trim() : existing.fullName;
    const specialty = canEditCore ? (req.body.specialty ? String(req.body.specialty).trim() : null) : existing.specialty;
    const email     = canEditCore ? (req.body.email ? String(req.body.email).trim().toLowerCase() : null) : existing.email;
    const phone     = canEditCore ? (req.body.phone ? String(req.body.phone).trim() : null) : existing.phone;
    const color     = canEditCore ? normalizeColor(req.body.color) : existing.color;
    const active    = canEditCore && req.body.active !== undefined ? Boolean(req.body.active) : existing.active;
    const hasSchedules  = Array.isArray(req.body.schedules);
    const hasExceptions = Array.isArray(req.body.exceptions);
    const schedules  = hasSchedules  ? normalizeSchedules(req.body.schedules)  : [];
    const exceptions = hasExceptions ? normalizeExceptions(req.body.exceptions) : [];

    if (!fullName) {
      return res.status(400).json({ ok: false, error: "El nombre del profesional es obligatorio." });
    }

    if (canEditCore && email) {
      const existingByEmail = await prisma.professional.findFirst({
        where: { email, clinicId: req.user.clinicId, id: { not: professionalId } },
      });
      if (existingByEmail) {
        return res.status(409).json({ ok: false, error: "Ya existe un profesional con ese email." });
      }
    }

    const professional = await prisma.professional.update({
      where: { id: professionalId },
      data: {
        fullName, specialty, email, phone, color, active,
        deletedAt: null,
        ...(hasSchedules  ? { schedules:          { deleteMany: {}, create: schedules  } } : {}),
        ...(hasExceptions ? { scheduleExceptions: { deleteMany: {}, create: exceptions } } : {}),
      },
      include: PROFESSIONAL_INCLUDE,
    });

    return res.json({ ok: true, professional: serializeProfessional(professional) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el profesional." });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManageProfessionals(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar profesionales." });
    }

    const professionalId = parseId(req.params.id);
    if (!professionalId) return res.status(400).json({ ok: false, error: "ID de profesional inválido." });

    const existing = await prisma.professional.findFirst({
      where: { id: professionalId, clinicId: req.user.clinicId, deletedAt: null },
      include: { schedules: true, scheduleExceptions: true },
    });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ ok: false, error: "Profesional no encontrado." });
    }

    await prisma.professional.update({
      where: { id: professionalId },
      data: { active: false, deletedAt: new Date() },
    });

    await logDeleteAudit(prisma, req.user.id, "Professional", professionalId, { professional: existing });

    return res.json({ ok: true, message: "Profesional eliminado correctamente." });
  } catch (error) {
    const message =
      error?.code === "P2003"
        ? "No se puede eliminar el profesional porque tiene registros relacionados."
        : "No se pudo eliminar el profesional.";
    return res.status(400).json({ ok: false, error: message });
  }
});

module.exports = router;
