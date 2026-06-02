const rateLimit = require("express-rate-limit");
const { logSecurityEvent } = require("../lib/security-logger");

// En desarrollo (localhost) no aplicar rate limiting para no interferir
const isDev = process.env.NODE_ENV !== "production";

function skipLocalhost(req) {
  if (!isDev) return false;
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

// API general: 600 req / 15 min por IP
// (~40 req/min: cubre navegación fluida con múltiples llamadas paralelas)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalhost,
  message: {
    ok: false,
    error: "Demasiadas peticiones. Intenta nuevamente en 15 minutos.",
  },
  handler(req, res, _next, options) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", req, { limit: "api-general" });
    res.status(options.statusCode).json(options.message);
  },
});

// Auth: 10 intentos fallidos / 15 min por IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // solo cuenta intentos fallidos
  skip: skipLocalhost,
  message: {
    ok: false,
    error: "Demasiados intentos de acceso. Intenta nuevamente en 15 minutos.",
  },
  handler(req, res, _next, options) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", req, { limit: "auth-login" });
    res.status(options.statusCode).json(options.message);
  },
});

// Forgot password: 5 requests / hora por IP (anti-abuso)
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalhost,
  message: {
    ok: false,
    error: "Demasiados intentos. Intentá de nuevo en 1 hora.",
  },
  handler(req, res, _next, options) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", req, { limit: "forgot-password" });
    res.status(options.statusCode).json(options.message);
  },
});

// Endpoints de gestión de usuarios/roles: 200 req / 15 min por IP
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalhost,
  message: {
    ok: false,
    error: "Demasiadas peticiones a esta función. Intenta nuevamente en 15 minutos.",
  },
  handler(req, res, _next, options) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", req, { limit: "sensitive" });
    res.status(options.statusCode).json(options.message);
  },
});

// Formulario de contacto landing: 5 envíos / hora por IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalhost,
  message: {
    ok: false,
    error: "Demasiados envios. Intentá de nuevo en 1 hora.",
  },
  handler(req, res, _next, options) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", req, { limit: "contact-form" });
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = { apiLimiter, authLimiter, sensitiveLimiter, forgotPasswordLimiter, contactLimiter };
