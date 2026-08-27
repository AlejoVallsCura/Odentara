/**
 * Security logger — registra eventos de seguridad sin loguear datos sensibles.
 * NUNCA incluir: passwords, tokens, passwordHash, datos personales.
 */

const prisma = require("./prisma");
const { sanitizePath } = require("./sanitize-path");

// Anti-repetición para eventos que pueden llegar en ráfaga.
// El rate limiter existe para proteger el servidor; si cada request bloqueado
// escribiera una fila, un ataque haría que la propia defensa genere la carga
// que intenta evitar. Se guarda el primero de cada (tipo + IP) y se ignoran las
// repeticiones durante la ventana: alcanza para saber que esa IP está golpeando.
const BURST_TYPES = new Set(["RATE_LIMIT_EXCEEDED", "AUTH_FAILED"]);
const BURST_WINDOW_MS = 60_000;
const MAX_BURST_ENTRIES = 500;
const _lastPersisted = new Map();

function shouldPersist(type, ip, discriminador) {
  if (!BURST_TYPES.has(type)) return true;

  // El email entra en la clave para AUTH_FAILED: si alguien prueba contra veinte
  // cuentas distintas, cada una deja rastro (que es el dato valioso), y lo que se
  // descarta son los reintentos repetidos contra la misma. El límite de intentos
  // por IP acota cuántas filas puede generar.
  const key = `${type}:${ip}:${discriminador || ""}`;
  const now = Date.now();
  const last = _lastPersisted.get(key);
  if (last && now - last < BURST_WINDOW_MS) return false;

  // Purga simple para que el Map no crezca sin techo con IPs distintas.
  if (_lastPersisted.size >= MAX_BURST_ENTRIES) {
    for (const [k, t] of _lastPersisted) {
      if (now - t > BURST_WINDOW_MS) _lastPersisted.delete(k);
    }
    if (_lastPersisted.size >= MAX_BURST_ENTRIES) _lastPersisted.clear();
  }

  _lastPersisted.set(key, now);
  return true;
}

// En minúscula, porque la comparación de abajo pasa la clave por toLowerCase().
// Estaban escritas "passwordHash" y "creditCard" en camelCase, así que
// "passwordhash" nunca coincidía y esos dos campos —justo los dos peores— se
// escribían enteros en el log de seguridad. Si se agrega una clave nueva, va en
// minúscula o no filtra nada.
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "creditcard",
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
  // Usar req.ip (resuelto por Express con trust proxy) en lugar de leer
  // X-Forwarded-For manualmente — evita IP spoofing en los logs de auditoría.
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const safePath = sanitizePath(req);

  const entry = {
    timestamp: new Date().toISOString(),
    type,
    ip,
    method: req.method,
    path: safePath,
    userAgent: req.headers?.["user-agent"] || "unknown",
    ...sanitize(details),
  };

  console.warn(`[SECURITY] ${JSON.stringify(entry)}`);

  // Además del log, se guarda en la base. Los Runtime Logs del hosting rotan y
  // no tienen alertas, así que sin esto no queda rastro consultable de un
  // acceso sospechoso.
  //
  // Deliberadamente sin await: registrar un evento no debe demorar ni hacer
  // fallar la petición del usuario. Si la escritura falla, queda el console.warn.
  //
  // El console.warn de arriba se emite siempre; lo que se limita es la escritura
  // en base de los eventos que llegan en ráfaga.
  const { email, ...rest } = details || {};
  if (!shouldPersist(type, ip, email)) return;

  prisma.securityEvent
    .create({
      data: {
        type: String(type).slice(0, 40),
        ip: String(ip).slice(0, 45),
        method: req.method ? String(req.method).slice(0, 10) : null,
        path: safePath.slice(0, 255) || null,
        userAgent: req.headers?.["user-agent"] || null,
        email: email ? String(email).slice(0, 255) : null,
        details: Object.keys(rest).length > 0 ? sanitize(rest) : undefined,
      },
    })
    .catch((error) => {
      console.error("[SECURITY] No se pudo persistir el evento:", error.message);
    });
}

module.exports = { logSecurityEvent };
