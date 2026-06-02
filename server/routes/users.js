const express = require("express");
const bcrypt = require("bcrypt");

const { logDeleteAudit } = require("../lib/audit");
const { normalizeEmail, serializeUser, buildPermissionSummary } = require("../lib/auth");
const { requireAuth, requireAnyRole } = require("../middleware/auth");
const { checkAdminUserLimit } = require("../lib/plan-limits");

const router = express.Router();

const ROLE_LABELS = {
  superadmin: "Superadmin",
  admin: "Administrador",
  secretary: "Secretario",
  professional: "Profesional",
};

const ROLE_ALIASES = {
  superadmin: "superadmin",
  administrador: "admin",
  admin: "admin",
  secretary: "secretary",
  secretario: "secretary",
  professional: "professional",
  profesional: "professional",
};

function normalizeRequestedRoles(rawRoles = []) {
  return Array.from(
    new Set(
      rawRoles
        .map((role) => ROLE_ALIASES[String(role || "").trim().toLowerCase()])
        .filter(Boolean),
    ),
  );
}

router.get("/", requireAuth, requireAnyRole(["superadmin", "admin"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const users = await prisma.user.findMany({
      where: { deletedAt: null, clinicId: req.user.clinicId },
      orderBy: { id: "asc" },
      include: {
        roles: { include: { role: true } },
        professionalScopes: {
          include: {
            professional: true,
          },
        },
        assignedProfessional: true,
      },
    });

    return res.json({
      ok: true,
      users: users.map((user) => ({
        ...serializeUser(user),
        permissions: buildPermissionSummary(user),
        allowedProfessionals: user.professionalScopes.map((scope) => ({
          id: scope.professional.id,
          fullName: scope.professional.fullName,
        })),
      })),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudieron listar los usuarios.",
    });
  }
});

router.post("/", requireAuth, requireAnyRole(["superadmin", "admin"]), async (req, res) => {
  // Aseguramos que el nuevo usuario pertenece a la misma clínica que quien lo crea
  try {
    const prisma = req.prisma;
    const fullName = String(req.body?.fullName || req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email || "");
    const password = String(req.body?.password || "");
    const requestedRoles = normalizeRequestedRoles(req.body?.roles || []);
    const allowedProfessionalIds = Array.isArray(req.body?.allowedProfessionalIds)
      ? req.body.allowedProfessionalIds.map((value) => Number(value)).filter(Number.isInteger)
      : Array.isArray(req.body?.allowedProfessionals)
        ? req.body.allowedProfessionals.map((value) => Number(value)).filter(Number.isInteger)
        : [];
    const linkedProfessionalId = req.body?.linkedProfessionalId ? Number(req.body.linkedProfessionalId) : null;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Nombre, email y contraseña son obligatorios.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "La contraseña debe tener al menos 8 caracteres.",
      });
    }

    if (requestedRoles.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Selecciona al menos un rol para el usuario.",
      });
    }

    if (requestedRoles.includes("superadmin")) {
      return res.status(403).json({
        ok: false,
        error: "El rol superadmin no puede asignarse desde este panel. Contactá al administrador de la plataforma.",
      });
    }

    // ── Verificar límite de plan para usuarios admin/secretary ────────────────
    const ADMIN_ROLES = ["admin", "secretary"];
    const isCreatingAdminUser = requestedRoles.some((r) => ADMIN_ROLES.includes(r));
    if (isCreatingAdminUser) {
      const clinic = await prisma.clinic.findUnique({ where: { id: req.user.clinicId }, select: { plan: true } });
      const planCheck = checkAdminUserLimit(clinic?.plan);
      if (!planCheck.allowed) {
        return res.status(403).json({ ok: false, error: planCheck.error, code: 'PLAN_LIMIT' });
      }
    }

    const roles = await prisma.role.findMany({ where: { code: { in: requestedRoles } } });
    if (roles.length !== requestedRoles.length) {
      return res.status(400).json({ ok: false, error: "Se recibieron roles inválidos para el usuario." });
    }

    // Verificar unicidad dentro de esta clínica
    const existingInClinic = await prisma.user.findFirst({
      where: { email, clinicId: req.user.clinicId },
      select: { id: true, deletedAt: true },
    });

    // Si ya existe un usuario activo con ese email → conflicto real
    if (existingInClinic && !existingInClinic.deletedAt) {
      return res.status(409).json({
        ok: false,
        error: "Ya existe un usuario con ese email en esta clínica.",
      });
    }

    // Si existe pero fue eliminado (soft-delete) → restaurarlo en vez de crear uno nuevo.
    // Esto preserva los vínculos con turnos y fichas clínicas del usuario anterior.
    if (existingInClinic && existingInClinic.deletedAt) {
      const passwordHash = await bcrypt.hash(password, 10);
      await require("../lib/prisma").user.updateMany({
        where: { email, deletedAt: null },
        data: { passwordHash },
      });
      await prisma.userRole.deleteMany({ where: { userId: existingInClinic.id } });
      await prisma.userProfessionalScope.deleteMany({ where: { userId: existingInClinic.id } });
      const restoredUser = await prisma.user.update({
        where: { id: existingInClinic.id },
        data: {
          fullName,
          passwordHash,
          active: true,
          deletedAt: null,
          roles: { create: roles.map((role) => ({ roleId: role.id })) },
          professionalScopes: allowedProfessionalIds.length > 0
            ? { create: allowedProfessionalIds.map((professionalId) => ({ professionalId })) }
            : undefined,
        },
        include: {
          roles: { include: { role: true } },
          professionalScopes: { include: { professional: true } },
          assignedProfessional: true,
        },
      });
      if (linkedProfessionalId && requestedRoles.includes("professional")) {
        const linkedProf = await prisma.professional.findFirst({
          where: { id: linkedProfessionalId, clinicId: req.user.clinicId, deletedAt: null },
          select: { id: true },
        });
        if (linkedProf) {
          await prisma.professional.update({ where: { id: linkedProfessionalId }, data: { userId: restoredUser.id } });
        }
      }
      const freshRestored = await prisma.user.findUnique({
        where: { id: restoredUser.id },
        include: { roles: { include: { role: true } }, professionalScopes: { include: { professional: true } }, assignedProfessional: true },
      });
      return res.status(201).json({
        ok: true,
        user: { ...serializeUser(freshRestored), permissions: buildPermissionSummary(freshRestored), allowedProfessionals: freshRestored.professionalScopes.map((s) => ({ id: s.professional.id, fullName: s.professional.fullName })) },
        message: "Usuario restaurado correctamente.",
        meta: { roleLabels: roles.map((role) => ROLE_LABELS[role.code] || role.code), restored: true },
      });
    }

    if (allowedProfessionalIds.length > 0) {
      const professionals = await prisma.professional.findMany({
        where: { id: { in: allowedProfessionalIds }, clinicId: req.user.clinicId, deletedAt: null },
        select: { id: true },
      });

      if (professionals.length !== allowedProfessionalIds.length) {
        return res.status(400).json({
          ok: false,
          error: "Uno o más profesionales asignados no existen.",
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Sincronizar contraseña compartida: si el email ya existe en otras clínicas,
    // actualizar el hash allí también para mantener una única contraseña por identidad.
    await require("../lib/prisma").user.updateMany({
      where: { email, deletedAt: null },
      data: { passwordHash },
    });

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        clinicId: req.user.clinicId,
        roles: {
          create: roles.map((role) => ({
            roleId: role.id,
          })),
        },
        professionalScopes:
          allowedProfessionalIds.length > 0
            ? {
                create: allowedProfessionalIds.map((professionalId) => ({
                  professionalId,
                })),
              }
            : undefined,
      },
      include: {
        roles: { include: { role: true } },
        professionalScopes: {
          include: {
            professional: true,
          },
        },
        assignedProfessional: true,
      },
    });

    // Vincular directamente al profesional si se indicó (solo cuando el rol es 'professional')
    if (linkedProfessionalId && requestedRoles.includes("professional")) {
      const linkedProf = await prisma.professional.findFirst({
        where: { id: linkedProfessionalId, clinicId: req.user.clinicId, deletedAt: null },
        select: { id: true },
      });
      if (!linkedProf) {
        return res.status(403).json({ ok: false, error: "El profesional vinculado no pertenece a esta clínica." });
      }
      await prisma.professional.update({
        where: { id: linkedProfessionalId },
        data: { userId: user.id },
      });
    }

    // Re-fetch con la relación actualizada para serializar correctamente
    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: { include: { role: true } },
        professionalScopes: { include: { professional: true } },
        assignedProfessional: true,
      },
    });

    return res.status(201).json({
      ok: true,
      user: {
        ...serializeUser(freshUser),
        permissions: buildPermissionSummary(freshUser),
        allowedProfessionals: freshUser.professionalScopes.map((scope) => ({
          id: scope.professional.id,
          fullName: scope.professional.fullName,
        })),
      },
      message: "Usuario creado correctamente.",
      meta: {
        roleLabels: roles.map((role) => ROLE_LABELS[role.code] || role.code),
      },
    });
  } catch (_error) {
    console.error("[users] Error creando usuario:", _error);
    if (_error?.code === "P2002") {
      return res.status(409).json({ ok: false, error: "Ya existe un usuario con ese email." });
    }
    return res.status(500).json({
      ok: false,
      error: "No se pudo crear el usuario.",
      ...(process.env.NODE_ENV !== "production" && { detail: _error?.message }),
    });
  }
});

router.put("/:id", requireAuth, requireAnyRole(["superadmin", "admin"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ ok: false, error: "Usuario inválido." });
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, clinicId: req.user.clinicId },
      include: { roles: true, professionalScopes: true },
    });

    if (!existingUser) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado." });
    }

    const fullName = String(req.body?.fullName || req.body?.name || "").trim();
    const email    = normalizeEmail(req.body?.email || "");
    const password = String(req.body?.password || "");
    const requestedRoles = normalizeRequestedRoles(req.body?.roles || []);
    const allowedProfessionalIds = Array.isArray(req.body?.allowedProfessionalIds)
      ? req.body.allowedProfessionalIds.map(Number).filter(Number.isInteger)
      : [];
    const linkedProfessionalId = req.body?.linkedProfessionalId !== undefined
      ? (req.body.linkedProfessionalId ? Number(req.body.linkedProfessionalId) : null)
      : null;

    if (!fullName || !email) {
      return res.status(400).json({ ok: false, error: "Nombre y email son obligatorios." });
    }
    if (requestedRoles.length === 0) {
      return res.status(400).json({ ok: false, error: "Selecciona al menos un rol." });
    }
    if (requestedRoles.includes("superadmin")) {
      return res.status(403).json({ ok: false, error: "El rol superadmin no puede asignarse desde este panel. Contactá al administrador de la plataforma." });
    }
    if (password && password.length < 8) {
      return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres." });
    }

    // Verificar email duplicado dentro de esta clínica (excluyendo al mismo usuario)
    const emailConflict = await prisma.user.findFirst({
      where: { email, clinicId: req.user.clinicId, NOT: { id: userId } },
      select: { id: true, deletedAt: true },
    });
    if (emailConflict) {
      return res.status(409).json({
        ok: false,
        error: emailConflict.deletedAt
          ? "Ya existió un usuario con ese email en esta clínica (fue eliminado). Usá un email diferente o contactá al administrador."
          : "Ya existe otro usuario con ese email en esta clínica.",
      });
    }

    const roles = await prisma.role.findMany({ where: { code: { in: requestedRoles } } });
    if (roles.length !== requestedRoles.length) {
      return res.status(400).json({ ok: false, error: "Roles inválidos." });
    }

    const updateData = { fullName, email };
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
      // Sincronizar contraseña compartida a todas las clínicas de este email
      await require("../lib/prisma").user.updateMany({
        where: { email, deletedAt: null, NOT: { id: userId } },
        data: { passwordHash: updateData.passwordHash },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        roles: {
          deleteMany: {},
          create: roles.map((role) => ({ roleId: role.id })),
        },
        professionalScopes: {
          deleteMany: {},
          ...(allowedProfessionalIds.length > 0
            ? { create: allowedProfessionalIds.map((professionalId) => ({ professionalId })) }
            : {}),
        },
      },
      include: {
        roles: { include: { role: true } },
        professionalScopes: { include: { professional: true } },
        assignedProfessional: true,
      },
    });

    // Actualizar vínculo directo con profesional
    // 1. Desvincula cualquier profesional que este usuario tuviera antes
    await prisma.professional.updateMany({
      where: { userId: userId },
      data: { userId: null },
    });
    // 2. Vincula el nuevo profesional si aplica
    if (linkedProfessionalId && requestedRoles.includes("professional")) {
      const linkedProf = await prisma.professional.findFirst({
        where: { id: linkedProfessionalId, clinicId: req.user.clinicId, deletedAt: null },
        select: { id: true },
      });
      if (!linkedProf) {
        return res.status(403).json({ ok: false, error: "El profesional vinculado no pertenece a esta clínica." });
      }
      await prisma.professional.update({
        where: { id: linkedProfessionalId },
        data: { userId: userId },
      });
    }

    // Re-fetch con relación actualizada
    const freshUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        professionalScopes: { include: { professional: true } },
        assignedProfessional: true,
      },
    });

    return res.json({
      ok: true,
      user: {
        ...serializeUser(freshUser),
        permissions: buildPermissionSummary(freshUser),
        allowedProfessionals: freshUser.professionalScopes.map((s) => ({
          id: s.professional.id,
          fullName: s.professional.fullName,
        })),
      },
      message: "Usuario actualizado correctamente.",
    });
  } catch (error) {
    console.error("[users] Error actualizando usuario:", error);
    if (error?.code === "P2002") {
      return res.status(409).json({ ok: false, error: "Ya existe otro usuario con ese email." });
    }
    return res.status(500).json({
      ok: false,
      error: "No se pudo actualizar el usuario.",
      ...(process.env.NODE_ENV !== "production" && { detail: error?.message }),
    });
  }
});

router.delete("/:id", requireAuth, requireAnyRole(["superadmin"]), async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        ok: false,
        error: "Usuario invalido.",
      });
    }

    if (req.user.id === userId) {
      return res.status(400).json({
        ok: false,
        error: "No podes eliminar tu propio usuario mientras estas logueado.",
      });
    }

    // Proteger al platform admin — nunca puede ser eliminado desde acá
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true } });
    if (targetUser?.isPlatformAdmin) {
      return res.status(403).json({
        ok: false,
        error: "El administrador de plataforma no puede ser eliminado.",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        clinicId: req.user.clinicId,
      },
      include: {
        roles: { include: { role: true } },
        professionalScopes: true,
        assignedProfessional: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        ok: false,
        error: "Usuario no encontrado.",
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });

    await logDeleteAudit(prisma, req.user.id, "User", userId, {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        fullName: existingUser.fullName,
        roles: existingUser.roles.map((item) => item.role.code),
      },
    });

    return res.json({
      ok: true,
      message: "Usuario archivado correctamente.",
    });
  } catch (_error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo eliminar el usuario.",
    });
  }
});

module.exports = router;
