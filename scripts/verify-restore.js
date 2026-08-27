// Restaura un backup en una base descartable y compara el resultado contra el
// manifiesto que escribió `backup-db.js`.
//
// Esto es lo que convierte el dump en un backup: hasta que no se restaura, lo
// único que se sabe del archivo es que existe y pesa algo. Los modos de falla
// reales que este script detecta son silenciosos en el momento del dump —
// mysqldump cortado a la mitad por un timeout, tablas que el usuario de la base
// no tenía permiso de leer, gzip truncado.
//
// Uso:
//   VERIFY_DATABASE_URL="mysql://root:@localhost:3306/odentara_verify" \
//     node scripts/verify-restore.js backups/db/odentara-db-2026-08-19_14-32-05.sql.gz
//
// La base de VERIFY_DATABASE_URL SE BORRA Y SE RECREA en cada corrida. Por eso
// se pide explícita en su propia variable y con nombre terminado en _verify o
// _restore: para que no haya forma de escribir "node verify-restore.js" y
// apuntarle sin querer a producción. Para restaurar de verdad sobre la base que
// usa la app está `scripts/restore-db.js`, que pide confirmación escrita.

require("../server/lib/load-env").loadEnv();

const fs = require("fs");
const path = require("path");

const { parseDatabaseUrl, formatBytes } = require("../server/lib/backup-runner");
const {
  restaurarDump,
  compararConManifiesto,
  tablasFaltantesParaElCodigo,
} = require("../server/lib/restore-runner");

// Solo se acepta restaurar sobre bases cuyo nombre deja claro que son
// descartables. Es una barrera tosca a propósito: la alternativa es un flag
// --force que alguien va a tipear apurado un viernes.
const NOMBRE_PERMITIDO = /(_verify|_restore|_test)$/;

async function main() {
  const archivoSql = process.argv[2];
  if (!archivoSql) {
    throw new Error("Falta el archivo: node scripts/verify-restore.js <backup.sql.gz>");
  }
  if (!fs.existsSync(archivoSql)) {
    throw new Error(`No existe: ${archivoSql}`);
  }

  const archivoManifiesto = archivoSql.replace(/\.sql\.gz$/, ".manifest.json");
  if (!fs.existsSync(archivoManifiesto)) {
    throw new Error(
      `No está el manifiesto ${path.basename(archivoManifiesto)}. ` +
        "Sin él se puede restaurar, pero no verificar que los datos estén completos."
    );
  }
  const manifiesto = JSON.parse(fs.readFileSync(archivoManifiesto, "utf8"));

  if (!process.env.VERIFY_DATABASE_URL) {
    throw new Error(
      "Falta VERIFY_DATABASE_URL. Tiene que apuntar a una base DESCARTABLE " +
        "(se borra y se recrea), con nombre terminado en _verify, _restore o _test."
    );
  }
  const cfg = parseDatabaseUrl(process.env.VERIFY_DATABASE_URL);

  if (!NOMBRE_PERMITIDO.test(cfg.database)) {
    throw new Error(
      `"${cfg.database}" no termina en _verify, _restore ni _test. ` +
        "Se cancela para no borrar una base que importe."
    );
  }

  console.log(`Backup:  ${path.basename(archivoSql)} (${formatBytes(fs.statSync(archivoSql).size)})`);
  console.log(`Origen:  ${manifiesto.base} — ${manifiesto.creadoEn}`);
  console.log(`Destino: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} (se recrea)\n`);

  // recrear: la base del verificador es descartable y se quiere limpia de
  // verdad en cada corrida, no solo sin tablas.
  const { restaurado } = await restaurarDump({
    cfg,
    archivoSql,
    recrear: true,
    log: (m) => console.log(m),
  });

  const { problemas, tablas, totalRestaurado } = compararConManifiesto(restaurado, manifiesto);
  console.log(
    `\n${tablas} tablas — ${totalRestaurado} filas restauradas, ${manifiesto.totalFilas} esperadas`
  );

  if (problemas.length) {
    console.error(`\nVERIFICACIÓN FALLIDA — ${problemas.length} diferencias:`);
    for (const p of problemas) console.error(p);
    console.error(
      "\nEste backup NO sirve para restaurar. No lo uses como red de seguridad de un deploy."
    );
    process.exitCode = 1;
    return;
  }

  console.log("\nVERIFICACIÓN OK — el backup restaura completo.");

  // El backup puede estar íntegro y aun así no servir para volver: si es
  // anterior a una migración, le faltan tablas que el código de hoy usa.
  const faltantes = tablasFaltantesParaElCodigo(restaurado);
  if (faltantes.length) {
    console.log(
      `\nOJO: es anterior al esquema actual. Le faltan ${faltantes.length} tablas ` +
        `que el código de hoy usa: ${faltantes.join(", ")}.`
    );
    console.log("Para volver a este backup habría que aplicarle las migraciones posteriores.");
  }

  console.log(
    `Podés inspeccionar la copia en \`${cfg.database}\` antes de que la próxima corrida la pise.`
  );
}

main().catch((error) => {
  console.error(`\nVerificación FALLIDA: ${error.message}`);
  process.exitCode = 1;
});
