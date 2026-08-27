// Motor de backup de la base. Una sola implementación para los dos disparadores:
// el script de línea de comandos y el botón del panel de plataforma.
//
// Vive en server/lib y no en scripts/ porque el servidor no puede depender de
// una carpeta de utilidades sueltas: si mañana se mueve scripts/, la app se
// queda sin backups. Al revés sí funciona — el script importa de acá.

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const mariadb = require("mariadb");

/**
 * Marca temporal ordenable y válida como nombre de archivo en Windows y Linux.
 * Hora local, que es la que tiene en la cabeza quien busca "el de antes del
 * deploy de esta tarde".
 */
function timestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`
  );
}

/**
 * Raíz donde viven los backups.
 *
 * BACKUP_DIR manda. Si no está, cuelga del home del usuario y NO de la carpeta
 * de la app: el sistema de deploy corre desde .builds/versions/<hash>/, un hash
 * distinto en cada publicación, así que cualquier cosa guardada ahí adentro
 * desaparece de vista al siguiente deploy. Y peor, quedaría dentro del árbol que
 * sirve el servidor web.
 */
function backupRoot() {
  if (process.env.BACKUP_DIR) return path.resolve(process.env.BACKUP_DIR);
  return path.join(os.homedir(), "backups");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Parsea DATABASE_URL a los campos que necesita el cliente de MySQL.
 *
 * Se usa `new URL` y no una expresión regular porque la contraseña puede traer
 * caracteres percent-encoded (`@`, `:`, `/` son válidos ahí) y una regex los
 * parte mal. decodeURIComponent devuelve el valor real.
 */
function parseDatabaseUrl(raw) {
  if (!raw) {
    throw new Error(
      "Falta DATABASE_URL. En el servidor hay que exportarla a mano: los scripts " +
        "sueltos no reciben las variables que Passenger le inyecta a la app."
    );
  }

  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error("DATABASE_URL no incluye nombre de base.");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(2)} ${units[i]}`;
}

// Rutas donde puede estar mysqldump cuando no está en el PATH. La primera es
// Laragon en desarrollo; las de /opt/alt son el layout de CloudLinux que usa
// Hostinger. MYSQLDUMP_BIN gana sobre todas.
const CANDIDATOS_MYSQLDUMP = [
  "C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysqldump.exe",
  "/usr/bin/mysqldump",
  "/usr/local/bin/mysqldump",
  "/opt/alt/mysql-client/usr/bin/mysqldump",
];

function resolverMysqldump() {
  if (process.env.MYSQLDUMP_BIN) return process.env.MYSQLDUMP_BIN;
  for (const candidato of CANDIDATOS_MYSQLDUMP) {
    if (fs.existsSync(candidato)) return candidato;
  }
  // Puede estar en el PATH igual; si no, el error de spawn dice qué falta.
  return "mysqldump";
}

const FLAGS_BASE = [
  // Dump consistente sin bloquear escrituras: abre una transacción y lee todo
  // del mismo snapshot. Requiere InnoDB, que es lo que usa el esquema.
  "--single-transaction",
  "--quick",
  "--default-character-set=utf8mb4",
  // INSERT con nombres de columna explícitos. Ocupa más, pero se restaura sin
  // romperse aunque el orden de columnas del destino difiera — que es el caso
  // normal al restaurar sobre una base creada por `prisma migrate`.
  "--complete-insert",
];

// De más completo a más permisivo. En hosting compartido el usuario de la base
// suele no tener PROCESS ni EVENT, y mysqldump aborta entero en vez de saltear
// esa parte. Mejor un dump sin eventos que ningún dump. El juego que funcionó
// queda registrado en el manifiesto para que no sea una sorpresa al restaurar.
const JUEGOS_DE_FLAGS = [
  { nombre: "completo", flags: ["--routines", "--triggers", "--events", "--no-tablespaces"] },
  { nombre: "sin-eventos", flags: ["--routines", "--triggers", "--no-tablespaces"] },
  { nombre: "minimo", flags: ["--no-tablespaces", "--skip-lock-tables"] },
];

/**
 * mysqldump acepta la contraseña por --password, pero eso la deja visible en
 * `ps` para cualquier otro usuario de la máquina — y en hosting compartido hay
 * otros usuarios. Un archivo de credenciales con permisos 0600 lo evita.
 */
function escribirDefaultsFile(cfg) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "odentara-backup-"));
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

/**
 * Cuenta las filas reales de cada tabla.
 *
 * COUNT(*) y no information_schema.TABLE_ROWS: en InnoDB ese último es una
 * estimación del optimizador que puede errarle por miles de filas, y un
 * verificador que compara contra una estimación no verifica nada.
 */
async function contarFilas(cfg) {
  const conexion = await mariadb.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  });

  try {
    const tablas = await conexion.query(
      "SELECT TABLE_NAME AS nombre FROM information_schema.TABLES " +
        "WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
      [cfg.database]
    );

    const conteos = {};
    for (const { nombre } of tablas) {
      const [fila] = await conexion.query(
        `SELECT COUNT(*) AS total FROM \`${nombre.replace(/`/g, "``")}\``
      );
      conteos[nombre] = Number(fila.total);
    }
    return conteos;
  } finally {
    await conexion.end();
  }
}

async function correrMysqldump({ binario, defaultsFile, flags, database, destino }) {
  const proceso = spawn(
    binario,
    [`--defaults-file=${defaultsFile}`, ...FLAGS_BASE, ...flags, database],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let stderr = "";
  proceso.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  // El listener de salida se registra ANTES de esperar el pipeline. Al revés, el
  // proceso puede terminar en el intervalo, el evento se pierde y la promesa
  // nunca resuelve: el backup sale con código 0 sin haber escrito nada.
  const salida = new Promise((resolve, reject) => {
    proceso.on("error", (error) =>
      reject(
        new Error(
          `No se pudo ejecutar "${binario}": ${error.message}. ` +
            "Instalá el cliente de MySQL o apuntá MYSQLDUMP_BIN a la ruta correcta."
        )
      )
    );
    proceso.on("close", (codigo) => {
      if (codigo === 0) resolve(stderr);
      else reject(new Error(`mysqldump salió con código ${codigo}: ${stderr.trim()}`));
    });
  });

  await pipeline(proceso.stdout, zlib.createGzip({ level: 9 }), fs.createWriteStream(destino));
  return salida;
}

/**
 * Corre un backup completo y devuelve el manifiesto.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.databaseUrl] por defecto process.env.DATABASE_URL
 * @param {string} [opciones.directorio]  por defecto <backupRoot>/db
 * @param {(mensaje: string) => void} [opciones.log]
 */
async function runDatabaseBackup(opciones = {}) {
  const log = opciones.log || (() => {});
  const cfg = parseDatabaseUrl(opciones.databaseUrl || process.env.DATABASE_URL);

  const marca = timestamp();
  const destinoDir = ensureDir(opciones.directorio || path.join(backupRoot(), "db"));
  const archivoSql = path.join(destinoDir, `odentara-db-${marca}.sql.gz`);
  const archivoManifiesto = path.join(destinoDir, `odentara-db-${marca}.manifest.json`);

  log(`Base: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
  log("Contando filas por tabla…");

  const conteos = await contarFilas(cfg);
  const totalFilas = Object.values(conteos).reduce((a, b) => a + b, 0);
  log(`  ${Object.keys(conteos).length} tablas, ${totalFilas} filas`);

  const binario = resolverMysqldump();
  const defaultsFile = escribirDefaultsFile(cfg);
  let flagsUsados = null;
  let ultimoError = null;

  try {
    for (const juego of JUEGOS_DE_FLAGS) {
      try {
        log(`Ejecutando mysqldump (juego "${juego.nombre}")…`);
        await correrMysqldump({
          binario,
          defaultsFile,
          flags: juego.flags,
          database: cfg.database,
          destino: archivoSql,
        });
        flagsUsados = juego;
        break;
      } catch (error) {
        ultimoError = error;
        // Un binario ausente no mejora con otros flags.
        if (error.message.includes("No se pudo ejecutar")) throw error;
        log(`  falló: ${error.message.split("\n")[0]}`);
      }
    }
  } finally {
    fs.rmSync(path.dirname(defaultsFile), { recursive: true, force: true });
  }

  if (!flagsUsados) {
    fs.rmSync(archivoSql, { force: true });
    throw ultimoError || new Error("mysqldump falló con todos los juegos de flags");
  }

  const bytes = fs.statSync(archivoSql).size;

  // Un dump vacío es el modo de falla silencioso más peligroso: el proceso
  // termina bien, el archivo existe, y se descubre el día que hay que restaurar.
  // Con datos reales el gzip nunca baja de unos pocos KB.
  if (bytes < 1024) {
    fs.rmSync(archivoSql, { force: true });
    throw new Error(
      `El dump quedó en ${formatBytes(bytes)} — casi seguro está vacío. ` +
        "Revisá permisos del usuario de la base."
    );
  }

  const manifiesto = {
    creadoEn: new Date().toISOString(),
    base: cfg.database,
    host: cfg.host,
    archivo: path.basename(archivoSql),
    bytes,
    juegoDeFlags: flagsUsados.nombre,
    flags: [...FLAGS_BASE, ...flagsUsados.flags],
    totalFilas,
    tablas: conteos,
  };

  fs.writeFileSync(archivoManifiesto, JSON.stringify(manifiesto, null, 2));
  log(`Listo: ${formatBytes(bytes)} en ${path.basename(archivoSql)}`);

  return { ...manifiesto, rutaSql: archivoSql, rutaManifiesto: archivoManifiesto, marca };
}

/**
 * Lista los backups existentes, del más nuevo al más viejo.
 *
 * Se lee del disco y no de la tabla de historial a propósito: el disco es la
 * verdad. Un registro sin archivo (borrado a mano) no debería aparecer como
 * disponible para descargar.
 */
function listDatabaseBackups(directorio) {
  const dir = directorio || path.join(backupRoot(), "db");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql.gz"))
    .map((archivo) => {
      const completo = path.join(dir, archivo);
      const manifiestoPath = completo.replace(/\.sql\.gz$/, ".manifest.json");
      let manifiesto = null;
      if (fs.existsSync(manifiestoPath)) {
        try {
          manifiesto = JSON.parse(fs.readFileSync(manifiestoPath, "utf8"));
        } catch {
          manifiesto = null;
        }
      }
      const stat = fs.statSync(completo);
      return {
        archivo,
        bytes: stat.size,
        creadoEn: manifiesto?.creadoEn || stat.mtime.toISOString(),
        totalFilas: manifiesto?.totalFilas ?? null,
        totalTablas: manifiesto ? Object.keys(manifiesto.tablas || {}).length : null,
        // Sin manifiesto se puede restaurar, pero no verificar. Se marca para
        // que la interfaz pueda decirlo en vez de aparentar que está completo.
        tieneManifiesto: !!manifiesto,
      };
    })
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/**
 * Borra los backups más viejos, dejando los `conservar` más recientes.
 * Devuelve los nombres borrados.
 *
 * Sin esto, un backup diario llena el disco en un mes sin que nadie lo note.
 */
function pruneDatabaseBackups(conservar, directorio) {
  const limite = Math.max(1, Number(conservar) || 10);
  const dir = directorio || path.join(backupRoot(), "db");
  const existentes = listDatabaseBackups(dir);
  const sobrantes = existentes.slice(limite);

  const borrados = [];
  for (const b of sobrantes) {
    const sql = path.join(dir, b.archivo);
    const manifiesto = sql.replace(/\.sql\.gz$/, ".manifest.json");
    try {
      fs.rmSync(sql, { force: true });
      fs.rmSync(manifiesto, { force: true });
      borrados.push(b.archivo);
    } catch {
      // Si uno no se puede borrar, se sigue con el resto: la retención es
      // higiene, no debe hacer fallar el backup que la disparó.
    }
  }
  return borrados;
}

module.exports = {
  timestamp,
  backupRoot,
  ensureDir,
  parseDatabaseUrl,
  formatBytes,
  runDatabaseBackup,
  listDatabaseBackups,
  pruneDatabaseBackups,
};
