// Qué se sirve por HTTP y qué no.
//
// WEB_ROOT es la raíz del repo, así que por defecto TODO lo que quede ahí queda
// publicado. Eso ya expuso en producción `pacientes_test.csv` (30 filas con
// nombre, DNI, teléfono, email y dirección), `ARQUITECTURA.pdf`, `CLAUDE.md`,
// `PLAN-CODEX.md` y `package.json`: los cinco daban 200.
//
// La decisión que importa: los archivos sueltos de la raíz van por LISTA BLANCA.
// Una lista negra hay que acordarse de actualizarla cada vez que alguien deja un
// .md, un .csv o un dump en la carpeta — y ese "acordarse" es exactamente lo que
// falló. Lo que la app necesita de la raíz son cuatro archivos y no cambia.
//
// Vive acá y no dentro de index.js para poder probarlo sin levantar el servidor.

"use strict";

const ARCHIVOS_PUBLICOS_DE_RAIZ = new Set([
  "/",
  "/index.html",
  "/app.js",
  "/sw.js",
  "/manifest.json",
  "/xlsx.full.min.js",
  "/favicon.ico",
  "/favicon.svg",
  "/robots.txt",
]);

// Carpetas que nunca se publican: las de código del servidor más las de
// desarrollo. `scripts/` tiene los de backup y restauración, `docs/` la
// documentación interna, `backups/` datos de pacientes.
const CARPETAS_BLOQUEADAS =
  /^\/(server|prisma|node_modules|scripts|docs|backups|deploy-temp|\.git|\.claude)(\/|$)/i;

/**
 * ¿Hay que devolver 404 para esta ruta?
 *
 * @param {string} ruta          req.path
 * @param {{esLanding?: boolean}} opciones  esLanding = el pedido entró por
 *        odentara.com, donde los estáticos se sirven desde `landing/` y no
 *        desde la raíz del repo.
 *
 * Dos cosas que esto NO bloquea, y las dos costaron caro:
 *
 * 1. Las rutas de Express sin extensión (`/health`, `/terminos`,
 *    `/landing-preview`). La primera versión pedía solo que fuera un segmento de
 *    raíz y las mataba a las tres. Por eso la regla de archivo exige extensión.
 *
 * 2. Los archivos de la landing. En odentara.com, `/odentara.css` y
 *    `/odentara.js` resuelven contra LANDING_ROOT, no contra la raíz del repo:
 *    parecen archivos sueltos de raíz pero no lo son. Aplicarles la lista blanca
 *    dejó la landing sin estilos ni JS en producción. Ahí la lista blanca no
 *    corresponde — `express.static` ya está anclado a `landing/` y no puede
 *    salirse de esa carpeta.
 */
function esRutaBloqueada(ruta, { esLanding = false } = {}) {
  if (CARPETAS_BLOQUEADAS.test(ruta)) return true;

  // Todo lo que empieza con punto: `.env`, `.env.local`, `.gitignore`,
  // `.htaccess`. No cae en la regla de abajo porque `.env` no tiene nombre antes
  // del punto. `.well-known` se deja pasar por si hace falta para un certificado.
  if (ruta.startsWith("/.") && !ruta.startsWith("/.well-known/")) return true;

  // La lista blanca de archivos de raíz solo aplica a la app, que es la que se
  // sirve desde la raíz del repo.
  if (esLanding) return false;

  // Un archivo suelto en la raíz solo pasa si está en la lista blanca. Las
  // subcarpetas permitidas (/js, /css, /icons, /shared, /img, /landing) no
  // entran acá: tienen barra en el medio.
  const esArchivoDeRaiz = /^\/[^/]+\.[a-zA-Z0-9]+$/.test(ruta);
  if (esArchivoDeRaiz && !ARCHIVOS_PUBLICOS_DE_RAIZ.has(ruta)) return true;

  return false;
}

module.exports = { esRutaBloqueada, ARCHIVOS_PUBLICOS_DE_RAIZ, CARPETAS_BLOQUEADAS };
