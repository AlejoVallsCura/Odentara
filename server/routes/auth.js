const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const prisma = require("../lib/prisma");
const {
  normalizeEmail,
  signToken,
  serializeUser,
  buildPermissionSummary,
  signExchangeToken,
  verifyExchangeToken,
  signClinicSelectionToken,
  verifyClinicSelectionToken,
} = require("../lib/auth");
const { requireAuth } = require("../middleware/auth");
const { authLimiter, forgotPasswordLimiter } = require("../middleware/rate-limit");
const { revokeToken } = require("../lib/token-revocation");
const { logSecurityEvent } = require("../lib/security-logger");
const { sendPasswordResetEmail } = require("../lib/email");

const router = express.Router();

/**
 * Verifica el token de Cloudflare Turnstile.
 * Si TURNSTILE_SECRET_KEY no está configurada, se omite la verificación
 * (útil en desarrollo local sin las keys).
 */
async function verifyTurnstile(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // sin key = omitir en local

  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token, remoteip });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    return data.success === true;
  } catch (_) {
    return false;
  }
}

const USER_INCLUDE = {
  roles: { include: { role: true } },
  professionalScopes: true,
  assignedProfessional: true,
};

async function getUsersByEmail(email) {
  return prisma.user.findMany({
    where: { email, deletedAt: null, active: true },
    include: USER_INCLUDE,
    orderBy: { id: "asc" },
  });
}

async function getUserById(id) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null, active: true },
    include: USER_INCLUDE,
  });
}

function buildLoginError(error) {
  const rawMessage = [
    error?.message,
    error?.cause?.message,
    error?.cause?.originalMessage,
    error?.meta?.driverAdapterError?.cause?.message,
    error?.meta?.driverAdapterError?.cause?.originalMessage,
  ]
    .filter(Boolean)
    .join(" | ");

  const exceededLimit =
    /max_connections_per_hour/i.test(rawMessage) ||
    /ER_USER_LIMIT_REACHED/i.test(rawMessage);

  const databaseUnavailable =
    exceededLimit ||
    /pool timeout/i.test(rawMessage) ||
    /can't reach database/i.test(rawMessage) ||
    /access denied/i.test(rawMessage) ||
    /timeout/i.test(rawMessage);

  return exceededLimit
    ? "La base de datos alcanzó temporalmente el límite de conexiones por hora. Espera unos minutos e intenta nuevamente."
    : databaseUnavailable
      ? "No se pudo conectar con la base de datos en este momento. Intenta nuevamente en unos minutos."
      : "No se pudo iniciar sesión.";
}

async function issueTokenForUser(user) {
  const token = signToken({
    userId: user.id,
    email: user.email,
    roles: user.roles.map((entry) => entry.role.code),
  });
  let clinicSlug = null;
  if (!user.isPlatformAdmin && user.clinicId) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: user.clinicId },
      select: { slug: true },
    });
    clinicSlug = clinic?.slug || null;
  }
  return { token, clinicSlug };
}

router.post("/login", authLimiter, async (req, res) => {
  try {
    const rawEmail = req.body?.email || "";
    const password = req.body?.password || "";
    const email = normalizeEmail(rawEmail);
    const turnstileToken = req.body?.["cf-turnstile-response"] || "";

    if (!email || !password) {
      logSecurityEvent("INPUT_REJECTED", req, { reason: "missing-fields", email: email || "(vacío)" });
      return res.status(400).json({ ok: false, error: "Email y contraseña son obligatorios." });
    }

    const remoteip = req.headers["cf-connecting-ip"] || req.ip;
    const turnstileOk = await verifyTurnstile(turnstileToken, remoteip);
    if (!turnstileOk) {
      logSecurityEvent("INPUT_REJECTED", req, { reason: "turnstile-failed", email });
      return res.status(400).json({
        ok: false,
        error: "Verificación de seguridad fallida. Recargá la página e intentá de nuevo.",
      });
    }

    const users = await getUsersByEmail(email);

    if (users.length === 0) {
      logSecurityEvent("AUTH_FAILED", req, { reason: "user-not-found", email });
      return res.status(401).json({ ok: false, error: "Credenciales invalidas." });
    }

    // Verificar password contra el primero que tenga hash (contraseña compartida entre clínicas)
    const reference = users.find((u) => u.passwordHash);
    if (!reference) {
      logSecurityEvent("AUTH_FAILED", req, { reason: "no-password-hash", email });
      return res.status(401).json({ ok: false, error: "Credenciales invalidas." });
    }

    const passwordOk = await bcrypt.compare(password, reference.passwordHash);
    if (!passwordOk) {
      logSecurityEvent("AUTH_FAILED", req, { reason: "wrong-password", email });
      return res.status(401).json({ ok: false, error: "Credenciales invalidas." });
    }

    // Filtrar clínicas activas
    const clinicIds = [...new Set(users.map((u) => u.clinicId).filter(Boolean))];
    let activeClinics = new Set();
    if (clinicIds.length > 0) {
      const clinics = await prisma.clinic.findMany({
        where: { id: { in: clinicIds }, active: true },
        select: { id: true, name: true, slug: true },
      });
      activeClinics = new Map(clinics.map((c) => [c.id, c]));
    }

    // Platform admin: siempre pasa directamente
    const platformAdminUser = users.find((u) => u.isPlatformAdmin);
    if (platformAdminUser) {
      const { token, clinicSlug } = await issueTokenForUser(platformAdminUser);
      logSecurityEvent("AUTH_SUCCESS", req, { email, userId: platformAdminUser.id });
      return res.json({ ok: true, token, user: serializeUser(platformAdminUser), permissions: buildPermissionSummary(platformAdminUser), clinicSlug });
    }

    // Usuarios de clínicas activas
    const eligibleUsers = users.filter((u) => u.clinicId && activeClinics.has(u.clinicId));

    if (eligibleUsers.length === 0) {
      logSecurityEvent("AUTH_FAILED", req, { reason: "clinic-inactive", email });
      return res.status(403).json({
        ok: false,
        error: "Tu clínica está desactivada. Contactá al administrador de la plataforma.",
        code: "CLINIC_INACTIVE",
      });
    }

    // Una sola clínica → login directo
    if (eligibleUsers.length === 1) {
      const user = eligibleUsers[0];
      const { token, clinicSlug } = await issueTokenForUser(user);
      logSecurityEvent("AUTH_SUCCESS", req, { email, userId: user.id });
      return res.json({ ok: true, token, user: serializeUser(user), permissions: buildPermissionSummary(user), clinicSlug });
    }

    // Múltiples clínicas → devolver selector
    const sessionToken = signClinicSelectionToken(eligibleUsers.map((u) => u.id));
    const clinicOptions = eligibleUsers.map((u) => ({
      userId: u.id,
      clinicId: u.clinicId,
      clinicName: activeClinics.get(u.clinicId)?.name || "Clínica",
      clinicSlug: activeClinics.get(u.clinicId)?.slug || null,
      roles: u.roles.map((r) => r.role.code),
      fullName: u.fullName,
    }));

    logSecurityEvent("AUTH_CLINIC_SELECTION", req, { email, clinicCount: eligibleUsers.length });
    return res.json({ ok: true, requiresClinicSelection: true, sessionToken, clinics: clinicOptions });
  } catch (error) {
    return res.status(500).json({ ok: false, error: buildLoginError(error) });
  }
});

// ── POST /api/auth/select-clinic ──────────────────────────────────────────────
// Recibe el sessionToken + el userId elegido → emite JWT completo para esa clínica.
router.post("/select-clinic", authLimiter, async (req, res) => {
  try {
    const { sessionToken, userId } = req.body;
    if (!sessionToken || !userId) {
      return res.status(400).json({ ok: false, error: "Datos incompletos." });
    }

    let payload;
    try {
      payload = verifyClinicSelectionToken(sessionToken);
    } catch (_) {
      return res.status(401).json({ ok: false, error: "Sesión de selección inválida o expirada. Iniciá sesión de nuevo." });
    }

    const numericUserId = Number(userId);
    if (!payload.userIds.includes(numericUserId)) {
      return res.status(403).json({ ok: false, error: "Clínica no autorizada." });
    }

    const user = await getUserById(numericUserId);
    if (!user) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado." });
    }

    if (user.clinicId) {
      const clinic = await prisma.clinic.findUnique({ where: { id: user.clinicId }, select: { active: true } });
      if (!clinic?.active) {
        return res.status(403).json({ ok: false, error: "La clínica seleccionada está desactivada.", code: "CLINIC_INACTIVE" });
      }
    }

    const { token, clinicSlug } = await issueTokenForUser(user);
    logSecurityEvent("AUTH_SUCCESS", req, { userId: user.id, email: user.email, via: "clinic-selection" });

    return res.json({ ok: true, token, user: serializeUser(user), permissions: buildPermissionSummary(user), clinicSlug });
  } catch (error) {
    return res.status(500).json({ ok: false, error: buildLoginError(error) });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    user: serializeUser(req.user),
    permissions: req.permissions,
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Invalida el token actual server-side para que no pueda reutilizarse.
router.post("/logout", requireAuth, (req, res) => {
  try {
    const payload = require("../lib/auth").verifyToken(req.rawToken);
    if (payload?.jti && payload?.exp) {
      revokeToken(payload.jti, payload.exp * 1000);
    }
  } catch (_) { /* token ya inválido, no pasa nada */ }
  return res.json({ ok: true });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
// Siempre devuelve 200 para no exponer si el email existe o no (anti-enumeración)
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const rawEmail = req.body?.email || "";
    const email = normalizeEmail(rawEmail);

    if (email) {
      // Buscar cualquier usuario activo con ese email (puede estar en varias clínicas)
      const user = await prisma.user.findFirst({
        where: { email, deletedAt: null, active: true, isPlatformAdmin: false },
        orderBy: { id: "asc" },
      });

      if (user) {
        // Invalidar tokens anteriores de todos los usuarios con ese email
        const allUserIds = await prisma.user
          .findMany({ where: { email, deletedAt: null }, select: { id: true } })
          .then((rows) => rows.map((r) => r.id));
        await prisma.passwordResetToken.deleteMany({ where: { userId: { in: allUserIds } } });

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await prisma.passwordResetToken.create({
          data: { userId: user.id, token, expiresAt },
        });

        const appUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, "");
        const resetUrl = `${appUrl}?resetToken=${token}`;

        try {
          await sendPasswordResetEmail({ to: user.email, resetUrl, userName: user.fullName });
        } catch (emailErr) {
          console.error("[forgot-password] Error enviando email:", emailErr.message);
        }

        logSecurityEvent("PASSWORD_RESET_REQUESTED", req, { email });
      }
    }

    // Siempre 200 aunque no exista el email
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Error al procesar la solicitud." });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ ok: false, error: "Datos incompletos." });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres." });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true, active: true, deletedAt: true } } },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ ok: false, error: "El enlace es inválido o ya expiró. Solicitá uno nuevo." });
    }

    if (!resetToken.user?.active || resetToken.user?.deletedAt) {
      return res.status(400).json({ ok: false, error: "El usuario no está disponible." });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    // Actualizar contraseña en TODAS las instancias del email (contraseña compartida entre clínicas)
    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { email: resetToken.user.email, deletedAt: null },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });
    });

    logSecurityEvent("PASSWORD_RESET_SUCCESS", req, { userId: resetToken.userId });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo restablecer la contraseña." });
  }
});

// ── Token exchange (evita pasar el JWT completo en la URL al redirigir entre subdominios) ──
// Genera un JWT de corta vida (2 min) que encapsula el token real — sin estado en servidor.
// Funciona con reinicios de proceso y múltiples instancias (auto-validante por firma).

// POST /api/auth/exchange  — el cliente autentica y recibe un exchange token firmado
router.post("/exchange", requireAuth, (req, res) => {
  const code = signExchangeToken(req.rawToken);
  return res.json({ ok: true, code });
});

// GET /api/auth/exchange?code=<exchange_token>  — verifica el token y devuelve el JWT original
router.get("/exchange", (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ ok: false, error: "Falta el código de intercambio." });
  }
  try {
    const token = verifyExchangeToken(code);
    return res.json({ ok: true, token });
  } catch (_err) {
    return res.status(404).json({ ok: false, error: "Código inválido o expirado." });
  }
});

module.exports = router;
