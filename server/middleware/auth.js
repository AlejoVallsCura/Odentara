const prisma = require("../lib/prisma");
const { verifyToken, buildPermissionSummary } = require("../lib/auth");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Token requerido." });
    }

    const payload = verifyToken(token);

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
      if (clinicSlug && clinic.slug !== clinicSlug) {
        return res.status(403).json({
          ok: false,
          error: "Token no válido para esta clínica.",
          code: "CLINIC_MISMATCH",
        });
      }
    }

    req.user = user;
    req.permissions = buildPermissionSummary(user);
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
