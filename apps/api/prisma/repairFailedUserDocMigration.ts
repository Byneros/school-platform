import { spawnSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

const migrationName = "20260727175234_add_user_doc_fields";

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE migration_name = $1
        AND failed_at IS NOT NULL
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
      LIMIT 1
    `,
    migrationName
  );

  if (rows.length > 0) {
    console.warn(`Resolving failed migration as rolled back: ${migrationName}`);
    const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    const result = spawnSync(
      npxCommand,
      ["prisma", "migrate", "resolve", "--rolled-back", migrationName],
      { stdio: "inherit" }
    );

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
} catch (error) {
  console.warn("Migration repair check skipped:", error instanceof Error ? error.message : error);
} finally {
  await prisma.$disconnect();
}
