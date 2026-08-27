const express = require("express");
const bcrypt = require("bcrypt");

const { normalizeEmail, serializeUser, buildPermissionSummary } = require("../lib/auth");
const { requireAuth, requireAnyRole } = require("../middleware/auth");
const { checkAdminUserLimit } = require("../lib/plan-limits");
const { ROLE_LABELS, normalizeRequestedRoles } = require("../services/user.service");
const { codigosDeRol, evaluarEdicionDeUsuario } = require("../lib/user-authz");

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Reglas de autorización y validación compartidas
//
// Los tres endpoints de escritura (crear, restaurar y editar) repetían las
// mismas comprobaciones de forma desigual: la validación de profesionales
// existía en el create pero no en el restore ni en el update, y en los tres
// casos se escribía en la base antes de terminar de validar. Eso dejaba
// usuarios a medio crear cuando la última validación fallaba.
// ─────────────────────────────────────────────────────────────────────────────

/** Verifica que todos los profesionales pertenezcan a la clínica de quien pide. */
async function validarProfesionalesDeLaClinica(prisma, ids, clinicId) {
  if (!ids || ids.length === 0) return null;
  const encontrados = await prisma.professional.findMany({
    where: { id: { in: ids }, clinicId, deletedAt: null },
    select: { id: true },
  });
  if (encontrados.length !== ids.length) {
    return "Uno o más profesionales asignados no existen en esta clínica.";
  }
  return null;
}

/** Ídem para el vínculo directo usuario ↔ profesional. */
async function validarProfesionalVinculado(prisma, id, clinicId) {
  if (!id) return null;
  const profesional = await prisma.professional.findFirst({
    where: { id, clinicId, deletedAt: null },
    select: { id: true },
  });
  return profesional ? null : "El profesional vinculado no pertenece a esta clínica.";
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

    // Toda la validación ocurre ANTES de la primera escritura. Antes, el
    // profesional vinculado se validaba después de crear el usuario: si esa
    // validación fallaba, la respuesta era 403 pero el usuario ya existía.
    const errorScopes = await validarProfesionalesDeLaClinica(prisma, allowedProfessionalIds, req.user.clinicId);
    if (errorScopes) {
      return res.status(400).json({ ok: false, error: errorScopes });
    }

    const vinculaProfesional = Boolean(linkedProfessionalId) && requestedRoles.includes("professional");
    if (vinculaProfesional) {
      const errorVinculo = await validarProfesionalVinculado(prisma, linkedProfessionalId, req.user.clinicId);
      if (errorVinculo) {
        return res.status(403).json({ ok: false, error: errorVinculo });
      }
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

      // SEGURIDAD: acá había un `updateMany` sobre TODAS las cuentas activas con
      // este email —en todas las clínicas, y contra la base principal saltándose
      // req.prisma—. Eso permitía que un admin de la clínica A creara un usuario
      // con el email de alguien de la clínica B, eligiera la contraseña y entrara
      // a esa otra clínica. La restauración toca únicamente la cuenta de esta
      // clínica, igual que ya hacían el create y el update.
      const restoredUser = await prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({ where: { userId: existingInClinic.id } });
        await tx.userProfessionalScope.deleteMany({ where: { userId: existingInClinic.id } });
        const usuario = await tx.user.update({
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
          select: { id: true },
        });
        if (vinculaProfesional) {
          await tx.professional.update({
            where: { id: linkedProfessionalId },
            data: { userId: usuario.id },
          });
        }
        return usuario;
      });

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

    const passwordHash = await bcrypt.hash(password, 10);
    // SEGURIDAD: No sincronizamos el hash cross-clínica al CREAR un usuario.
    // Un admin de clínica A no debe poder sobrescribir la contraseña de un usuario
    // que también existe en clínica B. Cada clínica gestiona sus propias credenciales.

    // El alta y el vínculo con el profesional van en la misma transacción: antes
    // el usuario se creaba primero y el vínculo se validaba después, así que un
    // profesional inválido devolvía 403 dejando el usuario ya creado.
    const user = await prisma.$transaction(async (tx) => {
      const creado = await tx.user.create({
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
        select: { id: true },
      });

      if (vinculaProfesional) {
        await tx.professional.update({
          where: { id: linkedProfessionalId },
          data: { userId: creado.id },
        });
      }

      return creado;
    });

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

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ ok: false, error: "Usuario inválido." });
    }

    const isManager = req.permissions?.roles?.some(r => ["superadmin", "admin"].includes(r));
    const esAutoedicion = userId === req.user.id;
    if (!isManager && !esAutoedicion) {
      return res.status(403).json({ ok: false, error: "Solo podés editar tu propio usuario." });
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, clinicId: req.user.clinicId },
      include: { roles: { include: { role: true } }, professionalScopes: true },
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

    // ── Jerarquía ────────────────────────────────────────────────────────────
    //
    // Las reglas viven en lib/user-authz.js, como función pura y con tests. Este
    // endpoint aceptaba `roles` del body y los aplicaba con deleteMany + create,
    // y dejaba pasar a cualquiera que se estuviera editando a sí mismo: una
    // secretaria mandaba roles:["admin"] sobre su propio usuario y quedaba como
    // administradora de la clínica.
    const rechazo = evaluarEdicionDeUsuario({
      rolesDelActor: req.permissions?.roles || [],
      rolesActuales: codigosDeRol(existingUser),
      rolesPedidos: requestedRoles,
      esAutoedicion,
      cambiaPassword: Boolean(password),
    });
    if (rechazo) {
      return res.status(rechazo.status).json({ ok: false, error: rechazo.error });
    }

    // Quien no administra usuarios solo puede tocar sus datos propios. Los
    // alcances y el vínculo con profesionales quedan como estaban, se manden o
    // no en el body.
    const puedeGestionarAlcances = Boolean(isManager);

    // ── Validación previa a cualquier escritura ──────────────────────────────
    if (puedeGestionarAlcances) {
      const errorScopes = await validarProfesionalesDeLaClinica(prisma, allowedProfessionalIds, req.user.clinicId);
      if (errorScopes) {
        return res.status(400).json({ ok: false, error: errorScopes });
      }
    }

    const vinculaProfesional = puedeGestionarAlcances
      && Boolean(linkedProfessionalId)
      && requestedRoles.includes("professional");

    if (vinculaProfesional) {
      const errorVinculo = await validarProfesionalVinculado(prisma, linkedProfessionalId, req.user.clinicId);
      if (errorVinculo) {
        return res.status(403).json({ ok: false, error: errorVinculo });
      }
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
      // Cerrar las sesiones abiertas de ese usuario: si le cambian la contraseña
      // (por ejemplo porque la cuenta quedó comprometida), los tokens que ya
      // estaban en circulación tienen que dejar de servir.
      updateData.sessionsValidFrom = new Date();
      // SEGURIDAD: No sincronizamos el hash cross-clínica al editar un usuario.
      // El cambio de contraseña aplica solo al usuario de esta clínica.
      // (La sincronización anterior permitía a un admin de clínica A sobrescribir
      //  la contraseña de un usuario de clínica B sin su consentimiento.)
    }

    // Todo en una transacción: antes el usuario y sus roles se escribían primero
    // y el profesional vinculado se validaba después, así que un 403 en esa
    // validación dejaba los roles ya cambiados y el profesional desvinculado.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          roles: {
            deleteMany: {},
            create: roles.map((role) => ({ roleId: role.id })),
          },
          // Los alcances solo los toca quien administra usuarios. En una
          // autoedición se dejan como están, se manden o no en el body.
          ...(puedeGestionarAlcances
            ? {
                professionalScopes: {
                  deleteMany: {},
                  ...(allowedProfessionalIds.length > 0
                    ? { create: allowedProfessionalIds.map((professionalId) => ({ professionalId })) }
                    : {}),
                },
              }
            : {}),
        },
        select: { id: true },
      });

      if (puedeGestionarAlcances) {
        // Desvincula cualquier profesional que este usuario tuviera antes...
        await tx.professional.updateMany({
          where: { userId: userId },
          data: { userId: null },
        });
        // ...y vincula el nuevo, ya validado contra la clínica más arriba.
        if (vinculaProfesional) {
          await tx.professional.update({
            where: { id: linkedProfessionalId },
            data: { userId: userId },
          });
        }
      }
    });

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
