import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createAttendanceBulkSchema, createAttendanceSchema } from "../schemas/attendance.js";

const router = Router();

function normalizeDayOfWeek(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeGradeGroup(gradeLevelRaw: unknown, groupRaw: unknown) {
  const gradeRaw = String(gradeLevelRaw || "")
    .trim()
    .toUpperCase();
  const groupValue = String(groupRaw || "").trim();
  if (gradeRaw.includes("-") && !groupValue) {
    const [grade, ...rest] = gradeRaw
      .split("-")
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      gradeLevel: grade || "",
      group: rest.join("-") || "",
    };
  }
  return {
    gradeLevel: gradeRaw,
    group: groupValue,
  };
}

function normalizeTeacherSlots(rawSchedules: unknown) {
  const schedulesMap =
    rawSchedules && typeof rawSchedules === "object"
      ? (rawSchedules as Record<string, unknown>)
      : {};
  const slots: Array<{ dayOfWeek: string; gradeLevel: string; group: string }> = [];

  Object.values(schedulesMap).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((slot: any) => {
        const normalized = normalizeGradeGroup(slot?.gradeLevel, slot?.group);
        slots.push({
          dayOfWeek: normalizeDayOfWeek(slot?.dayOfWeek),
          gradeLevel: normalized.gradeLevel,
          group: String(normalized.group || "")
            .trim()
            .toUpperCase(),
        });
      });
      return;
    }
    if (entry && typeof entry === "object") {
      const normalized = normalizeGradeGroup((entry as any)?.gradeLevel, (entry as any)?.group);
      slots.push({
        dayOfWeek: normalizeDayOfWeek((entry as any)?.dayOfWeek),
        gradeLevel: normalized.gradeLevel,
        group: String(normalized.group || "")
          .trim()
          .toUpperCase(),
      });
    }
  });

  return slots.filter((s) => s.dayOfWeek && s.gradeLevel);
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

function teacherMarker(teacherId: string) {
  return `[[teacherId:${teacherId}]]`;
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

function parseAttendanceDateParts(input: string) {
  const source = String(input || "").trim();
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new Error("Fecha de asistencia invalida");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error("Fecha de asistencia invalida");
  }

  // Mediodia UTC evita que la zona horaria desplace el dia de la semana.
  const referenceDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const attendanceDate = new Date(Date.UTC(year, month - 1, day));
  return { referenceDate, attendanceDate };
}

async function resolveTeacherByUser(userId: string, schoolId: string | null) {
  if (!schoolId) throw new Error("School context not found.");
  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId },
    select: { id: true, schoolId: true, subjectSchedules: true },
  });
  if (!teacher) throw new Error("Docente no encontrado");
  return teacher;
}

async function upsertAttendanceForTeacher(
  teacher: { id: string; schoolId: string | null; subjectSchedules: unknown },
  payload: {
    enrollmentId: string;
    date: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
    notes?: string;
  }
) {
  const slots = normalizeTeacherSlots(teacher.subjectSchedules);
  const { referenceDate, attendanceDate } = parseAttendanceDateParts(payload.date);
  const requestedDate = referenceDate;
  const requestedDay = dayOfWeekInSpanishUpper(requestedDate);
  if (requestedDay === "DOMINGO") {
    throw new Error("No se permite registrar asistencia en domingo");
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: payload.enrollmentId,
      schoolId: teacher.schoolId,
      class: { teacherId: teacher.id },
    },
    include: { class: true, student: { select: { studentGroup: true } } },
  });
  if (!enrollment) throw new Error("Matricula no encontrada");

  if (slots.length > 0) {
    const grade = String((enrollment.class as any).gradeLevel || "")
      .trim()
      .toUpperCase();
    const enrollmentGroup = String((enrollment as any)?.student?.studentGroup || "")
      .trim()
      .toUpperCase();
    const allowed = slots.some((s) => {
      if (s.dayOfWeek !== requestedDay) return false;
      if (s.gradeLevel !== grade) return false;
      if (!s.group || s.group === "-") return true;
      return s.group === enrollmentGroup;
    });
    if (!allowed) {
      throw new Error(
        `No tienes franja horaria registrada para ${grade}${enrollmentGroup ? `-${enrollmentGroup}` : ""} el dia ${requestedDay}`
      );
    }
  }

  const nextDay = new Date(attendanceDate);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  await prisma.attendance.deleteMany({
    where: {
      enrollmentId: payload.enrollmentId,
      date: { gte: attendanceDate, lt: nextDay, not: attendanceDate },
    },
  });

  const existing = await prisma.attendance.findFirst({
    where: {
      enrollmentId: payload.enrollmentId,
      date: attendanceDate,
    },
    select: { id: true, notes: true },
  });

  const attendance = existing
    ? await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: payload.status,
          notes: composeAttendanceNotes(teacher.id, payload.notes ?? existing.notes),
        },
      })
    : await prisma.attendance.create({
        data: {
          enrollmentId: payload.enrollmentId,
          date: attendanceDate,
          status: payload.status,
          notes: composeAttendanceNotes(teacher.id, payload.notes),
        },
      });
  return attendance;
}

router.post(
  "/",
  requireAuth,
  requireRole(["TEACHER"]),
  validate(createAttendanceSchema),
  async (req, res) => {
    const { body } = (req as any).validated;
    const auth = (req as any).auth;

    try {
      const teacher = await resolveTeacherByUser(auth.userId, auth.schoolId);
      const attendance = await upsertAttendanceForTeacher(teacher, body);
      res.json(attendance);
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message === "School context not found.") return res.status(403).json({ message });
      if (message === "Docente no encontrado") return res.status(404).json({ message });
      if (message === "Matricula no encontrada") return res.status(404).json({ message });
      if (message.includes("No tienes franja horaria")) return res.status(403).json({ message });
      if (message.includes("No se permite registrar asistencia en domingo"))
        return res.status(403).json({ message });
      return res.status(400).json({ message: message || "No fue posible registrar la asistencia" });
    }
  }
);

router.post(
  "/bulk",
  requireAuth,
  requireRole(["TEACHER"]),
  validate(createAttendanceBulkSchema),
  async (req, res) => {
    const { body } = (req as any).validated as {
      body: {
        items: Array<{
          enrollmentId: string;
          date: string;
          status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
          notes?: string;
        }>;
      };
    };
    const auth = (req as any).auth;

    try {
      const teacher = await resolveTeacherByUser(auth.userId, auth.schoolId);
      const results: Array<{ enrollmentId: string; ok: boolean; error?: string }> = [];

      for (const item of body.items) {
        try {
          await upsertAttendanceForTeacher(teacher, item);
          results.push({ enrollmentId: item.enrollmentId, ok: true });
        } catch (error: any) {
          results.push({
            enrollmentId: item.enrollmentId,
            ok: false,
            error: String(error?.message || "No fue posible registrar la asistencia"),
          });
        }
      }

      const okCount = results.filter((r) => r.ok).length;
      const failedCount = results.length - okCount;
      return res.status(failedCount > 0 ? 207 : 200).json({
        summary: { total: results.length, ok: okCount, failed: failedCount },
        results,
      });
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message === "School context not found.") return res.status(403).json({ message });
      if (message === "Docente no encontrado") return res.status(404).json({ message });
      if (message.includes("No se permite registrar asistencia en domingo"))
        return res.status(403).json({ message });
      return res
        .status(400)
        .json({ message: message || "No fue posible registrar la asistencia masiva" });
    }
  }
);

export default router;
