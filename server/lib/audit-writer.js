// Escribe filas de AuditLog SIEMPRE contra la base de datos principal (donde vive
// la tabla AuditLog real), sin importar si la operación que se está auditando
// ocurrió en la DB compartida o en la DB dedicada de una clínica.
//
// Usa un PrismaClient propio, SIN el audit-log-extension aplicado, para evitar
// recursión infinita (loguear el propio INSERT del log).

"use strict";

const { createPrismaClient } = require("./prisma-client");

let writerClient = null;
function getWriterClient() {
  if (!writerClient) {
    writerClient = createPrismaClient();
  }
  return writerClient;
}

// Nunca guardamos hashes de contraseña ni tokens en el JSON de auditoría.
const SENSITIVE_KEYS = ["passwordHash", "token", "refreshToken"];

function sanitize(value) {
  if (!value || typeof value !== "object") return value;
  const clean = { ...value };
  for (const key of SENSITIVE_KEYS) {
    if (key in clean) delete clean[key];
  }
  return clean;
}

/**
 * @param {object} params
 * @param {object|null} params.context - { userId, clinicId, isPlatformAdmin, impersonated } | null
 * @param {string} params.model - nombre del modelo Prisma (entityType)
 * @param {"create"|"update"|"delete"} params.action
 * @param {string|number|null} params.entityId
 * @param {object|null} params.beforeData
 * @param {object|null} params.afterData
 */
async function writeAuditLog({ context, model, action, entityId, beforeData, afterData }) {
  if (!context) return; // sin usuario autenticado (jobs de fondo, scripts) → no auditar
  if (context.isPlatformAdmin) return; // regla: no registrar movimientos del Ultra Admin
  if (context.impersonated) return;    // regla: tampoco mientras el Ultra Admin está impersonando una clínica

  try {
    await getWriterClient().auditLog.create({
      data: {
        userId: context.userId || null,
        clinicId: context.clinicId || null,
        entityType: model,
        entityId: String(entityId ?? "bulk"),
        action,
        beforeData: beforeData ? sanitize(beforeData) : undefined,
        afterData: afterData ? sanitize(afterData) : undefined,
      },
    });
  } catch (_error) {
    // El logging de auditoría nunca debe romper la operación principal.
  }
}

module.exports = { writeAuditLog };
