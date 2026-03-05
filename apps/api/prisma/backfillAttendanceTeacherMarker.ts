import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TeacherSlot = {
  teacherId: string;
  dayOfWeek: string;
  gradeLevel: string;
  group: string;
};

function normalizeDayOfWeek(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeGrade(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeGroup(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function dayOfWeekInSpanishUpper(date: Date, timeZone = "America/Bogota") {
  const raw = new Intl.DateTimeFormat("es-CO", { weekday: "long", timeZone }).format(date);
  const normalized = normalizeDayOfWeek(raw);
  const map: Record<string, string> = {
    DOMINGO: "DOMINGO",
    LUNES: "LUNES",
    MARTES: "MARTES",
    MIERCOLES: "MIERCOLES",
    JUEVES: "JUEVES",
    VIERNES: "VIERNES",
    SABADO: "SABADO"
  };
  return map[normalized] || normalized;
}

function teacherMarker(teacherId: string) {
  return `[[teacherId:${teacherId}]]`;
}

function extractRecordedTeacherId(notes: unknown) {
  const text = String(notes || "");
  const match = text.match(/\[\[teacherId:([^\]]+)\]\]/);
  return match?.[1] ? String(match[1]).trim() : "";
}

function stripTeacherMarker(notes?: string | null) {
  const text = String(notes || "");
  return text.replace(/\[\[teacherId:[^\]]+\]\]\s*/g, "").trim();
}

function composeAttendanceNotes(teacherId: string, notes?: string | null) {
  const clean = stripTeacherMarker(notes);
  const marker = teacherMarker(teacherId);
  return clean ? `${marker}\n${clean}` : marker;
}

function normalizeTeacherSlots(teacherId: string, rawSchedules: unknown) {
  const schedulesMap =
    rawSchedules && typeof rawSchedules === "object" ? (rawSchedules as Record<string, unknown>) : {};
  const slots: TeacherSlot[] = [];

  Object.values(schedulesMap).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((slot: any) => {
        const gradeLevel = normalizeGrade(slot?.gradeLevel);
        if (!gradeLevel) return;
        slots.push({
          teacherId,
          dayOfWeek: normalizeDayOfWeek(slot?.dayOfWeek),
          gradeLevel,
          group: normalizeGroup(slot?.group)
        });
      });
      return;
    }
    if (entry && typeof entry === "object") {
      const gradeLevel = normalizeGrade((entry as any)?.gradeLevel);
      if (!gradeLevel) return;
      slots.push({
        teacherId,
        dayOfWeek: normalizeDayOfWeek((entry as any)?.dayOfWeek),
        gradeLevel,
        group: normalizeGroup((entry as any)?.group)
      });
    }
  });

  return slots.filter((s) => s.dayOfWeek && s.gradeLevel);
}

async function main() {
  const teachers = await prisma.teacher.findMany({
    select: { id: true, subjectSchedules: true }
  });

  const allSlots = teachers.flatMap((t) => normalizeTeacherSlots(t.id, t.subjectSchedules));

  const attendance = await prisma.attendance.findMany({
    include: {
      enrollment: {
        include: {
          class: true,
          student: { select: { studentGroup: true } }
        }
      }
    }
  });

  let updated = 0;
  let unchanged = 0;
  let ambiguous = 0;
  let noMatch = 0;

  for (const row of attendance) {
    const grade = normalizeGrade((row.enrollment as any)?.class?.gradeLevel);
    const group = normalizeGroup((row.enrollment as any)?.student?.studentGroup);
    const day = dayOfWeekInSpanishUpper(new Date(row.date));

    const dayGradeSlots = allSlots.filter((s) => s.dayOfWeek === day && s.gradeLevel === grade);
    if (dayGradeSlots.length === 0) {
      noMatch += 1;
      continue;
    }

    const exactTeachers = Array.from(
      new Set(
        dayGradeSlots
          .filter((s) => s.group && s.group !== "-" && s.group === group)
          .map((s) => s.teacherId)
      )
    );
    const genericTeachers = Array.from(
      new Set(
        dayGradeSlots
          .filter((s) => !s.group || s.group === "-")
          .map((s) => s.teacherId)
      )
    );

    let inferredTeacherId = "";
    if (exactTeachers.length === 1) inferredTeacherId = exactTeachers[0];
    else if (exactTeachers.length > 1) {
      ambiguous += 1;
      continue;
    } else if (genericTeachers.length === 1) inferredTeacherId = genericTeachers[0];
    else if (genericTeachers.length > 1) {
      ambiguous += 1;
      continue;
    } else {
      noMatch += 1;
      continue;
    }

    const currentTeacherId = extractRecordedTeacherId(row.notes);
    if (currentTeacherId === inferredTeacherId) {
      unchanged += 1;
      continue;
    }

    await prisma.attendance.update({
      where: { id: row.id },
      data: { notes: composeAttendanceNotes(inferredTeacherId, row.notes) }
    });
    updated += 1;
  }

  console.log(`Asistencias evaluadas: ${attendance.length}`);
  console.log(`Actualizadas: ${updated}`);
  console.log(`Sin cambios: ${unchanged}`);
  console.log(`Sin coincidencia: ${noMatch}`);
  console.log(`Ambiguas: ${ambiguous}`);
}

main()
  .catch((error) => {
    console.error("Error en backfill de asistencia-docente:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

