const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const { logSecurityEvent } = require("../lib/security-logger");

// En desarrollo (localhost) no aplicar rate limiting para no interferir
const isDev = process.env.NODE_ENV !== "production";

function skipLocalhost(req) {
  if (!isDev) return false;
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

const MINUTOS = 60 * 1000;

/**
 * Fábrica de limitadores.
 *
 * Los cinco limitadores originales eran el mismo bloque de veinte líneas
 * repetido, con dos números y un texto distintos. El riesgo concreto de esa
 * duplicación no era el largo sino la deriva: al agregar el sexto había que
 * acordarse de copiar también el `skip`, el `handler` que audita y los
 * `standardHeaders`, y olvidarse de cualquiera de ellos pasa silenciosamente.
 *
 * @param {object} opts
 * @param {string} opts.nombre Identificador que queda en el evento de auditoría.
 * @param {number} opts.ventanaMinutos
 * @param {number} opts.maximo
 * @param {string} opts.mensaje
 * @param {boolean} [opts.soloFallidos] No contar las respuestas exitosas.
 * @param {(req: object) => string} [opts.claveDe] Agrupar por algo que no sea la IP.
 */
function crearLimitador({ nombre, ventanaMinutos, maximo, mensaje, soloFallidos = false, claveDe }) {
  return rateLimit({
    windowMs: ventanaMinutos * MINUTOS,
    max: maximo,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipLocalhost,
    ...(soloFallidos ? { skipSuccessfulRequests: true } : {}),
    ...(claveDe ? { keyGenerator: claveDe } : {}),
    message: { ok: false, error: mensaje },
    handler(req, res, _next, options) {
      logSecurityEvent("RATE_LIMIT_EXCEEDED", req, { limit: nombre });
      res.status(options.statusCode).json(options.message);
    },
  });
}

// API general (~40 req/min: cubre navegación fluida con llamadas paralelas)
const apiLimiter = crearLimitador({
  nombre: "api-general",
  ventanaMinutos: 15,
  maximo: 600,
  mensaje: "Demasiadas peticiones. Intenta nuevamente en 15 minutos.",
});

const authLimiter = crearLimitador({
  nombre: "auth-login",
  ventanaMinutos: 15,
  maximo: 10,
  soloFallidos: true,
  mensaje: "Demasiados intentos de acceso. Intenta nuevamente en 15 minutos.",
});

const forgotPasswordLimiter = crearLimitador({
  nombre: "forgot-password",
  ventanaMinutos: 60,
  maximo: 5,
  mensaje: "Demasiados intentos. Intentá de nuevo en 1 hora.",
});

// Endpoints de gestión de usuarios/roles
const sensitiveLimiter = crearLimitador({
  nombre: "sensitive",
  ventanaMinutos: 15,
  maximo: 200,
  mensaje: "Demasiadas peticiones a esta función. Intenta nuevamente en 15 minutos.",
});

const contactLimiter = crearLimitador({
  nombre: "contact-form",
  ventanaMinutos: 60,
  maximo: 5,
  mensaje: "Demasiados envios. Intentá de nuevo en 1 hora.",
});

/**
 * Exportación de historias clínicas.
 *
 * Es el endpoint más caro del sistema y, sobre todo, el que más datos entrega
 * de una sola vez: un límite bajo es lo que separa un uso normal de una
 * descarga masiva de la base de pacientes. Se agrupa por usuario y no por IP
 * porque toda la clínica sale por la misma IP del consultorio.
 */
const exportLimiter = crearLimitador({
  nombre: "clinical-export",
  ventanaMinutos: 15,
  maximo: 5,
  mensaje: "Demasiadas descargas seguidas. Esperá unos minutos e intentá de nuevo.",
  // ipKeyGenerator y no req.ip pelado: con IPv6, cada usuario dispone de un
  // rango enorme de direcciones y podría saltarse el límite cambiando de una a
  // otra. El helper agrupa por subred en vez de por dirección.
  claveDe: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip)}`),
});

module.exports = {
  apiLimiter,
  authLimiter,
  sensitiveLimiter,
  forgotPasswordLimiter,
  contactLimiter,
  exportLimiter,
};
