const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const prisma = require("../lib/prisma");
const {
  normalizeEmail,
  signToken,
  serializeUser,
  buildPermissionSummary,
  signClinicSelectionToken,
  verifyClinicSelectionToken,
} = require("../lib/auth");
const { requireAuth } = require("../middleware/auth");
const { authLimiter, forgotPasswordLimiter } = require("../middleware/rate-limit");
const { revokeToken } = require("../lib/token-revocation");
const { logSecurityEvent } = require("../lib/security-logger");
const { sendPasswordResetEmail } = require("../lib/email");
const { emitirAutorizacion, reclamarAutorizacion } = require("../lib/single-use-token");

const router = express.Router();

/**
 * Hash del token de reseteo tal como se guarda en la base.
 * SHA-256 sin salt a propósito: el token ya son 32 bytes aleatorios, así que no
 * hay nada que adivinar por fuerza bruta ni diccionario que aplique, y hace
 * falta que el hash sea determinístico para poder buscar la fila por él.
 * Devuelve 64 caracteres hex, que es justo el ancho de la columna.
 */
function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken)).digest("hex");
}

// Acá vivía el bloqueo de cuenta por intentos fallidos. Se eliminó por completo:
// lo disparaban peticiones NO autenticadas y escribía `lockedUntil` en la base,
// de modo que cualquiera que supiera un email podía dejar a esa persona fuera
// del sistema —en todas sus clínicas— con ocho intentos. Una defensa que un
// atacante puede accionar contra la víctima es un ataque, no una defensa.
//
// La protección contra fuerza bruta queda en `authLimiter` (por IP) y Turnstile.
// Un límite por cuenta solo puede volver si no lo puede provocar un tercero:
// desafío creciente en vez de bloqueo, y contadores que no vivan en `User`.
// Las columnas `failedLoginAttempts` y `lockedUntil` quedan en el esquema sin
// uso; limpiarlas o quitarlas es una migración aparte.

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

    // Nota histórica: acá había un bloqueo de cuenta por intentos fallidos. Se
    // quitó porque se activaba con peticiones NO autenticadas y escribía
    // lockedUntil en la base: cualquiera que supiera el mail de un odontólogo
    // podía dejarlo afuera quince minutos, y en todas sus clínicas a la vez.
    // La protección contra fuerza bruta queda en manos del rate limit por IP
    // (authLimiter) y de Turnstile, que no se pueden dirigir contra una persona.
    // ── Verificación de contraseña, una por cuenta ───────────────────────────
    //
    // Antes se comparaba contra el hash del PRIMER usuario que tuviera uno, y
    // después el selector de clínica ofrecía todas las cuentas del email. Como
    // /select-clinic emite la sesión sin volver a pedir la contraseña, alcanzaba
    // con saber la clave de una cuenta para entrar a cualquier otra que
    // compartiera el email — incluida una de plataforma.
    //
    // Ahora cada cuenta se valida contra su propio hash y solo las que coinciden
    // llegan al selector. El costo es un bcrypt.compare por cuenta, y son una o
    // dos en la práctica.
    const conHash = users.filter((u) => u.passwordHash);
    if (conHash.length === 0) {
      logSecurityEvent("AUTH_FAILED", req, { reason: "no-password-hash", email });
      return res.status(401).json({ ok: false, error: "Credenciales invalidas." });
    }

    const autenticados = [];
    for (const candidato of conHash) {
      // Secuencial y no en paralelo: bcrypt es deliberadamente costoso en CPU y
      // lanzar N comparaciones a la vez bloquea el event loop del worker.
      if (await bcrypt.compare(password, candidato.passwordHash)) {
        autenticados.push(candidato);
      }
    }

    if (autenticados.length === 0) {
      logSecurityEvent("AUTH_FAILED", req, { reason: "wrong-password", email });
      return res.status(401).json({ ok: false, error: "Credenciales invalidas." });
    }

    // Filtrar clínicas activas
    const clinicIds = [...new Set(autenticados.map((u) => u.clinicId).filter(Boolean))];
    let activeClinics = new Set();
    if (clinicIds.length > 0) {
      const clinics = await prisma.clinic.findMany({
        where: { id: { in: clinicIds }, active: true },
        select: { id: true, name: true, slug: true },
      });
      activeClinics = new Map(clinics.map((c) => [c.id, c]));
    }

    // Platform admin: pasa directamente, pero solo si su PROPIO hash coincidió.
    // Antes bastaba con que compartiera el email con una cuenta de clínica cuya
    // contraseña se conociera: eso convertía el bypass en acceso de plataforma.
    const platformAdminUser = autenticados.find((u) => u.isPlatformAdmin);
    if (platformAdminUser) {
      const { token, clinicSlug } = await issueTokenForUser(platformAdminUser);
      logSecurityEvent("AUTH_SUCCESS", req, { email, userId: platformAdminUser.id });
      return res.json({ ok: true, token, user: serializeUser(platformAdminUser), permissions: buildPermissionSummary(platformAdminUser), clinicSlug });
    }

    // Usuarios de clínicas activas, entre los que se autenticaron
    const eligibleUsers = autenticados.filter((u) => u.clinicId && activeClinics.has(u.clinicId));

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
router.post("/logout", requireAuth, async (req, res) => {
  try {
    const payload = require("../lib/auth").verifyToken(req.rawToken);
    if (payload?.jti && payload?.exp) {
      // Se espera la escritura: si falla, el token seguiría siendo válido y el
      // usuario tiene que saber que la sesión no se cerró.
      await revokeToken(payload.jti, payload.exp * 1000);
    }
  } catch (error) {
    logSecurityEvent("LOGOUT_REVOKE_FAILED", req, { reason: error.message });
    return res.status(500).json({
      ok: false,
      error: "No se pudo cerrar la sesión. Intentá de nuevo.",
    });
  }
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
        // Se invalidan solo los tokens de ESTA cuenta, no los de todas las que
        // comparten el email. Borrar los ajenos permitía que un tercero pidiera
        // recuperación en loop e inutilizara enlaces recién enviados a personas
        // de otras clínicas: no da acceso, pero impide recuperar la cuenta.
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

        // El token viaja al usuario por mail; en la base solo queda su hash.
        // Así, si la base se filtra, los tokens vigentes no alcanzan para tomar
        // ninguna cuenta — el valor original no se puede reconstruir.
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt },
        });

        // RESET_PASSWORD_URL permite apuntar al subdominio de la app (app.odentara.com)
        // independientemente de APP_URL (que puede apuntar a la landing odentara.com).
        const appUrl = (
          process.env.RESET_PASSWORD_URL ||
          process.env.APP_URL ||
          `http://localhost:${process.env.PORT || 3001}`
        ).replace(/\/$/, "");
        const resetUrl = `${appUrl}?resetToken=${token}`;

        try {
          await sendPasswordResetEmail({ to: user.email, resetUrl, userName: user.fullName });
          console.log(`[forgot-password] Mail de recuperación enviado a userId=${user.id}`);
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
router.post("/reset-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ ok: false, error: "Datos incompletos." });
    }
    // Normalizar ANTES de medir. Con `password.length` sobre un número,
    // `.length` es undefined y `undefined < 8` da false: una contraseña como
    // `1234` enviada como número pasaba el control y después se guardaba con
    // String(password).
    const passwordPlano = String(password);
    if (typeof password !== "string" || passwordPlano.length < 8) {
      return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres." });
    }
    // bcrypt trunca en 72 bytes: aceptar más es prometer una seguridad que no se
    // cumple, y hace que dos contraseñas distintas puedan abrir la misma cuenta.
    if (Buffer.byteLength(passwordPlano, "utf8") > 72) {
      return res.status(400).json({ ok: false, error: "La contraseña es demasiado larga (máximo 72 bytes)." });
    }

    const tokenHash = hashResetToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, active: true, deletedAt: true } } },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ ok: false, error: "El enlace es inválido o ya expiró. Solicitá uno nuevo." });
    }

    if (!resetToken.user?.active || resetToken.user?.deletedAt) {
      return res.status(400).json({ ok: false, error: "El usuario no está disponible." });
    }

    const passwordHash = await bcrypt.hash(passwordPlano, 10);

    const consumido = await prisma.$transaction(async (tx) => {
      // El token se reclama con un UPDATE condicional y se decide por el
      // resultado. Antes se leía `usedAt` y se actualizaba después: dos
      // peticiones simultáneas con el mismo enlace pasaban las dos la lectura.
      const reclamo = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (reclamo.count === 0) return false;

      // Solo la cuenta a la que se emitió el enlace. Antes se pisaba la
      // contraseña de todas las cuentas con ese email, incluidas las de otras
      // clínicas que nunca pidieron nada — administrativamente independientes y
      // sin forma de enterarse.
      await tx.user.update({
        where: { id: resetToken.userId },
        // sessionsValidFrom invalida todos los tokens emitidos hasta ahora: si
        // alguien había entrado con la contraseña vieja, cambiarla lo saca.
        data: { passwordHash, sessionsValidFrom: new Date() },
      });
      return true;
    });

    if (!consumido) {
      return res.status(400).json({ ok: false, error: "El enlace es inválido o ya expiró. Solicitá uno nuevo." });
    }

    logSecurityEvent("PASSWORD_RESET_SUCCESS", req, { userId: resetToken.userId });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo restablecer la contraseña." });
  }
});

// ── Canje de sesión al saltar de subdominio ──────────────────────────────────
//
// El navegador no puede llevar el header Authorization en una navegación, así
// que al pasar de app.odentara.com al subdominio de la clínica hay que mover la
// sesión por la URL. Antes eso era un JWT de 2 minutos que ENCAPSULABA el token
// real, y traía dos problemas:
//
//   1. Era reutilizable dentro de la ventana. La URL con el código queda en los
//      logs del reverse proxy, así que cualquiera que la leyera ahí se quedaba
//      con una sesión de 24 horas.
//   2. Guardaba el JWT real adentro de otro JWT, o sea que el secreto viajaba
//      igual, solo que envuelto.
//
// Ahora es un token opaco de UN SOLO USO. Y no guarda ninguna credencial: en la
// base queda el id del usuario, y la sesión se firma FRESCA al canjear.

// POST /api/auth/exchange — autenticado: emite el código
router.post("/exchange", requireAuth, async (req, res) => {
  const code = await emitirAutorizacion({
    scope: "auth-exchange",
    payload: { userId: req.user.id, impersonatedBy: req.impersonatedBy || null },
    ttlSegundos: 120,
  });
  return res.json({ ok: true, code });
});

// GET /api/auth/exchange?code=<codigo> — sin header: canjea el código por la sesión
router.get("/exchange", async (req, res) => {
  const payload = await reclamarAutorizacion({
    scope: "auth-exchange",
    token: String(req.query.code || ""),
  });

  if (!payload) {
    return res.status(404).json({ ok: false, error: "Código inválido, ya usado o expirado." });
  }

  // La sesión se firma acá y no se recupera de ningún lado: eso evita tener un
  // JWT guardado en base, y de paso vuelve a comprobar que el usuario siga
  // activo y no borrado en el momento del canje, no en el de la emisión.
  const user = await getUserById(payload.userId);
  if (!user) {
    return res.status(404).json({ ok: false, error: "Código inválido, ya usado o expirado." });
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    roles: user.roles.map((entry) => entry.role.code),
    ...(payload.impersonatedBy ? { impersonatedBy: payload.impersonatedBy } : {}),
  });

  return res.json({ ok: true, token });
});

module.exports = router;
