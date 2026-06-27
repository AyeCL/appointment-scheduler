import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const run = promisify(execFile);

const DATABASE_NAME = "vironix_appointment_scheduler";
const localUser =
  process.env.PGUSER ?? process.env.USER ?? process.env.LOGNAME ?? os.userInfo().username;
const DEFAULT_DATABASE_URL = `postgresql://${encodeURIComponent(
  localUser,
)}@localhost:5432/${DATABASE_NAME}`;

async function requireCommand(command: string) {
  try {
    await run(command, ["--version"]);
  } catch {
    throw new Error(
      `Missing required command "${command}". Install and start native Postgres before running this setup.`,
    );
  }
}

async function databaseExists() {
  try {
    const { stdout } = await run("psql", [
      "-d",
      "postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname = '${DATABASE_NAME}'`,
    ]);

    return stdout.trim() === "1";
  } catch (error) {
    throw new Error(
      `Could not connect to local Postgres with psql. Is Postgres running? ${String(error)}`,
    );
  }
}

async function createDatabase() {
  await run("createdb", [DATABASE_NAME]);
}

async function main() {
  await requireCommand("psql");
  await requireCommand("createdb");

  if (await databaseExists()) {
    console.log(`Database "${DATABASE_NAME}" already exists. No changes made.`);
  } else {
    await createDatabase();
    console.log(`Created local database "${DATABASE_NAME}".`);
  }

  console.log(`DATABASE_URL=${process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
