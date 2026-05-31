import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  for (let index = 0; index < sql.length; index += 1) {
    const pair = sql.slice(index, index + 2);
    if (pair === "$$") {
      inDollarQuote = !inDollarQuote;
      current += pair;
      index += 1;
      continue;
    }

    const char = sql[index];
    if (char === ";" && !inDollarQuote) {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();
  if (finalStatement) {
    statements.push(finalStatement);
  }

  return statements;
}

async function applyRls() {
  const sqlPath = join(process.cwd(), "prisma", "rls.sql");
  const sql = await readFile(sqlPath, "utf8");

  for (const statement of splitSqlStatements(sql)) {
    await prisma.$executeRawUnsafe(statement);
  }

  process.stdout.write("RLS policies applied\n");
}

applyRls()
  .catch((error: unknown) => {
    process.stderr.write(`Failed to apply RLS policies: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
