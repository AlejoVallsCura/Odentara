const prisma = require("../lib/prisma");
const { verifyToken, buildPermissionSummary } = require("../lib/auth");
const { getClinicPrisma } = require("../lib/clinic-prisma");
const { isRevoked } = require("../lib/token-revocation");
const { runWithAuditContext } = require("../lib/audit-context");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Token requerido." });
    }

    const payload = verifyToken(token);

    if (await isRevoked(payload.jti)) {
      return res.status(401).json({ ok: false, error: "Sesión cerrada. Iniciá sesión nuevamente." });
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        professionalScopes: true,
        assignedProfessional: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({ ok: false, error: "Usuario no disponible." });
    }

    // Corte masivo de sesiones: si la contraseña se cambió después de emitirse
    // este token, el token deja de valer. Cubre el caso de una cuenta
    // comprometida, donde revocar de a un token no alcanza porque no se sabe
    // cuántas sesiones abrió el atacante. `iat` viene en segundos.
    if (user.sessionsValidFrom && payload.iat) {
      if (payload.iat * 1000 < user.sessionsValidFrom.getTime()) {
        return res.status(401).json({
          ok: false,
          error: "Tu contraseña cambió. Iniciá sesión nuevamente.",
        });
      }
    }

    // Bloquear si la clínica fue desactivada (aunque el token siga válido)
    // Y si hay subdominio, verificar que el token corresponde a esa clínica
    if (!user.isPlatformAdmin && user.clinicId) {
      const clinicSlug = req.clinicSlug; // seteado por clinic-resolver.js

      const clinic = await prisma.clinic.findUnique({
        where: { id: user.clinicId },
        select: { active: true, slug: true },
      });

      if (!clinic || !clinic.active) {
        return res.status(403).json({
          ok: false,
          error: "Tu clínica está desactivada. Contactá al administrador de la plataforma.",
          code: "CLINIC_INACTIVE",
        });
      }

      // Si el request viene de un subdominio específico, verificar que el token
      // pertenece a esa clínica. Evita usar el token de clínica-A en clínica-B.
      // Solo se bloquea si el slug corresponde a una clínica real en la DB;
      // dominios genéricos de hosting (ej: preview.hostinger.app) se ignoran.
      if (clinicSlug && clinic.slug !== clinicSlug) {
        const slugClinic = await prisma.clinic.findUnique({
          where: { slug: clinicSlug },
          select: { id: true },
        });
        if (slugClinic) {
          return res.status(403).json({
            ok: false,
            error: "Token no válido para esta clínica.",
            code: "CLINIC_MISMATCH",
          });
        }
      }
    }

    // Bloquear usuarios sin clínica asignada en subdominios de clínica
    if (!user.isPlatformAdmin && !user.clinicId && req.clinicSlug) {
      return res.status(403).json({
        ok: false,
        error: "Esta cuenta no tiene una clínica asignada. Ingresá desde odentara.com",
        code: "NO_CLINIC",
      });
    }

    // Renovación deslizante: si el token ya pasó la mitad de su vida y la
    // persona sigue trabajando, se emite uno nuevo y se manda en un header. Así
    // la sesión dura 24 horas en lugar de 7 días —un token robado caduca mucho
    // antes— sin que nadie tenga que volver a iniciar sesión cada mañana.
    // Quien deja de usar la app simplemente deja de renovar y expira solo.
    if (payload.exp && payload.iat) {
      const vidaMs = (payload.exp - payload.iat) * 1000;
      const transcurridoMs = Date.now() - payload.iat * 1000;
      if (transcurridoMs > vidaMs / 2) {
        try {
          const { signToken } = require("../lib/auth");
          const { jti: _viejo, iat: _i, exp: _e, ...datos } = payload;
          res.set("X-Renewed-Token", signToken(datos));
          res.set("Access-Control-Expose-Headers", "X-Renewed-Token");
        } catch (_error) {
          // Si la renovación falla, el token actual sigue siendo válido: no es
          // motivo para cortarle el paso a nadie.
        }
      }
    }

    req.user = user;
    req.rawToken = token;
    req.impersonatedBy = payload.impersonatedBy || null;
    req.permissions = buildPermissionSummary(user);
    // Inyectar el cliente Prisma correcto para la clínica de este usuario
    req.prisma = await getClinicPrisma(user.clinicId);

    // Contexto de auditoría para todo lo que se escriba en esta request.
    // No se audita al Ultra Admin, ni mientras está impersonando una clínica.
    const auditContext = {
      userId: user.id,
      clinicId: user.clinicId || null,
      isPlatformAdmin: !!user.isPlatformAdmin,
      impersonated: !!payload.impersonatedBy,
    };
    return runWithAuditContext(auditContext, () => next());
  } catch (error) {
    return res.status(401).json({ ok: false, error: "Token invalido o vencido." });
  }
}

function requireAnyRole(allowedRoles = []) {
  return (req, res, next) => {
    const userRoles = req.permissions?.roles || [];
    const canAccess = allowedRoles.some((role) => userRoles.includes(role));

    if (!canAccess) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para esta accion." });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireAnyRole,
};
