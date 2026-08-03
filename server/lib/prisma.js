const { createPrismaClient } = require("./prisma-client");
const { attachAuditLogging } = require("./audit-log-extension");

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || attachAuditLogging(createPrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
