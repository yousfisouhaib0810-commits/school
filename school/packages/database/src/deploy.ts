import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const INITIAL_MIGRATION_NAME = "20260531000000_initial_schema";
const PRISMA_SCHEMA_PATH = "prisma/schema.prisma";

function runPrisma(args: string[]): void {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(`Prisma command failed: prisma ${args.join(" ")}`);
  }
}

function runPrismaForStatus(args: string[]): number {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  return result.status ?? 1;
}

async function hasAppliedMigrations(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_prisma_migrations'
  `;

  if (rows[0]?.count === 0n) {
    return false;
  }

  const migrations = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "_prisma_migrations"
  `;

  return (migrations[0]?.count ?? 0n) > 0n;
}

async function hasExistingSchema(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
  `;

  return (rows[0]?.count ?? 0n) > 0n;
}

async function ensureMigrationBaseline(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database deployment.");
  }

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();

    if (await hasAppliedMigrations(prisma)) {
      return;
    }

    if (!(await hasExistingSchema(prisma))) {
      return;
    }
  } finally {
    await prisma.$disconnect();
  }

  const driftStatus = runPrismaForStatus([
    "migrate",
    "diff",
    "--from-url",
    databaseUrl,
    "--to-schema-datamodel",
    PRISMA_SCHEMA_PATH,
    "--exit-code",
  ]);

  if (driftStatus !== 0) {
    throw new Error("Existing database schema differs from Prisma schema; refusing to baseline migrations automatically.");
  }

  runPrisma(["migrate", "resolve", "--applied", INITIAL_MIGRATION_NAME, "--schema", PRISMA_SCHEMA_PATH]);
}

async function main(): Promise<void> {
  await ensureMigrationBaseline();
  runPrisma(["migrate", "deploy", "--schema", PRISMA_SCHEMA_PATH]);
  runPrisma(["db", "execute", "--file", "prisma/rls.sql", "--schema", PRISMA_SCHEMA_PATH]);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Database deployment failed";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
