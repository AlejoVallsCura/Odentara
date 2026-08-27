/**
 * Tokens HMAC de vida corta para URLs que no pueden llevar un header de
 * autorización: imágenes en un <img src>, descargas por navegación del
 * navegador.
 *
 * El `scope` entra en el payload firmado. No es decorativo: sin él, un token
 * emitido para ver una imagen serviría para cualquier otra ruta que use el
 * mismo secreto. Con scope, un token de "serve" es inútil en "export".
 *
 * Estos tokens son bearer: quien tenga la URL puede usarla hasta que venza.
 * Los datos que se firman sirven para saber a quién se le emitió, no para
 * impedir que la use otro. Por eso los TTL son cortos y por eso las descargas
 * masivas usan además un token de un solo uso guardado en base.
 */

const crypto = require("crypto");

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[FATAL] JWT_SECRET no configurado.");
  return secret;
}

function computeSignature(scope, parts, exp) {
  return crypto
    .createHmac("sha256", getSecret())
    .update([scope, ...parts, exp].join(":"))
    .digest("hex")
    .slice(0, 32);
}

/**
 * @param {{ scope: string, parts?: (string|number)[], ttlSeconds: number }} opts
 * @returns {string} token con formato `<exp>.<firma>`
 */
function signToken({ scope, parts = [], ttlSeconds }) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${computeSignature(scope, parts, exp)}`;
}

/**
 * @param {{ scope: string, parts?: (string|number)[], token: unknown }} opts
 * @returns {boolean}
 */
function verifyToken({ scope, parts = [], token }) {
  if (typeof token !== "string" || !token) return false;

  const separator = token.indexOf(".");
  if (separator === -1) return false;

  const exp = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);
  if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return false;

  const expected = computeSignature(scope, parts, exp);

  // timingSafeEqual exige buffers del mismo largo: con una firma de otro tamaño
  // tira excepción en vez de devolver false.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

module.exports = { signToken, verifyToken };
