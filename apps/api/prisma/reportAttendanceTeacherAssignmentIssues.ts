import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TeacherSlot = {
  teacherId: string;
  teacherName: string;
  dayOfWeek: string;
  gradeLevel: string;
  group: string;
};

type IssueRow = {
  attendanceId: string;
  date: string;
  dayOfWeek: string;
  gradeLevel: string;
  group: string;
  student: string;
  classTeacher: string;
  issueType: "NO_MATCH" | "AMBIGUOUS";
  candidateTeacherNames: string;
};

function normalizeDayOfWeek(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeGrade(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeGroup(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
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
    SABADO: "SABADO",
  };
  return map[normalized] || normalized;
}

function normalizeTeacherSlots(teacherId: string, teacherName: string, rawSchedules: unknown) {
  const schedulesMap =
    rawSchedules && typeof rawSchedules === "object"
      ? (rawSchedules as Record<string, unknown>)
      : {};
  const slots: TeacherSlot[] = [];

  Object.values(schedulesMap).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((slot: any) => {
        const gradeLevel = normalizeGrade(slot?.gradeLevel);
        if (!gradeLevel) return;
        slots.push({
          teacherId,
          teacherName,
          dayOfWeek: normalizeDayOfWeek(slot?.dayOfWeek),
          gradeLevel,
          group: normalizeGroup(slot?.group),
        });
      });
      return;
    }
    if (entry && typeof entry === "object") {
      const gradeLevel = normalizeGrade((entry as any)?.gradeLevel);
      if (!gradeLevel) return;
      slots.push({
        teacherId,
        teacherName,
        dayOfWeek: normalizeDayOfWeek((entry as any)?.dayOfWeek),
        gradeLevel,
        group: normalizeGroup((entry as any)?.group),
      });
    }
  });

  return slots.filter((s) => s.dayOfWeek && s.gradeLevel);
}

function toCsv(rows: IssueRow[]) {
  const headers = [
    "attendanceId",
    "date",
    "dayOfWeek",
    "gradeLevel",
    "group",
    "student",
    "classTeacher",
    "issueType",
    "candidateTeacherNames",
  ];
  const escape = (value: string) => `"${String(value || "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        r.attendanceId,
        r.date,
        r.dayOfWeek,
        r.gradeLevel,
        r.group,
        r.student,
        r.classTeacher,
        r.issueType,
        r.candidateTeacherNames,
      ]
        .map(escape)
        .join(",")
    );
  });
  return lines.join("\n");
}

async function main() {
  const teachers = await prisma.teacher.findMany({
    select: {
      id: true,
      subjectSchedules: true,
      user: { select: { fullName: true } },
    },
  });
  const allSlots = teachers.flatMap((t) =>
    normalizeTeacherSlots(t.id, String(t.user?.fullName || ""), t.subjectSchedules)
  );

  const attendance = await prisma.attendance.findMany({
    include: {
      enrollment: {
        include: {
          class: { include: { teacher: { include: { user: { select: { fullName: true } } } } } },
          student: { select: { fullName: true, studentGroup: true } },
        },
      },
    },
  });

  const noMatchRows: IssueRow[] = [];
  const ambiguousRows: IssueRow[] = [];

  attendance.forEach((row) => {
    const date = row.date.toISOString().slice(0, 10);
    const day = dayOfWeekInSpanishUpper(new Date(row.date));
    const grade = normalizeGrade((row.enrollment as any)?.class?.gradeLevel);
    const group = normalizeGroup((row.enrollment as any)?.student?.studentGroup);
    const student = String((row.enrollment as any)?.student?.fullName || "");
    const classTeacher = String((row.enrollment as any)?.class?.teacher?.user?.fullName || "");

    const dayGradeSlots = allSlots.filter((s) => s.dayOfWeek === day && s.gradeLevel === grade);
    const exactTeachers = Array.from(
      new Set(
        dayGradeSlots
          .filter((s) => s.group && s.group !== "-" && s.group === group)
          .map((s) => `${s.teacherId}::${s.teacherName}`)
      )
    );
    const genericTeachers = Array.from(
      new Set(
        dayGradeSlots
          .filter((s) => !s.group || s.group === "-")
          .map((s) => `${s.teacherId}::${s.teacherName}`)
      )
    );
    const candidates = (exactTeachers.length > 0 ? exactTeachers : genericTeachers).map(
      (t) => t.split("::")[1] || ""
    );

    if (dayGradeSlots.length === 0 || candidates.length === 0) {
      noMatchRows.push({
        attendanceId: row.id,
        date,
        dayOfWeek: day,
        gradeLevel: grade,
        group,
        student,
        classTeacher,
        issueType: "NO_MATCH",
        candidateTeacherNames: "",
      });
      return;
    }

    if (candidates.length > 1) {
      ambiguousRows.push({
        attendanceId: row.id,
        date,
        dayOfWeek: day,
        gradeLevel: grade,
        group,
        student,
        classTeacher,
        issueType: "AMBIGUOUS",
        candidateTeacherNames: candidates.join(" | "),
      });
    }
  });

  const outDir = path.join(process.cwd(), "prisma", "reports");
  await fs.mkdir(outDir, { recursive: true });

  const noMatchCsvPath = path.join(outDir, "attendance-teacher-no-match.csv");
  const ambiguousCsvPath = path.join(outDir, "attendance-teacher-ambiguous.csv");
  const summaryPath = path.join(outDir, "attendance-teacher-issues-summary.json");

  await Promise.all([
    fs.writeFile(noMatchCsvPath, toCsv(noMatchRows), "utf8"),
    fs.writeFile(ambiguousCsvPath, toCsv(ambiguousRows), "utf8"),
    fs.writeFile(
      summaryPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalAttendance: attendance.length,
          noMatch: noMatchRows.length,
          ambiguous: ambiguousRows.length,
          files: {
            noMatchCsv: noMatchCsvPath,
            ambiguousCsv: ambiguousCsvPath,
          },
        },
        null,
        2
      ),
      "utf8"
    ),
  ]);

  console.log(`Reporte generado: ${summaryPath}`);
  console.log(`Sin coincidencia: ${noMatchRows.length} -> ${noMatchCsvPath}`);
  console.log(`Ambiguas: ${ambiguousRows.length} -> ${ambiguousCsvPath}`);
}

main()
  .catch((error) => {
    console.error("Error generando reporte de incidencias de asistencia-docente:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
