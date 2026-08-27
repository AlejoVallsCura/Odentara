/**
 * Reglas de quién puede editar a quién en el panel de usuarios de una clínica.
 *
 * Vive separado del handler de Express y sin tocar Prisma para que las reglas se
 * puedan leer y testear de un vistazo. Antes estaban desparramadas dentro del
 * PUT y una de ellas faltaba: alcanzaba con editarse a uno mismo para mandar
 * roles:["admin"] en el body y quedar como administrador de la clínica.
 */

/** Códigos de rol de un usuario tal como viene de Prisma con `roles.role`. */
function codigosDeRol(user) {
  return (user?.roles || []).map((ur) => ur.role?.code).filter(Boolean);
}

/** Compara listas de roles sin importar el orden ni los repetidos. */
function mismosRoles(a, b) {
  const setA = new Set(a || []);
  const setB = new Set(b || []);
  if (setA.size !== setB.size) return false;
  for (const code of setA) if (!setB.has(code)) return false;
  return true;
}

function esSuperadmin(user) {
  return codigosDeRol(user).includes("superadmin");
}

/**
 * Decide si una edición está permitida.
 *
 * @param {object} params
 * @param {string[]} params.rolesDelActor  Roles de quien hace el pedido.
 * @param {string[]} params.rolesActuales  Roles que el usuario objetivo tiene hoy.
 * @param {string[]} params.rolesPedidos   Roles que llegan en el body.
 * @param {boolean}  params.esAutoedicion  El objetivo es el propio actor.
 * @param {boolean}  params.cambiaPassword El body trae contraseña nueva.
 * @returns {{status: number, error: string} | null} null si está permitido.
 */
function evaluarEdicionDeUsuario({
  rolesDelActor = [],
  rolesActuales = [],
  rolesPedidos = [],
  esAutoedicion = false,
  cambiaPassword = false,
}) {
  const esManager = rolesDelActor.some((r) => r === "superadmin" || r === "admin");
  const actorEsSuperadmin = rolesDelActor.includes("superadmin");
  const objetivoEsSuperadmin = rolesActuales.includes("superadmin");
  const cambiaRoles = !mismosRoles(rolesActuales, rolesPedidos);

  if (!esManager && !esAutoedicion) {
    return { status: 403, error: "Solo podés editar tu propio usuario." };
  }

  // Un admin no toca al dueño de la clínica: ni sus roles, ni su contraseña, ni
  // su email. Si pudiera, se quedaría con la clínica.
  if (objetivoEsSuperadmin && !actorEsSuperadmin) {
    return { status: 403, error: "No podés modificar la cuenta del superadmin de la clínica." };
  }

  // Nadie cambia sus propios roles, ni siquiera el superadmin. Es la regla que
  // cierra la escalada, y de paso evita que alguien se quite permisos sin querer
  // y quede afuera de su propia clínica.
  if (cambiaRoles && esAutoedicion) {
    return { status: 403, error: "No podés cambiar tus propios roles. Pedíselo a otro administrador." };
  }

  // El panel no permite ASIGNAR superadmin, así que cualquier cambio de roles
  // sobre un superadmin solo puede quitárselo — incluida la posibilidad de dejar
  // la clínica sin ninguno.
  if (cambiaRoles && objetivoEsSuperadmin) {
    return {
      status: 403,
      error: "Los roles del superadmin no se modifican desde este panel. Contactá al administrador de la plataforma.",
    };
  }

  // Cambiar la contraseña de una cuenta es una función administrativa. Quien no
  // administra usuarios no la tiene ni sobre sí mismo: una sesión robada podría
  // usarla para quedarse con la cuenta.
  if (cambiaPassword && !esManager) {
    return {
      status: 400,
      error: "Para cambiar tu contraseña usá la opción de recuperarla desde el login.",
    };
  }

  return null;
}

module.exports = {
  codigosDeRol,
  mismosRoles,
  esSuperadmin,
  evaluarEdicionDeUsuario,
};
