// Dispara el backup programado desde un cron del sistema, no desde la app.
//
// El programador que vive en `backup-scheduler.js` es un node-cron DENTRO del
// proceso de la app, y ahí está su límite: en hosting compartido Passenger
// recicla y duerme los workers cuando no hay tráfico. De madrugada no hay nadie
// usando el sistema, así que a las 03:20 puede no haber ningún proceso vivo que
// evalúe el turno. Se vio el 26/8: el intento de las 03:00 quedó registrado como
// fallido y los dos reintentos nunca corrieron, porque no había worker.
//
// Este script hace exactamente lo mismo que un tick del programador, pero como
// proceso propio. Reusa `revisarYCorrer()` a propósito: así el turno, la reserva
// atómica del slot, los reintentos, la retención y el registro en el historial
// son EXACTAMENTE los mismos que los de la app. Dos implementaciones del mismo
// backup terminarían pisándose o divergiendo.
//
// Convivir con el programador de la app es seguro: los dos calculan el mismo
// slot para el mismo turno y la restricción de unicidad de `BackupRun.slot` deja
// pasar a uno solo. El que pierde la carrera se retira sin hacer nada.
//
// Uso en el cron de Hostinger (hPanel → Cron Jobs). Tres corridas espaciadas
// veinte minutos, que es la separación entre reintentos:
//
//   0,20,40 3 * * *  cd ~/domains/odentara.com/hbuilds/current/nodejs && \
//     DATABASE_URL="mysql://usuario:clave@127.0.0.1:3306/base" \
//     /opt/alt/alt-nodejs20/root/usr/bin/node scripts/backup-cron.js >> ~/backups/cron.log 2>&1
//
// Fuera de la ventana del turno no hace nada: una consulta a la base y termina.

"use strict";

require("../server/lib/load-env").loadEnv();

const { revisarYCorrer } = require("../server/lib/backup-scheduler");

const marca = new Date().toISOString();

revisarYCorrer()
  .then(() => {
    // No dice "backup hecho": revisarYCorrer() no informa si le tocó ejecutar,
    // si otro se quedó con el turno o si no era la hora. Lo que pasó de verdad
    // queda en el historial del panel, que es donde hay que mirarlo.
    console.log(`[${marca}] backup-cron: turno evaluado.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[${marca}] backup-cron FALLÓ: ${error.message}`);
    process.exit(1);
  });
