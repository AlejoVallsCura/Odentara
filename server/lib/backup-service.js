// Ejecución de backups con registro en la base y reserva de turno.
//
// Envuelve a backup-runner (que solo sabe hacer el dump) con lo que hace falta
// para dispararlo desde la app: dejar constancia de qué pasó, evitar que dos
// procesos corran el mismo backup, y limpiar los viejos.

"use strict";

const prisma = require("./prisma");
const { runDatabaseBackup, listDatabaseBackups, pruneDatabaseBackups } = require("./backup-runner");
const {
  partesLocales,
  correspondeAhora,
  intentoQueCorresponde,
  slotDeIntento,
  slotsDelTurno,
  normalizarSchedule,
  FRECUENCIAS,
} = require("./backup-schedule-rules");

async function getSchedule() {
  const fila = await prisma.backupSchedule.findUnique({ where: { id: 1 } });
  if (fila) return fila;

  // La migración inserta la fila, pero si alguien la borró el scheduler no debe
  // caerse: se recrea desactivada.
  return prisma.backupSchedule.create({
    data: { id: 1, enabled: false, updatedAt: new Date() },
  });
}

async function saveSchedule(cambios = {}) {
  const datos = { ...normalizarSchedule(cambios), updatedAt: new Date() };

  return prisma.backupSchedule.upsert({
    where: { id: 1 },
    create: { id: 1, ...datos },
    update: datos,
  });
}

/**
 * Dado el turno base, devuelve el slot del intento que corresponde ejecutar, o
 * null si no hay nada que hacer (ya salió bien, otro lo está corriendo, o se
 * agotaron los intentos).
 *
 * La decisión vive en backup-schedule-rules; acá solo se buscan las corridas.
 */
async function slotAIntentar(base) {
  const corridas = await prisma.backupRun.findMany({
    where: { slot: { in: slotsDelTurno(base) } },
    select: { status: true, startedAt: true },
  });

  const intento = intentoQueCorresponde(corridas, new Date());
  return intento ? slotDeIntento(base, intento) : null;
}

/**
 * Corre un backup dejando registro. Devuelve la fila de BackupRun.
 *
 * `slot` tiene que ser único. Si otro proceso ya lo reservó, esta llamada
 * devuelve null sin hacer nada — no es un error, es el resultado esperado
 * cuando hay varios workers.
 */
async function ejecutarBackup({ slot, trigger, userId = null, keepLast = null }) {
  // createMany con skipDuplicates y no create: los dos reservan el turno de
  // forma atómica, pero create LANZA al chocar y Prisma lo registra como error
  // en el log del proceso. Perder la carrera es el resultado normal cuando hay
  // varios workers, no una falla: con create, cada backup programado dejaría
  // tantos "Unique constraint failed" como workers haya, y quien lea los logs
  // creería que algo se rompió. skipDuplicates devuelve count 0 en silencio.
  const reserva = await prisma.backupRun.createMany({
    data: [{ slot, trigger, status: "running", userId }],
    skipDuplicates: true,
  });

  if (reserva.count === 0) return null; // otro worker se quedó con este turno

  const run = await prisma.backupRun.findUnique({ where: { slot } });
  if (!run) return null;

  try {
    const resultado = await runDatabaseBackup({});

    let borrados = [];
    if (keepLast) borrados = pruneDatabaseBackups(keepLast);

    return await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status: "ok",
        finishedAt: new Date(),
        fileName: resultado.archivo,
        bytes: resultado.bytes,
        totalRows: resultado.totalFilas,
        totalTables: Object.keys(resultado.tablas || {}).length,
        error: borrados.length ? `Retención: se borraron ${borrados.length} backup(s) viejo(s).` : null,
      },
    });
  } catch (error) {
    // El fallo se guarda en la misma fila. Un backup que falló y no deja rastro
    // es indistinguible de uno que nunca se intentó, y eso es justo lo que no
    // se quiere descubrir el día que hace falta restaurar.
    await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        error: String(error.message || error).slice(0, 2000),
      },
    });
    throw error;
  }
}

/**
 * Historial cruzado con lo que hay en disco.
 *
 * Un registro "ok" cuyo archivo ya no está (borrado por retención o a mano) se
 * marca como no descargable. La tabla dice qué pasó; el disco dice qué se puede
 * usar, y son dos preguntas distintas.
 */
async function listarBackups(limite = 30) {
  const [corridas, archivos] = await Promise.all([
    prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: limite }),
    Promise.resolve(listDatabaseBackups()),
  ]);

  const porNombre = new Map(archivos.map((a) => [a.archivo, a]));

  return corridas.map((c) => ({
    id: c.id,
    slot: c.slot,
    trigger: c.trigger,
    status: c.status,
    startedAt: c.startedAt,
    finishedAt: c.finishedAt,
    fileName: c.fileName,
    bytes: c.bytes,
    totalRows: c.totalRows,
    totalTables: c.totalTables,
    error: c.error,
    disponible: !!(c.fileName && porNombre.has(c.fileName)),
  }));
}

module.exports = {
  FRECUENCIAS,
  partesLocales,
  correspondeAhora,
  slotAIntentar,
  getSchedule,
  saveSchedule,
  ejecutarBackup,
  listarBackups,
};
