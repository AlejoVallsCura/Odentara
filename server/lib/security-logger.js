/**
 * Security logger — registra eventos de seguridad sin loguear datos sensibles.
 * NUNCA incluir: passwords, tokens, passwordHash, datos personales.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "creditCard",
  "cvv",
]);

function sanitize(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const safe = {};
  for (const [k, v] of Object.entries(obj)) {
    safe[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return safe;
}

/**
 * @param {"AUTH_FAILED"|"RATE_LIMIT_EXCEEDED"|"INPUT_REJECTED"|"AUTH_SUCCESS"} type
 * @param {import("express").Request} req
 * @param {object} [details]
 */
function logSecurityEvent(type, req, details = {}) {
  const ip =
    req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown";

  const entry = {
    timestamp: new Date().toISOString(),
    type,
    ip,
    method: req.method,
    path: req.originalUrl || req.path,
    userAgent: req.headers?.["user-agent"] || "unknown",
    ...sanitize(details),
  };

  console.warn(`[SECURITY] ${JSON.stringify(entry)}`);
}

module.exports = { logSecurityEvent };
