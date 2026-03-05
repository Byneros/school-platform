import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Idempotent backfill for legacy rows with NULL gradeLevel.
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Class" c
    SET "gradeLevel" = 'PRIMERO'::"GradeLevel"
    WHERE c."gradeLevel" IS NULL
  `);

  console.log(`Class.gradeLevel backfill rows updated: ${Number(result || 0)}`);
}

main()
  .catch((error) => {
    console.error("Error in Class.gradeLevel backfill:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
