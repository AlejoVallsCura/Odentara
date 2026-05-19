const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const prisma = require("../lib/prisma");
const {
  normalizeEmail,
  signToken,
  serializeUser,
  buildPermissionSummary,
} = require("../lib/auth");
const { requireAuth } = require("../middleware/auth");
const { authLimiter, forgotPasswordLimiter } = require("../middleware/rate-limit");
const { logSecurityEvent } = require("../lib/security-logger");
const { sendPasswordResetEmail } = require("../lib/email");

const router = express.Router();

async function getUserByEmail(email) {
  return prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: {
      roles: { include: { role: true } },
      professionalScopes: true,
      assignedProfessional: true,
    },
  });
}

router.post("/login", authLimiter, async (req, res) => {
  try {
    const rawEmail = req.body?.email || "";
    const password = req.body?.password || "";
    const email = normalizeEmail(rawEmail);

    if (!email || !password) {
      logSecurityEvent("INPUT_REJECTED", req, { reason: "missing-fields", email: email || "(vacío)" });
      return res.status(400).json({
        ok: false,
        error: "Email y contraseña son obligatorios.",
      });
    }

    const user = await getUserByEmail(email);

    if (!user || !user.active || !user.passwordHash) {
      logSecurityEvent("AUTH_FAILED", req, { reason: "user-not-found", email });
      return res.status(401).json({
        ok: false,
        error: "Credenciales invalidas.",
      });
    }

    // Verificar que la clínica esté activa (no aplica a platform admins)
    if (!user.isPlatformAdmin && user.clinicId) {
      const clinic = await prisma.clinic.findUnique({
        where: { id: user.clinicId },
        select: { active: true },
      });
      if (!clinic || !clinic.active) {
        logSecurityEvent("AUTH_FAILED", req, { reason: "clinic-inactive", email });
        return res.status(403).json({
          ok: false,
          error: "Tu clínica está desactivada. Contactá al administrador de la plataforma.",
        });
      }
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      logSecurityEvent("AUTH_FAILED", req, { reason: "wrong-password", email });
      return res.status(401).json({
        ok: false,
        error: "Credenciales invalidas.",
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((entry) => entry.role.code),
    });

    logSecurityEvent("AUTH_SUCCESS", req, { email, userId: user.id });

    return res.json({
      ok: true,
      token,
      user: serializeUser(user),
      permissions: buildPermissionSummary(user),
    });
  } catch (error) {
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

    return res.status(500).json({
      ok: false,
      error: exceededLimit
        ? "La base de datos alcanzó temporalmente el límite de conexiones por hora. Espera unos minutos e intenta nuevamente."
        : databaseUnavailable
          ? "No se pudo conectar con la base de datos en este momento. Intenta nuevamente en unos minutos."
          : "No se pudo iniciar sesión.",
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    user: serializeUser(req.user),
    permissions: req.permissions,
  });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
// Siempre devuelve 200 para no exponer si el email existe o no (anti-enumeración)
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const rawEmail = req.body?.email || "";
    const email = normalizeEmail(rawEmail);

    if (email) {
      const user = await prisma.user.findFirst({
        where: { email, deletedAt: null, active: true, isPlatformAdmin: false },
      });

      if (user) {
        // Invalidar tokens anteriores del usuario
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

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

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    logSecurityEvent("PASSWORD_RESET_SUCCESS", req, { userId: resetToken.userId });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo restablecer la contraseña." });
  }
});

module.exports = router;
