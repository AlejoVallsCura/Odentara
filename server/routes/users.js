const express = require("express");
const bcrypt = require("bcrypt");

const prisma = require("../lib/prisma");
const { logDeleteAudit } = require("../lib/audit");
const { normalizeEmail, serializeUser, buildPermissionSummary } = require("../lib/auth");
const { requireAuth, requireAnyRole } = require("../middleware/auth");

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

router.get("/", requireAuth, requireAnyRole(["superadmin", "admin"]), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
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
  try {
    const fullName = String(req.body?.fullName || req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email || "");
    const password = String(req.body?.password || "");
    const requestedRoles = normalizeRequestedRoles(req.body?.roles || []);
    const allowedProfessionalIds = Array.isArray(req.body?.allowedProfessionalIds)
      ? req.body.allowedProfessionalIds.map((value) => Number(value)).filter(Number.isInteger)
      : Array.isArray(req.body?.allowedProfessionals)
        ? req.body.allowedProfessionals.map((value) => Number(value)).filter(Number.isInteger)
        : [];

    if (!fullName || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Nombre, email y contraseña son obligatorios.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        error: "La contraseña debe tener al menos 6 caracteres.",
      });
    }

    if (requestedRoles.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Selecciona al menos un rol para el usuario.",
      });
    }

    if (!req.permissions?.isSuperadmin && requestedRoles.includes("superadmin")) {
      return res.status(403).json({
        ok: false,
        error: "Solo un superadmin puede crear usuarios con rol superadmin.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        ok: false,
        error: "Ya existe un usuario con ese email.",
      });
    }

    if (allowedProfessionalIds.length > 0) {
      const professionals = await prisma.professional.findMany({
        where: { id: { in: allowedProfessionalIds } },
        select: { id: true },
      });

      if (professionals.length !== allowedProfessionalIds.length) {
        return res.status(400).json({
          ok: false,
          error: "Uno o más profesionales asignados no existen.",
        });
      }
    }

    const roles = await prisma.role.findMany({
      where: {
        code: {
          in: requestedRoles,
        },
      },
    });

    if (roles.length !== requestedRoles.length) {
      return res.status(400).json({
        ok: false,
        error: "Se recibieron roles inválidos para el usuario.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
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

    return res.status(201).json({
      ok: true,
      user: {
        ...serializeUser(user),
        permissions: buildPermissionSummary(user),
        allowedProfessionals: user.professionalScopes.map((scope) => ({
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
    return res.status(500).json({
      ok: false,
      error: "No se pudo crear el usuario.",
    });
  }
});

router.delete("/:id", requireAuth, requireAnyRole(["superadmin"]), async (req, res) => {
  try {
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

    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
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
