/**
 * Saneo de URLs para logs y auditoría.
 *
 * Vive en su propio módulo, separado de security-logger.js, porque ese importa
 * el cliente de Prisma y por lo tanto exige DATABASE_URL: sin esta separación
 * la función no se podría testear sin levantar una base.
 */

/**
 * Devuelve la ruta con los VALORES de la query string redactados.
 *
 * Los tokens de acceso a archivos clínicos viajan en la URL porque son
 * descargas por navegación del navegador, que no admiten un header de
 * autorización. Eso hace que req.originalUrl pueda contener un credencial
 * vigente: sin esta función quedaba escrito en texto plano en la tabla
 * securityEvent, que es el último lugar donde debería poder leerse un token.
 *
 * Se redactan TODOS los valores y no solo los de una lista de nombres
 * conocidos: así un parámetro sensible que se agregue más adelante queda
 * cubierto sin que nadie tenga que acordarse de sumarlo acá. Las claves se
 * conservan porque saber qué parámetros venían sí aporta a la auditoría.
 *
 * @param {{ originalUrl?: string, path?: string }} req
 * @returns {string}
 */
function sanitizePath(req) {
  const raw = req?.originalUrl || req?.path || "";
  const queryStart = raw.indexOf("?");
  if (queryStart === -1) return raw;

  const pathname = raw.slice(0, queryStart);

  const keys = [];
  for (const key of new URLSearchParams(raw.slice(queryStart + 1)).keys()) {
    if (!keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) return pathname;

  return `${pathname}?${keys.map((key) => `${key}=[REDACTED]`).join("&")}`;
}

module.exports = { sanitizePath };
