import "server-only";

import { userInfo } from "node:os";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const localDatabaseUser = encodeURIComponent(
  process.env.PGUSER ??
    process.env.USER ??
    process.env.LOGNAME ??
    userInfo().username,
);
const localDatabaseUrl = `postgresql://${localDatabaseUser}@localhost:5432/vironix_appointment_scheduler`;

const globalForPrisma = globalThis as unknown as {
  vironixPrisma?: PrismaClient;
};

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
  }

  return localDatabaseUrl;
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(),
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export function getPrismaClient() {
  if (!globalForPrisma.vironixPrisma) {
    globalForPrisma.vironixPrisma = createPrismaClient();
  }

  return globalForPrisma.vironixPrisma;
}
