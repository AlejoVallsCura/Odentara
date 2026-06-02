/**
 * Middleware de resolución de subdominio.
 * Detecta el slug de la clínica desde el hostname y lo adjunta a req.
 *
 * Producción:  clinicatomate.odentara.com  →  req.clinicSlug = 'clinicatomate'
 * Desarrollo:  clinicatomate.localhost      →  req.clinicSlug = 'clinicatomate'
 * Platform:    odentara.com / localhost     →  req.clinicSlug = null
 */

const PLATFORM_HOSTNAMES = new Set(['odentara.com', 'www.odentara.com', 'localhost', '127.0.0.1']);
const PLATFORM_SUBDOMAINS = new Set(['www', 'admin', 'platform', 'api', 'app']);

function extractClinicSlug(hostname = '') {
  // Quitar puerto
  const host = hostname.split(':')[0].toLowerCase();

  if (PLATFORM_HOSTNAMES.has(host)) return null;

  const parts = host.split('.');

  // *.odentara.com  →  parts = ['clinicatomate', 'odentara', 'com']
  // *.localhost      →  parts = ['clinicatomate', 'localhost']
  if (parts.length >= 2) {
    const sub = parts[0];
    if (!PLATFORM_SUBDOMAINS.has(sub)) return sub;
  }

  return null;
}

module.exports = function clinicResolver(req, _res, next) {
  req.clinicSlug = extractClinicSlug(req.hostname || req.headers.host || '');
  next();
};
