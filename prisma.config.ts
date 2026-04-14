import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const projectRoot = process.cwd();
const localEnvPath = path.join(projectRoot, ".env.local");
const defaultEnvPath = path.join(projectRoot, ".env");

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath, override: false });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
