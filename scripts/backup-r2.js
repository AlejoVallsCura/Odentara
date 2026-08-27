// Backup del bucket R2 (imágenes clínicas y adjuntos) a disco, incremental.
//
// La base y R2 son dos mitades del mismo dato: ClinicalImage guarda la clave
// del objeto, y el objeto vive en R2. Restaurar solo la base deja las fichas
// con imágenes rotas, así que los dos backups van juntos o no sirven.
//
// Es incremental por ETag + tamaño: la segunda corrida solo baja lo que cambió.
// Eso importa porque el egress de R2 se paga y porque un backup que tarda una
// hora termina no corriéndose nunca.
//
// Uso:
//   node scripts/backup-r2.js
//   BACKUP_DIR=~/backups node scripts/backup-r2.js
//
// Necesita las mismas variables que la app (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET_NAME, R2_ENDPOINT). En producción viven en ~/domains/odentara.com/.env-secrets,
// que load-env encuentra solo subiendo por el árbol — correr el script desde
// dentro de la carpeta de la app, no desde el home.

require("../server/lib/load-env").loadEnv();

const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const { timestamp, backupRoot, ensureDir, formatBytes } = require("./lib/backup-common");

const VARIABLES = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
];

function crearCliente() {
  const faltantes = VARIABLES.filter((v) => !process.env[v]);
  if (faltantes.length) {
    throw new Error(
      `Faltan variables de R2: ${faltantes.join(", ")}. ` +
        "En producción están en ~/domains/odentara.com/.env-secrets."
    );
  }

  return new S3Client({
    region: "auto", // R2 ignora la región, pero el SDK exige un valor
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Convierte una clave de objeto en una ruta local segura.
 *
 * Las claves las genera la app, pero se sanean igual: una clave con `..` haría
 * que el backup escriba fuera de su carpeta, y el costo de defenderse es una
 * línea. Se rechaza en vez de normalizar en silencio para que quede registro de
 * que había una clave rara en el bucket.
 */
function rutaLocalSegura(raizObjetos, clave) {
  const destino = path.resolve(raizObjetos, clave);
  const raiz = path.resolve(raizObjetos);
  if (destino !== raiz && !destino.startsWith(raiz + path.sep)) {
    throw new Error(`Clave con ruta sospechosa, se omite: ${clave}`);
  }
  return destino;
}

async function listarTodo(cliente, bucket) {
  const objetos = [];
  let token;

  do {
    const respuesta = await cliente.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token })
    );
    for (const obj of respuesta.Contents || []) {
      // Las "carpetas" de R2 son claves que terminan en / y pesan 0. No son
      // archivos y no hay nada que bajar.
      if (obj.Key.endsWith("/") && obj.Size === 0) continue;
      objetos.push({
        clave: obj.Key,
        bytes: obj.Size,
        etag: (obj.ETag || "").replace(/"/g, ""),
        modificado: obj.LastModified ? obj.LastModified.toISOString() : null,
      });
    }
    token = respuesta.IsTruncated ? respuesta.NextContinuationToken : undefined;
  } while (token);

  return objetos;
}

/**
 * El manifiesto de la corrida anterior es lo que hace posible el incremental.
 * Si no existe (primera vez, o se borró), se baja todo — que es el
 * comportamiento correcto ante la duda.
 */
function leerManifiestoPrevio(archivo) {
  if (!fs.existsSync(archivo)) return new Map();
  try {
    const datos = JSON.parse(fs.readFileSync(archivo, "utf8"));
    return new Map((datos.objetos || []).map((o) => [o.clave, o]));
  } catch {
    console.warn("Manifiesto previo ilegible, se baja todo de nuevo.");
    return new Map();
  }
}

async function main() {
  const cliente = crearCliente();
  const bucket = process.env.R2_BUCKET_NAME;
  const raiz = ensureDir(path.join(backupRoot(), "r2"));
  const raizObjetos = ensureDir(path.join(raiz, "objetos"));
  const archivoManifiesto = path.join(raiz, "manifest.json");

  console.log(`Bucket:  ${bucket}`);
  console.log(`Destino: ${raizObjetos}`);

  console.log("Listando objetos…");
  const objetos = await listarTodo(cliente, bucket);
  const bytesTotales = objetos.reduce((a, o) => a + o.bytes, 0);
  console.log(`  ${objetos.length} objetos, ${formatBytes(bytesTotales)}`);

  const previos = leerManifiestoPrevio(archivoManifiesto);
  let bajados = 0;
  let salteados = 0;
  let bytesBajados = 0;
  const errores = [];

  for (const objeto of objetos) {
    let destino;
    try {
      destino = rutaLocalSegura(raizObjetos, objeto.clave);
    } catch (error) {
      errores.push({ clave: objeto.clave, error: error.message });
      continue;
    }

    // Se salta solo si coinciden las tres cosas: el manifiesto dice que ya se
    // bajó con ese ETag, y el archivo local sigue existiendo con el tamaño
    // esperado. Confiar solo en el manifiesto haría que un archivo borrado a
    // mano nunca se recupere.
    const previo = previos.get(objeto.clave);
    if (
      previo &&
      previo.etag === objeto.etag &&
      fs.existsSync(destino) &&
      fs.statSync(destino).size === objeto.bytes
    ) {
      salteados += 1;
      continue;
    }

    try {
      const respuesta = await cliente.send(
        new GetObjectCommand({ Bucket: bucket, Key: objeto.clave })
      );
      ensureDir(path.dirname(destino));
      // Se escribe a un archivo temporal y se renombra al final: si el proceso
      // se corta a mitad de una descarga, no queda un archivo truncado que la
      // próxima corrida podría dar por bueno.
      const temporal = `${destino}.parcial`;
      await pipeline(respuesta.Body, fs.createWriteStream(temporal));
      fs.renameSync(temporal, destino);

      bajados += 1;
      bytesBajados += objeto.bytes;
      if (bajados % 25 === 0) {
        console.log(`  ${bajados} bajados (${formatBytes(bytesBajados)})…`);
      }
    } catch (error) {
      errores.push({ clave: objeto.clave, error: error.message });
    }
  }

  fs.writeFileSync(
    archivoManifiesto,
    JSON.stringify(
      {
        creadoEn: new Date().toISOString(),
        corrida: timestamp(),
        bucket,
        endpoint: process.env.R2_ENDPOINT,
        totalObjetos: objetos.length,
        totalBytes: bytesTotales,
        objetos,
      },
      null,
      2
    )
  );

  console.log(
    `\nListo: ${bajados} bajados (${formatBytes(bytesBajados)}), ${salteados} sin cambios`
  );

  if (errores.length) {
    console.error(`\n${errores.length} objetos fallaron:`);
    for (const e of errores.slice(0, 20)) console.error(`  ${e.clave}: ${e.error}`);
    if (errores.length > 20) console.error(`  … y ${errores.length - 20} más`);
    // Salir con error importa: si esto corre desde cron, un backup parcial
    // tiene que notificarse, no pasar como exitoso.
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\nBackup de R2 FALLIDO: ${error.message}`);
  process.exitCode = 1;
});
