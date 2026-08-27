/**
 * Retorna el cliente Prisma correcto para cada clínica.
 *
 * - Si la clínica usa DB compartida (dbType = 'shared' o no tiene databaseUrl):
 *   → retorna el cliente principal (DATABASE_URL del entorno)
 *
 * - Si la clínica usa DB dedicada (dbType = 'dedicated' con databaseUrl):
 *   → crea (y cachea) un cliente Prisma apuntando a esa DB
 *
 * El cache persiste durante la vida del proceso para reutilizar conexiones.
 */

const mainPrisma = require("./prisma");
const { createPrismaClient } = require("./prisma-client");
const { attachAuditLogging } = require("./audit-log-extension");

// clinicId (number) → PrismaClient
const clientCache = new Map();

// Las bases dedicadas están DESHABILITADAS a propósito.
//
// El código las contempla, pero no existe un plano de control que las sostenga:
// requireAuth resuelve identidad, clínica, roles y permisos contra la base
// principal, y después las rutas consultan Clinic, User y Role dentro de la base
// dedicada, donde esas filas pueden no existir o tener otros ids. Tampoco hay un
// proceso que cree, migre y mantenga sincronizadas esas bases: la creación de
// clínica solo provisiona la principal.
//
// Hoy todas las clínicas comparten la base, así que esto no cambia ningún
// comportamiento actual — evita que alguien active `dbType = "dedicated"` desde
// el panel y se encuentre con fallos de clave foránea, límites de plan vacíos y
// datos cruzados. Para rehabilitarlo hay que diseñar la separación entre plano
// de control y plano por clínica, no solo borrar esta constante.
const BASES_DEDICADAS_HABILITADAS = false;

async function getClinicPrisma(clinicId) {
  if (!clinicId) return mainPrisma;
  if (!BASES_DEDICADAS_HABILITADAS) return mainPrisma;

  // Si ya está en cache, devolverlo directamente
  if (clientCache.has(clinicId)) {
    return clientCache.get(clinicId);
  }

  // Consultar la DB principal para saber si esta clínica tiene DB dedicada
  const clinic = await mainPrisma.clinic.findUnique({
    where: { id: clinicId },
    select: { dbType: true, databaseUrl: true },
  });

  if (!clinic || clinic.dbType !== "dedicated" || !clinic.databaseUrl) {
    // Compartida o sin configurar → usar DB principal
    clientCache.set(clinicId, mainPrisma);
    return mainPrisma;
  }

  // Crear cliente dedicado y cachearlo
  const dedicatedClient = attachAuditLogging(createPrismaClient(clinic.databaseUrl));
  clientCache.set(clinicId, dedicatedClient);
  return dedicatedClient;
}

function invalidateClinicPrisma(clinicId) {
  if (clientCache.has(clinicId)) {
    const client = clientCache.get(clinicId);
    // Desconectar el cliente dedicado si no es el principal
    if (client !== mainPrisma) {
      client.$disconnect().catch(() => {});
    }
    clientCache.delete(clinicId);
  }
}

module.exports = { getClinicPrisma, invalidateClinicPrisma };
