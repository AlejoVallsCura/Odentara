const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

function buildMariaDbAdapter(databaseUrl) {
  const url = databaseUrl || String(process.env.DATABASE_URL || "").trim();

  if (!url) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const parsedUrl = new URL(url);
  const database = parsedUrl.pathname.replace(/^\//, "");

  if (!database) {
    throw new Error("La URL de base de datos no incluye el nombre de la base de datos.");
  }

  return new PrismaMariaDb({
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database,
  });
}

function createPrismaClient(databaseUrl) {
  return new PrismaClient({
    adapter: buildMariaDbAdapter(databaseUrl),
    log: ["warn", "error"],
  });
}

module.exports = { createPrismaClient };
