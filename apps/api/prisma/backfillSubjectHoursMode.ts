import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teachers = await prisma.teacher.findMany({
    select: { id: true, subjects: true, subjectHoursMode: true }
  });

  for (const teacher of teachers) {
    const subjects = Array.isArray(teacher.subjects)
      ? teacher.subjects.map((s) => String(s))
      : [];
    const current = (teacher.subjectHoursMode && typeof teacher.subjectHoursMode === "object"
      ? (teacher.subjectHoursMode as Record<string, boolean>)
      : {}) as Record<string, boolean>;

    const next: Record<string, boolean> = { ...current };
    let changed = false;
    for (const subject of subjects) {
      if (next[subject] === undefined) {
        next[subject] = true;
        changed = true;
      }
    }

    if (changed) {
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { subjectHoursMode: next }
      });
    }
  }
}

main()
  .catch((e) => {
    console.error("Backfill error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
