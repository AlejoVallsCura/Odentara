/**
 * Autorizaciones de un solo uso para URLs que no pueden llevar header.
 *
 * Generaliza lo que ya hacía bien la exportación de archivos clínicos, y
 * reemplaza las firmas SIN ESTADO que usaban la descarga del backup completo y
 * el canje de sesión entre subdominios. Aquellas eran reutilizables dentro de
 * su ventana: quien leyera la URL en los logs del reverse proxy la podía volver
 * a usar hasta que venciera.
 *
 * Estaban calibradas al revés de lo que protegían: los archivos de UN paciente
 * tenían token en base con tope de usos, mientras que la base entera y una
 * sesión completa de 24 horas iban con una firma replicable.
 *
 * El token es opaco. Lo que hace falta para completar la acción vive en la
 * base, así que en la URL no queda nada manipulable ni nada sensible.
 */

"use strict";

const crypto = require("crypto");
const prisma = require("./prisma");

/** 32 bytes de aleatoriedad → 64 caracteres hex, el ancho de la columna. */
function generarToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Emite una autorización.
 *
 * @param {object} opts
 * @param {string} opts.scope       "backup-download" | "auth-exchange"
 * @param {object} opts.payload     lo mínimo para completar la acción
 * @param {number} opts.ttlSegundos
 * @returns {Promise<string>} el token opaco
 */
async function emitirAutorizacion({ scope, payload, ttlSegundos }) {
  const token = generarToken();
  await prisma.singleUseToken.create({
    data: {
      token,
      scope,
      payload,
      expiresAt: new Date(Date.now() + ttlSegundos * 1000),
    },
  });
  return token;
}

/**
 * Reclama una autorización. Devuelve el payload, o null si no sirve.
 *
 * El reclamo es un UPDATE condicional y se decide por el resultado, en vez de
 * leer la fila y después marcarla. Con esos dos pasos separados, dos pedidos
 * simultáneos leen el mismo estado y pasan los dos: el "un solo uso" no se
 * cumple. Es el mismo razonamiento que ya está comentado en la exportación
 * clínica, y el mismo que faltaba en la cuota de IA.
 *
 * @returns {Promise<object|null>}
 */
async function reclamarAutorizacion({ scope, token }) {
  const codigo = String(token || "");
  if (!codigo) return null;

  const ahora = new Date();
  const reclamo = await prisma.singleUseToken.updateMany({
    where: {
      token: codigo,
      scope,               // un token de un scope no vale en otro
      usedAt: null,        // todavía sin usar
      expiresAt: { gt: ahora },
    },
    data: { usedAt: ahora },
  });

  // count === 0 cubre los cuatro casos de una: no existe, ya se usó, venció, o
  // es de otro scope. Al que pide no se le distingue cuál: no hace falta que lo
  // sepa y decirlo solo ayudaría a sondear.
  if (reclamo.count === 0) return null;

  const fila = await prisma.singleUseToken.findUnique({ where: { token: codigo } });
  return fila ? fila.payload : null;
}

/**
 * Borra las autorizaciones vencidas. Se engancha al purgador que ya corre cada
 * seis horas para los tokens revocados: sin esto, la tabla crece para siempre
 * con filas que ya no sirven.
 */
async function purgarAutorizacionesVencidas() {
  const { count } = await prisma.singleUseToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

module.exports = {
  emitirAutorizacion,
  reclamarAutorizacion,
  purgarAutorizacionesVencidas,
};
