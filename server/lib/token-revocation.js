/**
 * Revocación de tokens (logout) persistida en la base.
 *
 * Antes era un Map en memoria, bajo el supuesto de que había una sola instancia
 * de la app. Ese supuesto es falso: la plataforma levanta varios procesos worker
 * para el mismo dominio (verificado en producción — tres PIDs distintos
 * respondiendo el mismo build). Con estado en memoria, el logout solo valía en
 * el worker que lo atendía y el token seguía siendo aceptado por los demás
 * durante los 7 días de vida del JWT.
 *
 * La contrapartida es una consulta por request autenticado: un SELECT por clave
 * primaria sobre una tabla chica. El costo es despreciable frente a tener
 * sesiones que no se pueden cerrar.
 */

const prisma = require("./prisma");

async function revokeToken(jti, expMs) {
  if (!jti) return;
  const expiresAt = new Date(expMs);
  // upsert y no create: reintentar el logout con el mismo token no debe romper.
  await prisma.revokedToken.upsert({
    where: { jti },
    create: { jti, expiresAt },
    update: { expiresAt },
  });
}

async function isRevoked(jti) {
  if (!jti) return false;
  const row = await prisma.revokedToken.findUnique({ where: { jti } });
  if (!row) return false;
  // Si ya venció por su cuenta, jwt.verify lo habría rechazado antes; no hace
  // falta seguir tratándolo como revocado.
  return row.expiresAt.getTime() > Date.now();
}

/**
 * Borra las revocaciones vencidas. Se llama al arrancar: una vez que el token
 * expiró solo, la fila no aporta nada y hace crecer la tabla sin sentido.
 */
async function purgeExpiredRevokedTokens() {
  try {
    const { count } = await prisma.revokedToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) console.log(`[auth] ${count} revocaciones vencidas eliminadas`);
  } catch (error) {
    // No es crítico: si falla, las filas viejas quedan para la próxima vuelta.
    console.error("[auth] No se pudieron limpiar revocaciones vencidas:", error.message);
  }
}

module.exports = { revokeToken, isRevoked, purgeExpiredRevokedTokens };
