// Backup de la base por línea de comandos.
//
// La lógica vive en server/lib/backup-runner.js, que es la misma que usa el
// botón del panel de plataforma. Dos implementaciones del backup significarían
// dos comportamientos distintos ante un error, y el día que hace falta restaurar
// nadie sabe cuál produjo el archivo que tiene en la mano.
//
// Uso:
//   node scripts/backup-db.js
//   BACKUP_DIR=~/backups node scripts/backup-db.js     (recomendado en el server)
//
// En el servidor hay que exportar DATABASE_URL a mano — los scripts sueltos por
// SSH no reciben lo que Passenger le inyecta a la app:
//   DATABASE_URL="mysql://usuario:pass@127.0.0.1:3306/base" \
//     /opt/alt/alt-nodejs22/root/usr/bin/node scripts/backup-db.js

require("../server/lib/load-env").loadEnv();

const { runDatabaseBackup } = require("../server/lib/backup-runner");

async function main() {
  const resultado = await runDatabaseBackup({ log: (m) => console.log(m) });

  console.log(`\nManifiesto: ${require("path").basename(resultado.rutaManifiesto)}`);
  console.log(
    `\nVerificá la restauración antes de confiar en este backup:\n` +
      `  node scripts/verify-restore.js "${resultado.rutaSql}"`
  );
}

main().catch((error) => {
  console.error(`\nBackup FALLIDO: ${error.message}`);
  process.exitCode = 1;
});
