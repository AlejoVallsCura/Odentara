/**
 * Guard de permisos como middleware.
 *
 * Reemplaza el bloque que estaba repetido 35 veces en las rutas:
 *
 *   if (!canX(req.permissions)) {
 *     return res.status(403).json({ ok: false, error: "No tenes permisos ..." });
 *   }
 *
 * El mensaje sigue siendo explícito en cada ruta a propósito: "No tenes
 * permisos para ver recetas" le dice al usuario qué intentó hacer, y un mensaje
 * genérico sería una regresión de UX a cambio de nada.
 *
 * Se usa DESPUÉS de requireAuth, que es quien completa req.permissions.
 */

/**
 * @param {(permissions: object) => boolean} check
 * @param {string} mensaje Qué acción se estaba intentando, en la voz del error.
 */
function requirePermission(check, mensaje) {
  return function permissionGuard(req, res, next) {
    if (!check(req.permissions)) {
      return res.status(403).json({ ok: false, error: mensaje });
    }
    return next();
  };
}

/**
 * Igual que requirePermission pero alcanza con que UNA de las condiciones pase.
 * Existe para casos como presupuestos, que puede ver tanto quien maneja datos
 * clínicos como quien maneja facturación.
 *
 * @param {((permissions: object) => boolean)[]} checks
 * @param {string} mensaje
 */
function requireAnyPermission(checks, mensaje) {
  return function anyPermissionGuard(req, res, next) {
    if (!checks.some((check) => check(req.permissions))) {
      return res.status(403).json({ ok: false, error: mensaje });
    }
    return next();
  };
}

module.exports = { requirePermission, requireAnyPermission };
