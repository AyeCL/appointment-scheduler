import "dotenv/config";
import os from "node:os";
import { defineConfig } from "prisma/config";

const localUser =
  process.env.PGUSER ?? process.env.USER ?? process.env.LOGNAME ?? os.userInfo().username;
const localDatabaseUrl = `postgresql://${encodeURIComponent(
  localUser,
)}@localhost:5432/vironix_appointment_scheduler`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
