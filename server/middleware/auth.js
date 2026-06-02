const prisma = require("../lib/prisma");
const { verifyToken, buildPermissionSummary } = require("../lib/auth");
const { getClinicPrisma } = require("../lib/clinic-prisma");
const { isRevoked } = require("../lib/token-revocation");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Token requerido." });
    }

    const payload = verifyToken(token);

    if (isRevoked(payload.jti)) {
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

    req.user = user;
    req.rawToken = token;
    req.permissions = buildPermissionSummary(user);
    // Inyectar el cliente Prisma correcto para la clínica de este usuario
    req.prisma = await getClinicPrisma(user.clinicId);
    next();
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
