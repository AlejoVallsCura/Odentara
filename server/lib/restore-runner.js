// Motor de restauración. Lo comparten el verificador (que restaura sobre una
// base descartable) y la restauración de verdad (que restaura sobre la base que
// usa la app).
//
// Están juntos a propósito: si el verificador y la restauración real usaran
// caminos distintos, "verificado" no querría decir nada. Lo único que cambia
// entre uno y otro es a qué base apuntan y cuánto preguntan antes.

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const mariadb = require("mariadb");

// Mismo layout que backup-runner: Laragon en desarrollo, CloudLinux en Hostinger.
const CANDIDATOS_MYSQL = [
  "C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysql.exe",
  "/usr/bin/mysql",
  "/usr/local/bin/mysql",
  "/opt/alt/mysql-client/usr/bin/mysql",
];

function resolverMysql() {
  if (process.env.MYSQL_BIN) return process.env.MYSQL_BIN;
  for (const candidato of CANDIDATOS_MYSQL) {
    if (fs.existsSync(candidato)) return candidato;
  }
  return "mysql";
}

/**
 * La contraseña va en un archivo 0600 y no en --password: en hosting compartido
 * hay otros usuarios en la máquina y `ps` muestra la línea de comandos entera.
 */
function escribirDefaultsFile(cfg) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "odentara-restore-"));
  const archivo = path.join(dir, "my.cnf");
  fs.writeFileSync(
    archivo,
    "[client]\n" +
      `host=${cfg.host}\n` +
      `port=${cfg.port}\n` +
      `user=${cfg.user}\n` +
      `password="${cfg.password.replace(/"/g, '\\"')}"\n`,
    { mode: 0o600 }
  );
  return archivo;
}

function conectar(cfg, conBase = true) {
  return mariadb.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    ...(conBase ? { database: cfg.database } : {}),
  });
}

const esc = (nombre) => nombre.replace(/`/g, "``");

/**
 * Cuenta las filas reales de cada tabla.
 *
 * COUNT(*) y no information_schema.TABLE_ROWS: en InnoDB ese último es una
 * estimación del optimizador que puede errarle por miles de filas, y comparar
 * contra una estimación no verifica nada.
 */
async function contarFilas(cfg) {
  const conexion = await conectar(cfg);
  try {
    const tablas = await conexion.query(
      "SELECT TABLE_NAME AS nombre FROM information_schema.TABLES " +
        "WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
      [cfg.database]
    );
    const conteos = {};
    for (const { nombre } of tablas) {
      const [fila] = await conexion.query(`SELECT COUNT(*) AS total FROM \`${esc(nombre)}\``);
      conteos[nombre] = Number(fila.total);
    }
    return conteos;
  } finally {
    await conexion.end();
  }
}

async function baseExiste(cfg) {
  const conexion = await conectar(cfg, false);
  try {
    const filas = await conexion.query(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [cfg.database]
    );
    return filas.length > 0;
  } finally {
    await conexion.end();
  }
}

/**
 * Deja la base vacía y lista para importar.
 *
 * Con `recrear` hace DROP DATABASE + CREATE DATABASE, y solo se usa contra la
 * base descartable del verificador. Sobre una base real NO se hace nunca: en
 * Hostinger las bases se crean desde el panel, que lleva su propia contabilidad
 * de cuáles existen y quién tiene acceso, y borrarla por abajo con SQL es pedir
 * un problema el día de peor humor posible. Además el usuario de hosting
 * compartido muchas veces ni siquiera tiene el permiso, así que ese camino
 * fallaría justo en el servidor donde hace falta.
 *
 * El camino normal borra las tablas una por una, que alcanza: el dump ya trae
 * su propio `DROP TABLE IF EXISTS` para cada tabla que contiene. Lo que esto
 * agrega es sacar las tablas que hoy existen y en el backup todavía no —el caso
 * de volver a una copia anterior a una migración—, que si no quedarían con
 * datos viejos mezclados con la restauración.
 *
 * Devuelve qué camino usó.
 */
async function vaciarBase(cfg, { recrear = false, log = () => {} } = {}) {
  const nombre = esc(cfg.database);

  if (recrear) {
    const conexion = await conectar(cfg, false);
    try {
      await conexion.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
      await conexion.query(
        `CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      return "recreada";
    } finally {
      await conexion.end();
    }
  }

  const conexion = await conectar(cfg);
  try {
    const tablas = await conexion.query(
      "SELECT TABLE_NAME AS nombre, TABLE_TYPE AS tipo FROM information_schema.TABLES " +
        "WHERE TABLE_SCHEMA = ?",
      [cfg.database]
    );
    if (!tablas.length) return "ya-vacia";
    log(`  borrando ${tablas.length} tablas existentes…`);

    // Las claves foráneas hacen imposible encontrar un orden de borrado que
    // sirva siempre (hay ciclos en el esquema). Se apagan mientras dura.
    await conexion.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const { nombre: tabla, tipo } of tablas) {
        const comando = tipo === "VIEW" ? "DROP VIEW" : "DROP TABLE";
        await conexion.query(`${comando} IF EXISTS \`${esc(tabla)}\``);
      }
    } finally {
      await conexion.query("SET FOREIGN_KEY_CHECKS = 1");
    }
    return "tablas-borradas";
  } finally {
    await conexion.end();
  }
}

function importarDump({ binario, defaultsFile, database, archivoSql }) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(binario, [`--defaults-file=${defaultsFile}`, database], {
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    proceso.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    proceso.on("error", (error) =>
      reject(new Error(`No se pudo ejecutar "${binario}": ${error.message}`))
    );
    proceso.on("close", (codigo) => {
      if (codigo === 0) resolve();
      else reject(new Error(`mysql salió con código ${codigo}: ${stderr.trim()}`));
    });

    // Si el .gz está truncado, gunzip falla acá — que es exactamente el caso que
    // se quiere detectar antes de necesitar el backup de verdad.
    pipeline(fs.createReadStream(archivoSql), zlib.createGunzip(), proceso.stdin).catch(reject);
  });
}

/**
 * Compara lo restaurado contra el manifiesto del backup.
 *
 * Los nombres de tabla se comparan ignorando mayúsculas y minúsculas. El caso
 * normal es dump en Linux y verificación en Windows, y ahí el nombre cambia
 * solo: MariaDB en Linux guarda `Patient`, pero MySQL en Windows arranca con
 * lower_case_table_names=1 y lo importa como `patient`. Comparando de forma
 * sensible, un backup íntegro daba "50 diferencias" —las mismas 25 tablas
 * contadas como faltantes y como sobrantes— y fallaba justo cuando todo estaba
 * bien. Un verificador que grita en falso es peor que no tenerlo: enseña a
 * ignorarlo.
 */
function compararConManifiesto(restaurado, manifiesto) {
  const indexar = (obj) => {
    const mapa = new Map();
    for (const [nombre, filas] of Object.entries(obj || {})) {
      mapa.set(nombre.toLowerCase(), { nombre, filas });
    }
    return mapa;
  };

  const esperadas = indexar(manifiesto.tablas);
  const obtenidas = indexar(restaurado);
  const claves = [...new Set([...esperadas.keys(), ...obtenidas.keys()])].sort();

  const problemas = [];
  for (const clave of claves) {
    const esperado = esperadas.get(clave);
    const obtenido = obtenidas.get(clave);

    if (!esperado) {
      problemas.push(`  + ${obtenido.nombre}: apareció en la restauración y no estaba en el manifiesto`);
    } else if (!obtenido) {
      problemas.push(`  - ${esperado.nombre}: falta en la restauración (esperaba ${esperado.filas} filas)`);
    } else if (esperado.filas !== obtenido.filas) {
      problemas.push(`  ≠ ${esperado.nombre}: ${obtenido.filas} filas, esperaba ${esperado.filas}`);
    }
  }

  return {
    problemas,
    tablas: claves.length,
    totalRestaurado: Object.values(restaurado).reduce((a, b) => a + b, 0),
  };
}

/**
 * Tablas que espera el código que está desplegado hoy, leídas del schema de
 * Prisma. Ninguna usa @@map, así que el nombre del modelo es el de la tabla.
 *
 * Sirve para detectar el desfasaje que aparece al volver a un backup viejo: el
 * dump trae el esquema del día que se hizo, pero el código es el de hoy. Volver
 * al backup del 20 con el código del 24 deja la app pidiendo tablas que en ese
 * dump todavía no existían, y el síntoma es un error críptico en una pantalla
 * cualquiera en vez de un aviso al restaurar.
 */
function tablasQueEsperaElCodigo(schemaPath) {
  const ruta = schemaPath || path.join(__dirname, "..", "..", "prisma", "schema.prisma");
  if (!fs.existsSync(ruta)) return [];
  const contenido = fs.readFileSync(ruta, "utf8");
  return [...contenido.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
}

function tablasFaltantesParaElCodigo(restaurado, schemaPath) {
  const presentes = new Set(Object.keys(restaurado).map((t) => t.toLowerCase()));
  return tablasQueEsperaElCodigo(schemaPath).filter((t) => !presentes.has(t.toLowerCase()));
}

/**
 * Restaura un dump sobre la base que indique cfg. NO pregunta nada: quien llama
 * es el responsable de haber confirmado y de haber respaldado lo que se pisa.
 */
async function restaurarDump({ cfg, archivoSql, recrear = false, log = () => {} }) {
  if (!fs.existsSync(archivoSql)) throw new Error(`No existe: ${archivoSql}`);

  log("Vaciando la base de destino…");
  const modo = await vaciarBase(cfg, { recrear, log });

  const defaultsFile = escribirDefaultsFile(cfg);
  try {
    log("Importando dump…");
    await importarDump({
      binario: resolverMysql(),
      defaultsFile,
      database: cfg.database,
      archivoSql,
    });
  } finally {
    fs.rmSync(path.dirname(defaultsFile), { recursive: true, force: true });
  }

  log("Contando filas restauradas…");
  const restaurado = await contarFilas(cfg);
  return { restaurado, modo };
}

module.exports = {
  resolverMysql,
  escribirDefaultsFile,
  contarFilas,
  baseExiste,
  vaciarBase,
  importarDump,
  restaurarDump,
  compararConManifiesto,
  tablasQueEsperaElCodigo,
  tablasFaltantesParaElCodigo,
};
