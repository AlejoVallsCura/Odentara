const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

function getDatabaseUrl() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no esta configurada.");
  }

  return databaseUrl;
}

function buildMariaDbAdapter() {
  const parsedUrl = new URL(getDatabaseUrl());
  const database = parsedUrl.pathname.replace(/^\//, "");

  if (!database) {
    throw new Error("DATABASE_URL no incluye el nombre de la base de datos.");
  }

  return new PrismaMariaDb({
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database,
  });
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: buildMariaDbAdapter(),
    log: ["warn", "error"],
  });
}

module.exports = {
  createPrismaClient,
};
