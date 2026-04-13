const { createPrismaClient } = require("./prisma-client");

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
