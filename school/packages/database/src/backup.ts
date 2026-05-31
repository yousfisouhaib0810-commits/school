import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const DEFAULT_BACKUP_DIR = "backups";

interface PgEnvironment {
  PGHOST: string;
  PGPORT: string;
  PGDATABASE: string;
  PGUSER: string;
  PGPASSWORD?: string;
  PGSSLMODE?: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parsePgEnvironment(databaseUrl: string): PgEnvironment {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
  }

  const sslMode = url.searchParams.get("sslmode") ?? undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const username = decodeURIComponent(url.username);

  if (!databaseName || !username) {
    throw new Error("DATABASE_URL must include a database name and username");
  }

  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: databaseName,
    PGUSER: username,
    ...(password ? { PGPASSWORD: password } : {}),
    ...(sslMode ? { PGSSLMODE: sslMode } : {}),
  };
}

function createBackupFilePath(databaseName: string): string {
  const backupDir = resolve(process.env.BACKUP_DIR ?? DEFAULT_BACKUP_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeDatabaseName = databaseName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return resolve(backupDir, `${safeDatabaseName}-${timestamp}.dump`);
}

async function runPgDump(filePath: string, pgEnvironment: PgEnvironment): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-privileges", "--file", filePath],
      {
        env: {
          ...process.env,
          ...pgEnvironment,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`pg_dump exited with code ${code ?? "unknown"}`));
    });
  });
}

async function main(): Promise<void> {
  const pgEnvironment = parsePgEnvironment(getRequiredEnv("DATABASE_URL"));
  const backupFilePath = createBackupFilePath(pgEnvironment.PGDATABASE);
  await mkdir(resolve(process.env.BACKUP_DIR ?? DEFAULT_BACKUP_DIR), { recursive: true });
  await runPgDump(backupFilePath, pgEnvironment);
  process.stdout.write(`Database backup written to ${backupFilePath}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown backup error";
  process.stderr.write(`Database backup failed: ${message}\n`);
  process.exit(1);
});
