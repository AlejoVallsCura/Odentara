// Backup automático programado.
//
// El problema que domina el diseño: la plataforma levanta varios procesos worker
// del mismo build, y `cron.schedule` corre en cada uno. Sin coordinación, un
// backup diario serían tres o cuatro dumps simultáneos peleando por el disco y
// abriendo transacciones largas sobre la base de producción.
//
// La coordinación es la restricción de unicidad de BackupRun.slot: todos los
// workers calculan la misma cadena para el mismo turno, el primero que la
// inserta gana y los demás reciben un error de duplicado y se retiran. Es el
// mismo recurso que usa reminder-scheduler para no mandar el recordatorio dos
// veces, y tiene la virtud de que la coordinación vive en la base — el único
// lugar que todos los workers comparten.

"use strict";

const cron = require("node-cron");

const { getSchedule, ejecutarBackup, slotAIntentar } = require("./backup-service");
const { correspondeAhora } = require("./backup-schedule-rules");

// Cada 5 minutos. La ventana de correspondeAhora es de 2 horas, así que un tick
// perdido —worker reciclado, reinicio— lo agarra el siguiente, y un intento que
// falla se puede reintentar más tarde dentro del mismo turno.
const EXPRESION_CRON = "*/5 * * * *";

let tarea = null;

async function revisarYCorrer() {
  let schedule;
  try {
    schedule = await getSchedule();
  } catch (error) {
    console.error("[backups] No se pudo leer la programación:", error.message);
    return;
  }

  const base = correspondeAhora(schedule);
  if (!base) return;

  // Dentro de la ventana, esto responde "no hay nada que hacer" en casi todos
  // los ticks: el turno ya salió bien, o hay uno corriendo, o hay que esperar
  // antes de reintentar. Solo devuelve un slot cuando de verdad toca ejecutar.
  let slot;
  try {
    slot = await slotAIntentar(base);
  } catch (error) {
    console.error(`[backups] No se pudo evaluar el turno ${base}:`, error.message);
    return;
  }
  if (!slot) return;

  try {
    const run = await ejecutarBackup({
      slot,
      trigger: "scheduled",
      keepLast: schedule.keepLast,
    });

    // null = otro worker se quedó con este intento. Es el caso normal, no un fallo.
    if (!run) return;

    console.log(`[backups] Backup automático ${slot} completado (${run.fileName}).`);
  } catch (error) {
    // Ya quedó registrado como "error" en BackupRun; acá solo se deja rastro en
    // el log del proceso. No se relanza: tirar abajo el worker por un backup
    // fallido sería peor que el backup fallido.
    console.error(`[backups] Backup automático ${slot} falló:`, error.message);
  }
}

function startBackupScheduler() {
  if (tarea) return tarea;
  tarea = cron.schedule(EXPRESION_CRON, () => {
    revisarYCorrer().catch((error) =>
      console.error("[backups] Error inesperado en el scheduler:", error.message)
    );
  });
  return tarea;
}

function stopBackupScheduler() {
  if (tarea) {
    tarea.stop();
    tarea = null;
  }
}

module.exports = { startBackupScheduler, stopBackupScheduler, revisarYCorrer, EXPRESION_CRON };
