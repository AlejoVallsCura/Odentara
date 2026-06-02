/**
 * Store en memoria de JTIs revocados.
 * Almacena { jti → expiresAt } y limpia entradas vencidas automáticamente.
 * Apropiado para deployments de una sola instancia (Hostinger).
 */

const _revoked = new Map(); // jti → expiresAtMs

function revokeToken(jti, expMs) {
  if (!jti) return;
  _revoked.set(jti, expMs);
  _cleanup();
}

function isRevoked(jti) {
  if (!jti) return false;
  const exp = _revoked.get(jti);
  if (exp === undefined) return false;
  if (Date.now() > exp) {
    _revoked.delete(jti);
    return false; // ya expiró naturalmente; no es revocación activa
  }
  return true;
}

function _cleanup() {
  const now = Date.now();
  for (const [jti, exp] of _revoked) {
    if (now > exp) _revoked.delete(jti);
  }
}

module.exports = { revokeToken, isRevoked };
