import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Slot = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  gradeLevel: string;
  group: string;
};

const DAYS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];

function isScheduleEmpty(raw: unknown) {
  if (!raw || typeof raw !== "object") return true;
  const map = raw as Record<string, unknown>;
  const entries = Object.values(map);
  if (!entries.length) return true;
  return entries.every((value) => {
    if (Array.isArray(value)) return value.length === 0;
    if (value && typeof value === "object") return false;
    return true;
  });
}

function toHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function buildSlots(subjects: string[], gradeLevels: string[]) {
  const safeGrades = gradeLevels.length ? gradeLevels : ["PRIMERO"];
  const schedules: Record<string, Slot[]> = {};
  const hours: Record<string, number> = {};
  const modes: Record<string, boolean> = {};

  subjects.forEach((subject, idx) => {
    const day = DAYS[idx % DAYS.length];
    const hourStart = 7 + Math.floor(idx / DAYS.length);
    const startTime = toHour(hourStart);
    const endTime = toHour(hourStart + 1);
    const gradeLevel = safeGrades[idx % safeGrades.length];

    schedules[subject] = [
      {
        dayOfWeek: day,
        startTime,
        endTime,
        gradeLevel,
        group: "A",
      },
    ];
    hours[subject] = 1;
    modes[subject] = true;
  });

  return { schedules, hours, modes };
}

async function main() {
  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { fullName: true, email: true } },
      classes: { select: { gradeLevel: true } },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const teacher of teachers) {
    if (!isScheduleEmpty(teacher.subjectSchedules)) {
      skipped += 1;
      continue;
    }

    const subjects = Array.isArray(teacher.subjects)
      ? teacher.subjects.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const safeSubjects = subjects.length ? subjects : ["General"];
    const gradeLevels = Array.from(
      new Set(teacher.classes.map((c) => String(c.gradeLevel || "")).filter(Boolean))
    );
    const { schedules, hours, modes } = buildSlots(safeSubjects, gradeLevels);

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        subjects: safeSubjects as any,
        subjectSchedules: schedules as any,
        subjectHours: hours as any,
        subjectHoursMode: modes as any,
      },
    });

    updated += 1;
    console.log(`Horario generado para: ${teacher.user.fullName} <${teacher.user.email}>`);
  }

  console.log(`Docentes actualizados: ${updated}`);
  console.log(`Docentes omitidos (ya tenian horario): ${skipped}`);
}

main()
  .catch((error) => {
    console.error("Error al generar horarios:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
