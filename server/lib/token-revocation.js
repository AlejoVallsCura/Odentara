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
const { purgarAutorizacionesVencidas } = require("./single-use-token");

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

/**
 * Borra las autorizaciones de descarga vencidas. Viven cinco minutos: si no se
 * limpian, la tabla crece indefinidamente con filas que ya no sirven para nada.
 */
async function purgeExpiredExportTokens() {
  try {
    const { count } = await prisma.clinicalExportToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) console.log(`[export] ${count} autorizaciones de descarga vencidas eliminadas`);
  } catch (error) {
    console.error("[export] No se pudieron limpiar autorizaciones vencidas:", error.message);
  }
}

// Cada seis horas. No hace falta más seguido: son filas inertes, lo único que
// importa es que la tabla no crezca sin techo.
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Limpieza al arrancar y después cada seis horas.
 *
 * El barrido único al arranque alcanzaba mientras los procesos se reciclaban
 * seguido, pero un worker que queda levantado semanas nunca volvía a limpiar y
 * las dos tablas seguían creciendo. Las autorizaciones de descarga son el caso
 * peor: viven cinco minutos y se emite una por cada exportación.
 */
function startTokenPurgeScheduler() {
  const purgar = () => {
    purgeExpiredRevokedTokens();
    purgeExpiredExportTokens();
    // Las autorizaciones de un solo uso (descarga de backup, canje de sesión)
    // se emiten seguido y viven 2 a 5 minutos: sin barrido, la tabla crece con
    // filas que ya no sirven. Se engancha acá y no en un temporizador propio
    // para no sumar otro reloj al proceso.
    purgarAutorizacionesVencidas().catch((error) => {
      console.error("[single-use-token] No se pudieron purgar las vencidas:", error.message);
    });
  };

  purgar();

  // unref para que este temporizador no le impida al proceso terminar cuando
  // ya no queda nada más que hacer.
  const timer = setInterval(purgar, PURGE_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

module.exports = {
  revokeToken,
  isRevoked,
  purgeExpiredRevokedTokens,
  purgeExpiredExportTokens,
  startTokenPurgeScheduler,
};
