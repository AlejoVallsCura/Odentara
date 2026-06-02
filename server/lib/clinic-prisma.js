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

// clinicId (number) → PrismaClient
const clientCache = new Map();

async function getClinicPrisma(clinicId) {
  if (!clinicId) return mainPrisma;

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
  const dedicatedClient = createPrismaClient(clinic.databaseUrl);
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
