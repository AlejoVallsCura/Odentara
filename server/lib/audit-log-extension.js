// Prisma Client Extension que audita automáticamente TODAS las escrituras
// (create/update/upsert/delete, en singular y "Many") de cualquier modelo,
// sin tener que acordarse de llamar a un helper manualmente en cada ruta.
//
// El contexto de "quién" hace la operación viaja por AsyncLocalStorage
// (ver audit-context.js), seteado una vez por request en middleware/auth.js.
//
// Convención de la app: un "delete" casi siempre es soft-delete (update
// seteando deletedAt), así que una operación update/updateMany cuyo payload
// setea deletedAt se clasifica como action="delete" para que el filtro de
// auditoría por acción tenga sentido.

"use strict";

const { getAuditContext } = require("./audit-context");
const { writeAuditLog } = require("./audit-writer");

const SINGLE_WRITE_OPS = new Set(["create", "update", "upsert", "delete"]);
const BULK_WRITE_OPS = new Set([
  "createMany", "createManyAndReturn",
  "updateMany", "updateManyAndReturn",
  "deleteMany", "deleteManyAndReturn",
]);

function isSoftDelete(args) {
  const data = args?.data;
  return Boolean(data && typeof data === "object" && "deletedAt" in data && data.deletedAt);
}

function attachAuditLogging(client) {
  return client.$extends({
    name: "audit-logging",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);

          if (model === "AuditLog") return result;
          if (!SINGLE_WRITE_OPS.has(operation) && !BULK_WRITE_OPS.has(operation)) return result;

          const context = getAuditContext();
          if (!context) return result;

          try {
            if (SINGLE_WRITE_OPS.has(operation)) {
              let action = operation === "delete" ? "delete" : "create";
              if (operation === "update" || operation === "upsert") {
                action = isSoftDelete(args) ? "delete" : "update";
              }
              const entityId = result && typeof result === "object" ? result.id : null;
              writeAuditLog({
                context,
                model,
                action,
                entityId,
                beforeData: operation === "delete" ? result : null,
                afterData: operation === "delete" ? null : result,
              });
            } else {
              // createMany / updateMany / deleteMany (y variantes "AndReturn")
              const isCreate = operation.startsWith("createMany");
              const isDelete = operation.startsWith("deleteMany");
              let action = isCreate ? "create" : isDelete ? "delete" : "update";
              if (!isCreate && !isDelete && isSoftDelete(args)) action = "delete";

              const count = Array.isArray(result) ? result.length : result?.count ?? null;
              const summary = { count, where: args?.where || undefined };
              writeAuditLog({
                context,
                model,
                action,
                entityId: "bulk",
                beforeData: isDelete ? summary : null,
                afterData: isDelete ? null : summary,
              });
            }
          } catch (_error) {
            // Nunca dejar que un error de auditoría rompa la operación real.
          }

          return result;
        },
      },
    },
  });
}

module.exports = { attachAuditLogging };
