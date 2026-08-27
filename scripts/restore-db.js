// Restaura un backup sobre una base real. Es la contracara de backup-db.js y el
// único camino pensado para volver atrás después de una falla.
//
// Uso normal — restaurar en una base nueva, al lado de producción, y recién
// después apuntar la app ahí (ver docs/RESTAURAR-BACKUP.md):
//
//   RESTORE_DATABASE_URL="mysql://usuario:clave@127.0.0.1:3306/u123_odentara_rescate" \
//     node scripts/restore-db.js ~/backups/db/odentara-db-2026-08-24_03-00-11.sql.gz
//
// Uso de último recurso — pisar la base que la app está usando ahora mismo:
//
//   node scripts/restore-db.js <archivo.sql.gz> --sobre-produccion
//
// Antes de pisar nada, el script hace un dump del estado actual en
// <BACKUP_DIR>/pre-restore/. Ese dump queda fuera de la rotación automática: es
// la única copia de todo lo que se cargó entre el backup y la falla, y perderla
// por retención sería perder justo lo que uno va a querer rescatar después.

require("../server/lib/load-env").loadEnv();

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const {
  parseDatabaseUrl,
  formatBytes,
  backupRoot,
  runDatabaseBackup,
} = require("../server/lib/backup-runner");
const {
  contarFilas,
  baseExiste,
  restaurarDump,
  compararConManifiesto,
  tablasFaltantesParaElCodigo,
} = require("../server/lib/restore-runner");

function preguntar(pregunta) {
  // Sin terminal no hay forma de confirmar, y una restauración que arranca sola
  // desde un cron o un pipe es exactamente lo que no queremos que exista.
  if (!process.stdin.isTTY) {
    return Promise.reject(
      new Error(
        "Esto necesita una terminal para confirmar. Corrélo a mano por SSH, no desde un script."
      )
    );
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(pregunta, (respuesta) => {
      rl.close();
      resolve(respuesta.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const archivoSql = args.find((a) => !a.startsWith("--"));

  const sobreProduccion = flags.has("--sobre-produccion");
  const sinRespaldo = flags.has("--sin-respaldo");

  if (!archivoSql) {
    throw new Error(
      "Falta el archivo: node scripts/restore-db.js <backup.sql.gz> [--sobre-produccion]"
    );
  }
  if (!fs.existsSync(archivoSql)) {
    throw new Error(`No existe: ${archivoSql}`);
  }

  // --- Qué se va a restaurar -------------------------------------------------
  const archivoManifiesto = archivoSql.replace(/\.sql\.gz$/, ".manifest.json");
  const manifiesto = fs.existsSync(archivoManifiesto)
    ? JSON.parse(fs.readFileSync(archivoManifiesto, "utf8"))
    : null;

  console.log(`\nBackup:  ${path.basename(archivoSql)} (${formatBytes(fs.statSync(archivoSql).size)})`);
  if (manifiesto) {
    console.log(`Origen:  ${manifiesto.base} — ${manifiesto.creadoEn}`);
    console.log(`Contenido esperado: ${Object.keys(manifiesto.tablas || {}).length} tablas, ${manifiesto.totalFilas} filas`);
  } else {
    console.log("Origen:  (sin manifiesto)");
    console.log(
      "OJO: sin el .manifest.json al lado, se puede restaurar pero NO se puede\n" +
        "     comprobar que haya entrado todo. Bajá el manifiesto junto con el .sql.gz."
    );
  }

  // --- Sobre qué base --------------------------------------------------------
  let urlDestino;
  if (sobreProduccion) {
    if (!process.env.DATABASE_URL) {
      throw new Error("Falta DATABASE_URL: no se sabe cuál es la base de la app.");
    }
    urlDestino = process.env.DATABASE_URL;
  } else {
    if (!process.env.RESTORE_DATABASE_URL) {
      throw new Error(
        "Falta RESTORE_DATABASE_URL, que tiene que apuntar a la base donde querés\n" +
          "restaurar (lo recomendado es una base nueva, vacía, creada desde el panel).\n" +
          "Si de verdad querés pisar la base que la app está usando ahora, agregá --sobre-produccion."
      );
    }
    urlDestino = process.env.RESTORE_DATABASE_URL;
  }

  const cfg = parseDatabaseUrl(urlDestino);

  // Que --sobre-produccion no sea solo una etiqueta: si la URL de destino no es
  // la de la app, el flag está de más y probablemente sea un error de copiado.
  if (!sobreProduccion && process.env.DATABASE_URL) {
    const actual = parseDatabaseUrl(process.env.DATABASE_URL);
    if (actual.database === cfg.database && actual.host === cfg.host) {
      throw new Error(
        `RESTORE_DATABASE_URL apunta a "${cfg.database}", que es la base que la app está usando.\n` +
          "Si es a propósito, corré con --sobre-produccion para que quede explícito."
      );
    }
  }

  console.log(`\nDestino: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);

  if (!(await baseExiste(cfg))) {
    throw new Error(
      `La base "${cfg.database}" no existe. Creála primero desde el panel de Hostinger\n` +
        "(Bases de datos → Crear nueva) y dale permisos al mismo usuario."
    );
  }

  // --- Qué se pierde ---------------------------------------------------------
  const antes = await contarFilas(cfg);
  const filasAntes = Object.values(antes).reduce((a, b) => a + b, 0);
  const tablasAntes = Object.keys(antes).length;

  if (tablasAntes === 0) {
    console.log("Estado actual: vacía. No se pierde nada.\n");
  } else {
    console.log(`Estado actual: ${tablasAntes} tablas, ${filasAntes} filas — SE BORRAN.\n`);
  }

  // --- Respaldo de lo que se pisa -------------------------------------------
  if (tablasAntes > 0 && !sinRespaldo) {
    console.log("Respaldando el estado actual antes de pisarlo…");
    const respaldo = await runDatabaseBackup({
      databaseUrl: urlDestino,
      directorio: path.join(backupRoot(), "pre-restore"),
      log: (m) => console.log(`  ${m}`),
    });
    console.log(`Respaldo listo: ${respaldo.rutaSql}\n`);
  } else if (tablasAntes > 0) {
    console.log("--sin-respaldo: NO se respalda el estado actual. Se pierde para siempre.\n");
  }

  // --- Confirmación ----------------------------------------------------------
  const respuesta = await preguntar(
    `Escribí el nombre de la base para confirmar que se borra y se reemplaza\n` +
      `("${cfg.database}", o cualquier otra cosa para cancelar): `
  );
  if (respuesta !== cfg.database) {
    console.log("\nCancelado. No se tocó nada.");
    return;
  }

  // --- Restauración ----------------------------------------------------------
  console.log("");
  const { restaurado } = await restaurarDump({
    cfg,
    archivoSql,
    log: (m) => console.log(m),
  });

  const totalRestaurado = Object.values(restaurado).reduce((a, b) => a + b, 0);
  console.log(`\n${Object.keys(restaurado).length} tablas — ${totalRestaurado} filas restauradas`);

  if (manifiesto) {
    const { problemas } = compararConManifiesto(restaurado, manifiesto);
    if (problemas.length) {
      console.error(`\nLA RESTAURACIÓN NO COINCIDE CON EL MANIFIESTO — ${problemas.length} diferencias:`);
      for (const p of problemas) console.error(p);
      console.error(
        "\nLa base quedó en un estado que no es ni el de antes ni el del backup.\n" +
          "NO apuntes la app acá. Revisá el error de arriba y volvé a intentar."
      );
      process.exitCode = 1;
      return;
    }
    console.log(`Coincide con el manifiesto (${manifiesto.totalFilas} filas). Restauración completa.`);
  }

  // --- Desfasaje de esquema --------------------------------------------------
  const faltantes = tablasFaltantesParaElCodigo(restaurado);
  if (faltantes.length) {
    console.log(
      `\nATENCIÓN: el backup es anterior al esquema actual. Faltan ${faltantes.length} tablas\n` +
        `que el código desplegado usa: ${faltantes.join(", ")}.\n` +
        "Antes de apuntar la app acá, aplicá el SQL de las migraciones posteriores\n" +
        "(prisma/migrations/, de la más vieja a la más nueva)."
    );
  }

  // --- Qué hacer ahora -------------------------------------------------------
  console.log("\nSiguiente paso:");
  if (sobreProduccion) {
    console.log("  La app ya apunta acá. Reiniciá Passenger para que suelte las conexiones viejas.");
  } else {
    console.log(`  1. Cambiá DATABASE_URL en .env-secrets para que apunte a "${cfg.database}".`);
    console.log("  2. Reiniciá Passenger desde el panel de Hostinger.");
    console.log("  3. Entrá a la app y comprobá que ves los datos del backup.");
    console.log("  La base vieja queda intacta: si algo sale mal, volvés cambiando DATABASE_URL.");
  }
  console.log(
    "\n  Las imágenes clínicas viven en R2, no en la base: no vuelven atrás con esto."
  );
}

main().catch((error) => {
  console.error(`\nRestauración FALLIDA: ${error.message}`);
  process.exitCode = 1;
});
