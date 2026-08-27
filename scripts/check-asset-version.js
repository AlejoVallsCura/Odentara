// Avisa cuando el `?v=` de un index.html quedó viejo respecto de sus archivos.
//
// El server cachea CSS y JS siete días. Si se edita un archivo y no se bumpea la
// versión, la URL no cambia y el navegador sigue sirviendo la copia vieja de su
// propia caché: el deploy sube bien, Passenger reinicia bien, y el usuario ve
// exactamente lo mismo que antes. Es un fallo silencioso y caro de diagnosticar,
// porque todo lo verificable del lado del servidor da correcto.
//
// La comprobación no necesita red: si un archivo referenciado con `?v=` tiene
// fecha de modificación posterior a su index.html, se editó después del bump.
//
// Se leen las rutas del propio HTML en vez de recorrer carpetas fijas. Recorrer
// `js/` y `css/` dejaba afuera `app.js` y `xlsx.full.min.js`, que están en la
// raíz — justo el archivo más grande del frontend quedaba sin vigilar. Partir
// del HTML cubre lo que realmente se sirve, esté donde esté, y sigue cubriendo
// lo que se agregue mañana sin tocar este script.
//
// Uso: node scripts/check-asset-version.js   (o `npm run check:assets`)

const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");

// Dos paquetes independientes, cada uno con su propio ?v= en su propio
// index.html. Se revisan por separado porque bumpear el de la app no impide que
// la landing siga sirviendo su CSS viejo, y al revés igual.
const PAQUETES = [
  { nombre: "app", index: path.join(RAIZ, "index.html"), base: RAIZ },
  { nombre: "landing", index: path.join(RAIZ, "landing", "index.html"), base: path.join(RAIZ, "landing") },
];

const REFERENCIA = /(?:src|href)="([^"]+)\?v=([0-9]+[a-z]?)"/g;

/**
 * Resuelve la ruta del HTML a un archivo en disco. Una ruta con barra inicial es
 * absoluta respecto de lo que sirve el servidor —la raíz del proyecto—, no del
 * sistema de archivos; una relativa cuelga de la carpeta del propio index.
 */
function rutaEnDisco(ref, base) {
  if (/^https?:\/\//i.test(ref)) return null; // externo: no es nuestro
  return ref.startsWith("/") ? path.join(RAIZ, ref.slice(1)) : path.join(base, ref);
}

function revisarPaquete({ nombre, index, base }) {
  if (!fs.existsSync(index)) {
    console.error(`[${nombre}] no se encontró ${path.relative(RAIZ, index)}`);
    return false;
  }

  const html = fs.readFileSync(index, "utf8");
  const mtimeIndex = fs.statSync(index).mtimeMs;

  const versiones = new Set();
  const desactualizados = [];
  const faltantes = [];

  for (const [, ref, version] of html.matchAll(REFERENCIA)) {
    versiones.add(version);

    const archivo = rutaEnDisco(ref, base);
    if (!archivo) continue;

    if (!fs.existsSync(archivo)) {
      faltantes.push(ref);
      continue;
    }

    // Un segundo de tolerancia: guardar el index y un .js casi a la vez no es un
    // olvido, y los sistemas de archivos redondean distinto.
    if (fs.statSync(archivo).mtimeMs > mtimeIndex + 1000) {
      desactualizados.push({ ref, version });
    }
  }

  console.log(`[${nombre}] versiones referenciadas: ${[...versiones].sort().join(", ") || "(ninguna)"}`);

  if (faltantes.length > 0) {
    console.error(`[${nombre}] referencia archivos que no existen: ${faltantes.join(", ")}`);
  }

  if (desactualizados.length === 0 && faltantes.length === 0) {
    console.log(`[${nombre}] OK — sin archivos editados después del bump.`);
    return true;
  }

  if (desactualizados.length > 0) {
    console.error("");
    console.error(
      `[${nombre}] ATENCIÓN: ${desactualizados.length} archivo(s) modificados DESPUÉS de su index.html.`
    );
    console.error("El navegador los va a servir de su caché y el deploy no se va a notar.");
    console.error("");
    for (const d of desactualizados.slice(0, 20)) console.error(`   ${d.ref}  (?v=${d.version})`);
    if (desactualizados.length > 20) console.error(`   … y ${desactualizados.length - 20} más`);
    console.error("");
    console.error(`   → bumpeá la letra final del ?v= en ${path.relative(RAIZ, index)}`);
    console.error("");
  }

  return false;
}

function main() {
  const ok = PAQUETES.map(revisarPaquete).every(Boolean);
  if (!ok) process.exitCode = 1;
}

main();
