// Contexto de auditoría por-request, propagado vía AsyncLocalStorage para que
// el Prisma extension (audit-log-extension.js) sepa quién hizo cada operación
// sin tener que pasar el usuario manualmente por cada función/servicio.

"use strict";

const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function runWithAuditContext(context, fn) {
  return storage.run(context, fn);
}

function getAuditContext() {
  return storage.getStore() || null;
}

module.exports = {
  runWithAuditContext,
  getAuditContext,
};
