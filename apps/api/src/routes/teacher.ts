import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { buildXlsxReportBuffer, sendTabularPdf } from "../utils/reportExport.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";
import { composeNotificationBodyWithMeta, extractNotificationLegalReference, stripNotificationMeta } from "../utils/notificationMeta.js";
import { enqueueNotification } from "../services/notificationQueue.js";
import PDFDocument from "pdfkit";
import { validate } from "../utils/validate.js";
import { createTaskSchema, deleteTaskSchema, updateTaskSchema, upsertTaskScoreSchema } from "../schemas/tasks.js";

const router = Router();
type SubjectSlot = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  gradeLevel: string;
  group: string;
};

type Interval = {
  subject: string;
  dayOfWeek: string;
  start: number;
  end: number;
  gradeLevel: string;
  group: string;
  startTime: string;
  endTime: string;
};

function normalizeDayOfWeek(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSubjects(raw: unknown) {
  if (!Array.isArray(raw)) return [] as string[];
  return raw.map((s) => String(s).trim()).filter(Boolean);
}

function normalizeGradeGroup(gradeLevelRaw: unknown, groupRaw: unknown) {
  const gradeRaw = String(gradeLevelRaw || "").trim().toUpperCase();
  const groupValue = String(groupRaw || "").trim();
  if (gradeRaw.includes("-") && !groupValue) {
    const [grade, ...rest] = gradeRaw.split("-").map((p) => p.trim()).filter(Boolean);
    return {
      gradeLevel: grade || "",
      group: rest.join("-") || ""
    };
  }
  return {
    gradeLevel: gradeRaw,
    group: groupValue
  };
}

function normalizeGradeKey(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeGroupKey(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSubjectConfigs(subjects: string[], rawHours: unknown, rawSchedules: unknown, rawModes?: unknown) {
  const hoursMap = (rawHours && typeof rawHours === "object" ? rawHours : {}) as Record<string, unknown>;
  const schedulesMap = (rawSchedules && typeof rawSchedules === "object" ? rawSchedules : {}) as Record<string, any>;
  const modesMap = (rawModes && typeof rawModes === "object" ? rawModes : {}) as Record<string, unknown>;
  return subjects.map((subject) => ({
    subject,
    hoursPerWeek: Math.max(0, Number(hoursMap[subject] || 0)),
    autoMode: modesMap[subject] === undefined ? true : Boolean(modesMap[subject]),
    slots: Array.isArray(schedulesMap[subject])
      ? schedulesMap[subject].map((s: any) => ({
          dayOfWeek: String(s?.dayOfWeek || ""),
          startTime: String(s?.startTime || ""),
          endTime: String(s?.endTime || ""),
          gradeLevel: String(s?.gradeLevel || ""),
          group: String(s?.group || "")
        }))
      : schedulesMap[subject] && typeof schedulesMap[subject] === "object"
      ? [
          {
            dayOfWeek: String(schedulesMap[subject]?.dayOfWeek || ""),
            startTime: String(schedulesMap[subject]?.startTime || ""),
            endTime: String(schedulesMap[subject]?.endTime || ""),
            gradeLevel: String(schedulesMap[subject]?.gradeLevel || ""),
            group: String(schedulesMap[subject]?.group || "")
          }
        ]
      : []
  }));
}

function normalizeTeacherSlots(rawSchedules: unknown) {
  const schedulesMap =
    rawSchedules && typeof rawSchedules === "object" ? (rawSchedules as Record<string, unknown>) : {};
  const slots: Array<{ dayOfWeek: string; gradeLevel: string; group: string }> = [];

  Object.values(schedulesMap).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((slot: any) => {
        const normalized = normalizeGradeGroup(slot?.gradeLevel, slot?.group);
        slots.push({
          dayOfWeek: normalizeDayOfWeek(slot?.dayOfWeek),
          gradeLevel: normalized.gradeLevel,
          group: normalized.group
        });
      });
      return;
    }
    if (entry && typeof entry === "object") {
      const normalized = normalizeGradeGroup((entry as any)?.gradeLevel, (entry as any)?.group);
      slots.push({
        dayOfWeek: normalizeDayOfWeek((entry as any)?.dayOfWeek),
        gradeLevel: normalized.gradeLevel,
        group: normalized.group
      });
    }
  });

  return slots.filter((s) => s.dayOfWeek && s.gradeLevel);
}

function dayOfWeekInSpanishUpper(date = new Date(), timeZone = "America/Bogota") {
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

function getEnrollmentGradeLevel(enrollment: any) {
  return String(enrollment?.class?.gradeLevel || "").trim();
}
const gradeLabelsFull: Record<string, string> = {
  PRE_JARDIN: "Pre Jardin",
  JARDIN: "Jardin",
  TRANSICION: "Transicion",
  PRIMERO: "Primero",
  SEGUNDO: "Segundo",
  TERCERO: "Tercero",
  CUARTO: "Cuarto",
  QUINTO: "Quinto",
  SEXTO: "Sexto",
  SEPTIMO: "Septimo",
  OCTAVO: "Octavo",
  NOVENO: "Noveno",
  DECIMO: "Decimo",
  ONCE: "Once"
};

function gradeLabelFull(value: string) {
  return gradeLabelsFull[String(value || "").trim()] || value || "";
}

function parseTaskGroup(value: string) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();
  if (!raw) {
    return { group: "", mode: "any" as const };
  }
  if (upper === "SIN_GRUPO" || upper === "SIN GRUPO" || raw === "-") {
    return { group: "", mode: "empty" as const };
  }
  return { group: raw, mode: "exact" as const };
}

async function resolveTeacherGradeGroups(userId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { subjectSchedules: true }
  });
  if (!teacher) return [];
  const slots = normalizeTeacherSlots(teacher.subjectSchedules);
  const uniquePairs = Array.from(
    new Set(slots.map((s) => `${normalizeGradeKey(s.gradeLevel)}::${normalizeGroupKey(s.group || "")}`))
  ).map((key) => {
    const [gradeLevel, group] = key.split("::");
    return { gradeLevel, group };
  });
  return uniquePairs;
}
const dayLabelShort: Record<string, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miercoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sabado"
};

function toMinutes(hhmm: string) {
  const m = hhmm.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

function toHoursFromSlots(slots: Array<{ dayOfWeek: string; startTime: string; endTime: string }>) {
  const minutes = slots.reduce((sum, slot) => {
    const start = toMinutes(slot.startTime || "");
    const end = toMinutes(slot.endTime || "");
    if (!slot.dayOfWeek || start < 0 || end < 0 || end <= start) return sum;
    return sum + (end - start);
  }, 0);
  return Number((minutes / 60).toFixed(2));
}

function extractRecordedTeacherId(notes: unknown) {
  const text = String(notes || "");
  const match = text.match(/\[\[teacherId:([^\]]+)\]\]/);
  return match?.[1] ? String(match[1]).trim() : "";
}

function parseSubjectSlots(found: any) {
  const rawSlots = Array.isArray(found?.slots)
    ? found.slots
    : found?.dayOfWeek || found?.startTime || found?.endTime
    ? [{ dayOfWeek: found?.dayOfWeek, startTime: found?.startTime, endTime: found?.endTime }]
    : [];

  return rawSlots
    .map((s: any) => ({
      dayOfWeek: String(s?.dayOfWeek || ""),
      startTime: String(s?.startTime || ""),
      endTime: String(s?.endTime || ""),
      gradeLevel: String(s?.gradeLevel || ""),
      group: String(s?.group || "")
    }))
    .filter((s: SubjectSlot) => s.dayOfWeek || s.startTime || s.endTime);
}

function validateSubjectSlots(subject: string, hours: number, slots: SubjectSlot[]) {
  if (hours > 0 && slots.length === 0) {
    return `Debes definir al menos una franja para ${subject}`;
  }

  for (const slot of slots) {
    if (!slot.dayOfWeek || !slot.startTime || !slot.endTime || !slot.gradeLevel || !slot.group) {
      return `Debes completar grado, grupo, dia e inicio/fin para ${subject}`;
    }
    const startMin = toMinutes(slot.startTime);
    const endMin = toMinutes(slot.endTime);
    if (startMin < 0 || endMin < 0 || startMin >= endMin) {
      return `Horario invalido para ${subject}`;
    }
  }

  return "";
}

function buildIntervals(scheduleMap: Record<string, SubjectSlot[]>, hoursMap: Record<string, number>) {
  return Object.entries(scheduleMap)
    .filter(([subject]) => (hoursMap[subject] || 0) > 0)
    .flatMap(([subject, slots]) =>
      slots.map((cfg) => ({
        subject,
        dayOfWeek: cfg.dayOfWeek,
        start: toMinutes(cfg.startTime),
        end: toMinutes(cfg.endTime),
        gradeLevel: cfg.gradeLevel,
        group: cfg.group,
        startTime: cfg.startTime,
        endTime: cfg.endTime
      }))
    );
}

function findOwnOverlap(intervals: Interval[]) {
  for (let i = 0; i < intervals.length; i += 1) {
    for (let j = i + 1; j < intervals.length; j += 1) {
      const a = intervals[i];
      const b = intervals[j];
      if (a.dayOfWeek === b.dayOfWeek && a.start < b.end && b.start < a.end) {
        return { a, b };
      }
    }
  }
  return null;
}

router.get("/admin-subject-hours", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { user: { fullName: "asc" } }
  });

  res.json(
    teachers.map((t) => {
      const subjects = normalizeSubjects(t.subjects);
      const subjectConfigs = normalizeSubjectConfigs(subjects, t.subjectHours, t.subjectSchedules, t.subjectHoursMode);
      const totalHours = subjectConfigs.reduce((sum, s) => sum + s.hoursPerWeek, 0);
      return {
        teacherId: t.id,
        teacherName: t.user.fullName,
        teacherEmail: t.user.email,
        subjects: subjectConfigs,
        totalHours
      };
    })
  );
});

router.get("/admin-subject-hours/export/excel", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { user: { fullName: "asc" } }
  });
  const branding = await getBrandingSettings();

  const rows = teachers.flatMap((t) => {
    const subjects = normalizeSubjects(t.subjects);
    const subjectConfigs = normalizeSubjectConfigs(subjects, t.subjectHours, t.subjectSchedules, t.subjectHoursMode);
    const totalTeacherHours = subjectConfigs.reduce((sum, s) => sum + s.hoursPerWeek, 0);

    return subjectConfigs.flatMap((s) => {
      if (!s.slots.length) {
        return [
          {
            teacherName: t.user.fullName,
            teacherEmail: t.user.email,
            subject: s.subject,
            gradeLevel: "-",
            group: "-",
            dayOfWeek: "-",
            startTime: "-",
            endTime: "-",
            hoursPerWeek: s.hoursPerWeek,
            totalTeacherHours
          }
        ];
      }
      return s.slots.map((slot) => ({
        teacherName: t.user.fullName,
        teacherEmail: t.user.email,
        subject: s.subject,
        gradeLevel: slot.gradeLevel || "-",
        group: slot.group || "-",
        dayOfWeek: slot.dayOfWeek || "-",
        startTime: slot.startTime || "-",
        endTime: slot.endTime || "-",
        hoursPerWeek: s.hoursPerWeek,
        totalTeacherHours
      }));
    });
  });

  const xlsx = buildXlsxReportBuffer({
    title: "Horario de Docentes",
    institutionName: branding.schoolName,
    columns: [
      { key: "teacherName", label: "Docente" },
      { key: "teacherEmail", label: "Correo" },
      { key: "subject", label: "Asignatura" },
      { key: "gradeLevel", label: "Grado" },
      { key: "group", label: "Grupo" },
      { key: "dayOfWeek", label: "Dia" },
      { key: "startTime", label: "Inicio" },
      { key: "endTime", label: "Fin" },
      { key: "hoursPerWeek", label: "Horas asignatura/semana" },
      { key: "totalTeacherHours", label: "Total docente/semana" }
    ],
    rows
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"horario-docentes.xlsx\"");
  res.send(xlsx);
});

router.get("/admin-subject-hours/export/pdf", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { user: { fullName: "asc" } }
  });
  const branding = await getBrandingSettings();

  const rows = teachers.flatMap((t) => {
    const subjects = normalizeSubjects(t.subjects);
    const subjectConfigs = normalizeSubjectConfigs(subjects, t.subjectHours, t.subjectSchedules, t.subjectHoursMode);
    const totalTeacherHours = subjectConfigs.reduce((sum, s) => sum + s.hoursPerWeek, 0);

    return subjectConfigs.flatMap((s) => {
      if (!s.slots.length) {
        return [
          {
            teacherName: t.user.fullName,
            subject: s.subject,
            gradeGroup: "-",
            schedule: "-",
            hoursPerWeek: s.hoursPerWeek,
            totalTeacherHours
          }
        ];
      }
      return s.slots.map((slot) => ({
        teacherName: t.user.fullName,
        subject: s.subject,
        gradeGroup: `${slot.gradeLevel || "-"}-${slot.group || "-"}`,
        schedule: `${dayLabelShort[slot.dayOfWeek || ""] || slot.dayOfWeek || "-"} ${slot.startTime || "--:--"}-${slot.endTime || "--:--"}`,
        hoursPerWeek: s.hoursPerWeek,
        totalTeacherHours
      }));
    });
  });
  rows.sort((a, b) => {
    if (a.teacherName !== b.teacherName) return a.teacherName.localeCompare(b.teacherName);
    if (a.gradeGroup !== b.gradeGroup) return a.gradeGroup.localeCompare(b.gradeGroup);
    return a.schedule.localeCompare(b.schedule);
  });

  sendTabularPdf(res, {
    fileName: "horario-docentes.pdf",
    title: "Horario de Docentes",
    subtitle: `${branding.schoolName || "Institucion Educativa"} | Distribucion semanal por asignatura`,
    branding,
    columns: [
      // Mantener el total <= ancho util de A4 para evitar cortes en PDF.
      { key: "teacherName", label: "Docente", width: 110 },
      { key: "subject", label: "Asignatura", width: 95 },
      { key: "gradeGroup", label: "Grado-Grupo", width: 80, align: "center" },
      { key: "schedule", label: "Horario", width: 130, align: "center" },
      { key: "hoursPerWeek", label: "Horas Asig.", width: 50, align: "right" },
      { key: "totalTeacherHours", label: "Total Docente", width: 50, align: "right" }
    ],
    rows:
      rows.length > 0
        ? rows
        : [
            {
              teacherName: "Sin datos",
              subject: "-",
              gradeGroup: "-",
              schedule: "-",
              hoursPerWeek: 0,
              totalTeacherHours: 0
            }
          ]
  });
});

router.get("/admin-students-format/export/excel", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const students = await prisma.student.findMany({
    select: { id: true, fullName: true, gradeLevel: true, birthDate: true, isActive: true, createdAt: true },
    orderBy: [{ gradeLevel: "asc" }, { fullName: "asc" }]
  });
  const branding = await getBrandingSettings();

  const xlsx = buildXlsxReportBuffer({
    title: "Formato Ordenado de Estudiantes",
    institutionName: branding.schoolName,
    columns: [
      { key: "studentId", label: "ID estudiante" },
      { key: "fullName", label: "Nombre completo" },
      { key: "gradeLevel", label: "Grado" },
      { key: "birthDate", label: "Fecha nacimiento" },
      { key: "isActive", label: "Estado" },
      { key: "createdAt", label: "Fecha registro" }
    ],
    rows: students.map((s) => ({
      studentId: s.id,
      fullName: s.fullName,
      gradeLevel: s.gradeLevel,
      birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : "-",
      isActive: s.isActive ? "Activo" : "Inactivo",
      createdAt: s.createdAt.toISOString().slice(0, 10)
    }))
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"formato-estudiantes.xlsx\"");
  res.send(xlsx);
});

router.get("/admin-students-format/export/pdf", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const gradeOrder: Record<string, number> = {
    PRE_JARDIN: 1,
    JARDIN: 2,
    TRANSICION: 3,
    PRIMERO: 4,
    SEGUNDO: 5,
    TERCERO: 6,
    CUARTO: 7,
    QUINTO: 8,
    SEXTO: 9,
    SEPTIMO: 10,
    OCTAVO: 11,
    NOVENO: 12,
    DECIMO: 13,
    ONCE: 14
  };
  const dayOrder: Record<string, number> = {
    LUNES: 1,
    MARTES: 2,
    MIERCOLES: 3,
    JUEVES: 4,
    VIERNES: 5,
    SABADO: 6
  };

  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { user: { fullName: "asc" } }
  });
  const branding = await getBrandingSettings();

  const rows = teachers.flatMap((t) => {
    const subjects = normalizeSubjects(t.subjects);
    const subjectConfigs = normalizeSubjectConfigs(subjects, t.subjectHours, t.subjectSchedules, t.subjectHoursMode);
    return subjectConfigs.flatMap((s) =>
      s.slots
        .filter((slot) => slot.dayOfWeek && slot.startTime && slot.endTime)
        .map((slot) => ({
          gradeGroup: `${slot.gradeLevel || "-"}-${slot.group || "-"}`,
          dayOfWeek: slot.dayOfWeek || "-",
          timeRange: `${slot.startTime || "--:--"}-${slot.endTime || "--:--"}`,
          subject: s.subject,
          teacherName: t.user.fullName
        }))
    );
  });

  rows.sort((a, b) => {
    const [gradeA] = a.gradeGroup.split("-");
    const [gradeB] = b.gradeGroup.split("-");
    const ga = gradeOrder[gradeA] || 999;
    const gb = gradeOrder[gradeB] || 999;
    if (ga !== gb) return ga - gb;
    if (a.gradeGroup !== b.gradeGroup) return a.gradeGroup.localeCompare(b.gradeGroup);
    const da = dayOrder[a.dayOfWeek] || 999;
    const db = dayOrder[b.dayOfWeek] || 999;
    if (da !== db) return da - db;
    return a.timeRange.localeCompare(b.timeRange);
  });

  const groups = new Map<string, typeof rows>();
  rows.forEach((r) => {
    if (!groups.has(r.gradeGroup)) groups.set(r.gradeGroup, []);
    groups.get(r.gradeGroup)!.push(r);
  });

  const sortedGroupNames = Array.from(groups.keys()).sort((a, b) => {
    const [ga] = a.split("-");
    const [gb] = b.split("-");
    const oa = gradeOrder[ga] || 999;
    const ob = gradeOrder[gb] || 999;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"formato-estudiantes.pdf\"");

  const doc = new PDFDocument({ margin: 24, size: "A4", layout: "landscape" });
  doc.pipe(res);

  const days = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
  const dayLabel = dayLabelShort;
  const defaultSlots = [
    "07:00-08:00",
    "08:00-09:00",
    "09:00-10:00",
    "10:00-11:00",
    "11:00-12:00",
    "12:00-13:00",
    "13:00-14:00",
    "14:00-15:00",
    "15:00-16:00"
  ];
  const FIXED_ROWS = 13;
  const titleColor = "#2f68c9";
  const titleShadow = "#1f4ea1";
  const subtitleColor = "#334155";
  const headerFill = "#cfd9e6";
  const leftFill = "#dbe5f2";
  const gridStroke = "#6b7280";

  const drawGridPage = (gradeGroup: string, data: typeof rows, pageIndex: number, totalPagesForGroup: number) => {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const left = 24;
    const right = pageWidth - 24;
    const topTitle = 24;

    // Titulo con sombra para aproximar el estilo del ejemplo
    doc.fillColor(titleShadow).font("Helvetica-BoldOblique").fontSize(58).text("Horario", 2, topTitle + 2, {
      align: "center"
    });
    doc.fillColor(titleColor).font("Helvetica-BoldOblique").fontSize(58).text("Horario", 0, topTitle, {
      align: "center"
    });
    doc
      .fillColor(subtitleColor)
      .font("Helvetica")
      .fontSize(12)
      .text(
        `${branding.schoolName || "Institucion Educativa"}  |  Grado-Grupo: ${gradeGroup}${
          totalPagesForGroup > 1 ? `  |  Pagina ${pageIndex + 1}/${totalPagesForGroup}` : ""
        }`,
        0,
        84,
        { align: "center" }
      );
    doc
      .fillColor("#64748b")
      .font("Helvetica")
      .fontSize(9)
      .text("Formato semanal por grado y grupo", 0, 102, { align: "center" });

    const tableTop = 124;
    const tableWidth = right - left;
    const leftColWidth = 86;
    const dayColWidth = (tableWidth - leftColWidth) / days.length;
    const headerHeight = 30;
    const rowHeight = 28;

    const slotSet = new Set<string>(
      data
        .map((d) => d.timeRange)
        .filter((t) => t && t !== "-")
    );
    const orderedSlots =
      slotSet.size > 0
        ? Array.from(slotSet).sort((a, b) => a.localeCompare(b))
        : defaultSlots;

    const start = pageIndex * FIXED_ROWS;
    const visibleSlots = orderedSlots.slice(start, start + FIXED_ROWS);
    while (visibleSlots.length < FIXED_ROWS) {
      visibleSlots.push("");
    }

    // Header row
    doc.save();
    doc.fillColor(headerFill).rect(left, tableTop, leftColWidth, headerHeight).fill();
    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Hora", left, tableTop + 8, { width: leftColWidth, align: "center" });
    days.forEach((d, idx) => {
      doc.fillColor(headerFill).rect(left + leftColWidth + idx * dayColWidth, tableTop, dayColWidth, headerHeight).fill();
      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(dayLabel[d], left + leftColWidth + idx * dayColWidth, tableTop + 8, {
          width: dayColWidth,
          align: "center"
        });
    });
    doc.restore();

    const textByCell = new Map<string, string>();
    data.forEach((item) => {
      const key = `${item.dayOfWeek}|${item.timeRange}`;
      const current = textByCell.get(key);
      const value = `${item.subject}${item.teacherName ? `\n${item.teacherName}` : ""}`;
      textByCell.set(key, current ? `${current}\n---\n${value}` : value);
    });

    visibleSlots.forEach((slot, rowIdx) => {
      const y = tableTop + headerHeight + rowIdx * rowHeight;
      doc.save();
      doc.fillColor(leftFill).rect(left, y, leftColWidth, rowHeight).fill();
      doc.restore();
      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(slot, left + 4, y + 9, {
          width: leftColWidth - 8,
          align: "center"
        });

      days.forEach((d, dayIdx) => {
        const x = left + leftColWidth + dayIdx * dayColWidth;
        const key = `${d}|${slot}`;
        const content = textByCell.get(key) || "";
        if (content) {
          doc
            .fillColor("#0f172a")
            .font("Helvetica")
            .fontSize(8)
            .text(content, x + 3, y + 3, {
              width: dayColWidth - 6,
              height: rowHeight - 6,
              align: "left"
            });
        }
      });
    });

    // Grid lines
    const gridBottom = tableTop + headerHeight + visibleSlots.length * rowHeight;
    doc.save();
    doc.strokeColor(gridStroke).lineWidth(0.8);

    // verticals
    doc.moveTo(left, tableTop).lineTo(left, gridBottom).stroke();
    doc.moveTo(left + leftColWidth, tableTop).lineTo(left + leftColWidth, gridBottom).stroke();
    for (let i = 1; i <= days.length; i += 1) {
      const x = left + leftColWidth + i * dayColWidth;
      doc.moveTo(x, tableTop).lineTo(x, gridBottom).stroke();
    }
    // horizontals
    doc.moveTo(left, tableTop).lineTo(right, tableTop).stroke();
    doc.moveTo(left, tableTop + headerHeight).lineTo(right, tableTop + headerHeight).stroke();
    for (let i = 1; i <= visibleSlots.length; i += 1) {
      const y = tableTop + headerHeight + i * rowHeight;
      doc.moveTo(left, y).lineTo(right, y).stroke();
    }
    doc.restore();
  };

  if (sortedGroupNames.length === 0) {
    drawGridPage("GENERAL", [], 0, 1);
  } else {
    sortedGroupNames.forEach((groupName, groupIdx) => {
      const data = groups.get(groupName) || [];
      const slotSet = new Set<string>(data.map((d) => d.timeRange).filter((t) => t && t !== "-"));
      const orderedSlots = slotSet.size > 0 ? Array.from(slotSet).sort((a, b) => a.localeCompare(b)) : defaultSlots;
      const pages = Math.max(1, Math.ceil(orderedSlots.length / FIXED_ROWS));

      for (let p = 0; p < pages; p += 1) {
        if (groupIdx > 0 || p > 0) doc.addPage({ size: "A4", layout: "landscape", margin: 24 });
        drawGridPage(groupName, data, p, pages);
      }
    });
  }

  doc.end();
});

router.put("/:teacherId/subject-hours", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const teacherId = String(req.params.teacherId || "");
  const payload = Array.isArray(req.body?.subjectHours)
    ? req.body.subjectHours
    : Array.isArray(req.body?.subjectConfigs)
    ? req.body.subjectConfigs
    : [];

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { user: { select: { fullName: true } } }
  });
  if (!teacher) return res.status(404).json({ message: "Docente no encontrado" });

  const subjects = normalizeSubjects(teacher.subjects);
  const nextHoursMap: Record<string, number> = {};
  const nextHoursModeMap: Record<string, boolean> = {};
  const nextScheduleMap: Record<string, SubjectSlot[]> = {};
  for (const subject of subjects) {
    const found = payload.find((p: any) => String(p?.subject) === subject);
    const autoMode = found?.autoMode === undefined ? true : Boolean(found?.autoMode);
    const hours = Number(found?.hoursPerWeek ?? 0);
    if (Number.isNaN(hours) || hours < 0 || hours > 60) {
      return res.status(400).json({ message: `Horas invalidas para ${subject}. Rango: 0 a 60.` });
    }

    const slots = parseSubjectSlots(found);
    const slotError = validateSubjectSlots(subject, hours, slots);
    if (slotError) return res.status(400).json({ message: slotError });

    nextScheduleMap[subject] = slots;
    nextHoursModeMap[subject] = autoMode;
    nextHoursMap[subject] = autoMode ? toHoursFromSlots(slots) : hours;
  }

  const intervals = buildIntervals(nextScheduleMap, nextHoursMap);
  const ownOverlap = findOwnOverlap(intervals);
  if (ownOverlap) {
    const { a, b } = ownOverlap;
    return res.status(400).json({
      message: `Cruce de horario para ${teacher.user.fullName}: ${a.subject} ${a.gradeLevel}-${a.group} (${a.dayOfWeek} ${a.startTime}-${a.endTime}) y ${b.subject} ${b.gradeLevel}-${b.group} (${b.dayOfWeek} ${b.startTime}-${b.endTime}) se cruzan`
    });
  }
  const otherTeachers = await prisma.teacher.findMany({
    where: { id: { not: teacherId } },
    include: { user: { select: { fullName: true } } }
  });

  const otherIntervals = otherTeachers.flatMap((t) => {
    const otherSubjects = normalizeSubjects(t.subjects);
    const subjectConfigs = normalizeSubjectConfigs(otherSubjects, t.subjectHours, t.subjectSchedules);
    return subjectConfigs.flatMap((cfg) =>
      cfg.slots
        .map((slot) => ({
          teacherName: t.user.fullName,
          subject: cfg.subject,
          dayOfWeek: slot.dayOfWeek,
          start: toMinutes(slot.startTime),
          end: toMinutes(slot.endTime),
          gradeLevel: slot.gradeLevel,
          group: slot.group,
          startTime: slot.startTime,
          endTime: slot.endTime
        }))
        .filter((slot) => slot.dayOfWeek && slot.start >= 0 && slot.end > slot.start)
    );
  });

  for (const slot of intervals) {
    const duplicate = otherIntervals.find(
      (o) =>
        o.subject === slot.subject &&
        o.dayOfWeek === slot.dayOfWeek &&
        o.start === slot.start &&
        o.end === slot.end &&
        o.gradeLevel === slot.gradeLevel &&
        o.group === slot.group
    );
    if (duplicate) {
      return res.status(400).json({
        message: `Franja duplicada: ${slot.subject} ${slot.dayOfWeek} ${duplicate.startTime}-${duplicate.endTime} (${duplicate.gradeLevel}-${duplicate.group}) ya asignada a ${duplicate.teacherName}. Docente actual: ${teacher.user.fullName}`
      });
    }
  }

  for (const slot of intervals) {
    const overlap = otherIntervals.find(
      (o) =>
        o.dayOfWeek === slot.dayOfWeek &&
        o.gradeLevel === slot.gradeLevel &&
        o.group === slot.group &&
        o.subject === slot.subject &&
        o.start < slot.end &&
        slot.start < o.end
    );
    if (overlap) {
      return res.status(400).json({
        message: `Cruce de horario para la misma asignatura y grado/grupo: ${teacher.user.fullName} vs ${overlap.teacherName} (${overlap.subject}) ${overlap.gradeLevel}-${overlap.group} ${overlap.dayOfWeek} ${overlap.startTime}-${overlap.endTime}`
      });
    }
  }

  const updated = await prisma.teacher.update({
    where: { id: teacherId },
    data: { subjectHours: nextHoursMap, subjectSchedules: nextScheduleMap, subjectHoursMode: nextHoursModeMap },
    include: { user: { select: { fullName: true, email: true } } }
  });

  const updatedSubjects = normalizeSubjects(updated.subjects);
  const updatedHours = normalizeSubjectConfigs(
    updatedSubjects,
    updated.subjectHours,
    updated.subjectSchedules,
    updated.subjectHoursMode
  );
  res.json({
    teacherId: updated.id,
    teacherName: updated.user.fullName,
    teacherEmail: updated.user.email,
    subjects: updatedHours,
    totalHours: updatedHours.reduce((sum, s) => sum + s.hoursPerWeek, 0)
  });
});

router.get("/profile", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const teacher = await prisma.teacher.findUnique({
    where: { userId: auth.userId },
    include: { user: { select: { fullName: true, email: true } } }
  });
  if (!teacher) return res.status(404).json({ message: "Perfil docente no encontrado" });

  res.json({
    fullName: teacher.user.fullName,
    email: teacher.user.email,
    professionalProfile: teacher.professionalProfile || "",
    subjects: Array.isArray(teacher.subjects) ? teacher.subjects : [],
    cognitiveWeight: teacher.cognitiveWeight,
    personalWeight: teacher.personalWeight,
    socialWeight: teacher.socialWeight
  });
});

router.put("/profile", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
  if (!teacher) return res.status(404).json({ message: "Perfil docente no encontrado" });

  const body = req.body || {};
  const nextProfile = typeof body.professionalProfile === "string" ? body.professionalProfile.trim() : teacher.professionalProfile;
  const nextSubjects = Array.isArray(body.subjects)
    ? body.subjects.map((s: unknown) => String(s).trim()).filter(Boolean)
    : (Array.isArray(teacher.subjects) ? teacher.subjects : []);

  const nextCognitive = body.cognitiveWeight === undefined ? teacher.cognitiveWeight : Number(body.cognitiveWeight);
  const nextPersonal = body.personalWeight === undefined ? teacher.personalWeight : Number(body.personalWeight);
  const nextSocial = body.socialWeight === undefined ? teacher.socialWeight : Number(body.socialWeight);

  const weights = [nextCognitive, nextPersonal, nextSocial];
  if (weights.some((w) => Number.isNaN(w) || w < 0 || w > 100)) {
    return res.status(400).json({ message: "Las ponderaciones deben estar entre 0 y 100" });
  }
  if (Math.round((nextCognitive + nextPersonal + nextSocial) * 100) / 100 !== 100) {
    return res.status(400).json({ message: "La suma de ponderaciones debe ser 100" });
  }

  const updated = await prisma.teacher.update({
    where: { id: teacher.id },
    data: {
      professionalProfile: nextProfile,
      subjects: nextSubjects,
      cognitiveWeight: nextCognitive,
      personalWeight: nextPersonal,
      socialWeight: nextSocial
    },
    include: { user: { select: { fullName: true, email: true } } }
  });

  res.json({
    fullName: updated.user.fullName,
    email: updated.user.email,
    professionalProfile: updated.professionalProfile || "",
    subjects: Array.isArray(updated.subjects) ? updated.subjects : [],
    cognitiveWeight: updated.cognitiveWeight,
    personalWeight: updated.personalWeight,
    socialWeight: updated.socialWeight
  });
});

router.get("/students", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const todayOnly = String(req.query.today || "").trim() === "1";
  const teacher = await prisma.teacher.findUnique({
    where: { userId: auth.userId },
    select: { id: true, subjectSchedules: true }
  });
  if (!teacher) return res.json([]);
  const dayOfWeek = dayOfWeekInSpanishUpper();
  const slots = normalizeTeacherSlots(teacher.subjectSchedules);
  const scopedSlots = todayOnly ? slots.filter((s) => s.dayOfWeek === dayOfWeek) : slots;
  if (scopedSlots.length === 0) return res.json([]);

  const uniquePairs = Array.from(
    new Set(
      scopedSlots.map((s) => `${normalizeGradeKey(s.gradeLevel)}::${normalizeGroupKey(s.group || "")}`)
    )
  ).map((key) => {
    const [gradeLevel, group] = key.split("::");
    return { gradeLevel, group };
  });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      OR: uniquePairs.map((pair) => ({
        class: { gradeLevel: pair.gradeLevel as any },
        ...(pair.group && pair.group !== "-"
          ? { student: { studentGroup: { equals: pair.group, mode: "insensitive" as const } } }
          : {})
      }))
    },
    include: { student: true, class: true }
  });

  const map = new Map<string, any>();
  enrollments.forEach((e) => {
    if (!map.has(e.studentId)) map.set(e.studentId, e.student);
  });

  res.json(Array.from(map.values()));
});

router.get("/enrollments", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const todayOnly = String(req.query.today || "").trim() === "1";
  const teacher = await prisma.teacher.findUnique({
    where: { userId: auth.userId },
    select: { id: true, subjectSchedules: true }
  });
  if (!teacher) return res.json([]);
  const dayOfWeek = dayOfWeekInSpanishUpper();
  const slots = normalizeTeacherSlots(teacher.subjectSchedules);
  const scopedSlots = todayOnly ? slots.filter((s) => s.dayOfWeek === dayOfWeek) : slots;
  if (scopedSlots.length === 0) return res.json([]);

  const uniquePairs = Array.from(
    new Set(
      scopedSlots.map((s) => `${normalizeGradeKey(s.gradeLevel)}::${normalizeGroupKey(s.group || "")}`)
    )
  ).map((key) => {
    const [gradeLevel, group] = key.split("::");
    return { gradeLevel, group };
  });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      OR: uniquePairs.map((pair) => ({
        class: { gradeLevel: pair.gradeLevel as any },
        ...(pair.group && pair.group !== "-"
          ? { student: { studentGroup: { equals: pair.group, mode: "insensitive" as const } } }
          : {})
      }))
    },
    include: { student: true, class: true }
  });

  const data = enrollments.map((e) => ({
    ...e,
    grade: getEnrollmentGradeLevel(e),
    group: String(e.student?.studentGroup || "")
  }));

  res.json(data);
});

router.get("/tasks/board", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const gradeLevelRaw = String(req.query.gradeLevel || "").trim().toUpperCase();
  const { group: groupRaw, mode: groupMode } = parseTaskGroup(String(req.query.group || ""));
  const period = String(req.query.period || "P1").trim();
  if (!gradeLevelRaw) return res.status(400).json({ message: "gradeLevel requerido" });

  const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
  if (!teacher) return res.json({ tasks: [], students: [], scores: [] });

  const allowedPairs = await resolveTeacherGradeGroups(auth.userId);
  const normalizedGrade = normalizeGradeKey(gradeLevelRaw);
  const normalizedGroup = normalizeGroupKey(groupRaw);
  const isAllowed = allowedPairs.some((pair) => {
    const pairGrade = normalizeGradeKey(pair.gradeLevel);
    const pairGroup = normalizeGroupKey(pair.group || "");
    if (pairGrade !== normalizedGrade) return false;
    if (groupMode === "empty") {
      return !pairGroup || pairGroup === "-" || pairGroup === "SIN_GRUPO";
    }
    if (groupMode === "exact") {
      if (!pairGroup || pairGroup === "-" || pairGroup === "SIN_GRUPO") return true;
      return pairGroup === normalizedGroup;
    }
    return true;
  });
  if (!isAllowed) return res.status(403).json({ message: "No tienes permisos para este grado/grupo" });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      class: { gradeLevel: gradeLevelRaw as any },
      ...(groupMode === "exact"
        ? { student: { studentGroup: { equals: groupRaw, mode: "insensitive" as const } } }
        : groupMode === "empty"
        ? { student: { OR: [{ studentGroup: null }, { studentGroup: "" }] } }
        : {})
    },
    include: { student: true, class: true },
    orderBy: { studentFullName: "asc" }
  });

  const taskWhere: any = {
    teacherId: teacher.id,
    gradeLevel: gradeLevelRaw as any,
    period
  };
  if (groupMode !== "any") {
    taskWhere.group = groupMode === "exact" ? groupRaw : null;
  }
  const tasks = await prisma.task.findMany({
    where: taskWhere,
    orderBy: { createdAt: "asc" }
  });

  const enrollmentIds = enrollments.map((e) => e.id);
  const taskIds = tasks.map((t) => t.id);

  const scores = taskIds.length
    ? await prisma.taskScore.findMany({
        where: { taskId: { in: taskIds }, enrollmentId: { in: enrollmentIds } },
        select: { id: true, taskId: true, enrollmentId: true, score: true }
      })
    : [];

  res.json({
    tasks,
    students: enrollments.map((e) => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      fullName: e.student?.fullName || e.studentFullName,
      grade: getEnrollmentGradeLevel(e),
      group: String(e.student?.studentGroup || "")
    })),
    scores
  });
});

router.post("/tasks", requireAuth, requireRole(["TEACHER"]), validate(createTaskSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { body } = (req as any).validated;
  const gradeLevelRaw = String(body.gradeLevel || "").trim().toUpperCase();
  const { group: groupRaw, mode: groupMode } = parseTaskGroup(String(body.group || ""));

  const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
  if (!teacher) return res.status(403).json({ message: "Docente no encontrado" });

  const allowedPairs = await resolveTeacherGradeGroups(auth.userId);
  const normalizedGrade = normalizeGradeKey(gradeLevelRaw);
  const normalizedGroup = normalizeGroupKey(groupRaw);
  const isAllowed = allowedPairs.some((pair) => {
    const pairGrade = normalizeGradeKey(pair.gradeLevel);
    const pairGroup = normalizeGroupKey(pair.group || "");
    if (pairGrade !== normalizedGrade) return false;
    if (groupMode === "empty") {
      return !pairGroup || pairGroup === "-" || pairGroup === "SIN_GRUPO";
    }
    if (groupMode === "exact") {
      if (!pairGroup || pairGroup === "-" || pairGroup === "SIN_GRUPO") return true;
      return pairGroup === normalizedGroup;
    }
    return true;
  });
  if (!isAllowed) return res.status(403).json({ message: "No tienes permisos para este grado/grupo" });

  try {
    const created = await prisma.task.create({
      data: {
        teacherId: teacher.id,
        gradeLevel: gradeLevelRaw as any,
        group: groupMode === "exact" ? groupRaw : null,
        period: String(body.period || "").trim(),
        title: String(body.title || "").trim(),
        aspect: body.aspect,
        maxScore: body.maxScore
      }
    });

    const enrollments = await prisma.enrollment.findMany({
      where: {
        class: { gradeLevel: gradeLevelRaw as any },
        ...(groupMode === "exact"
          ? { student: { studentGroup: { equals: groupRaw, mode: "insensitive" as const } } }
          : groupMode === "empty"
          ? { student: { OR: [{ studentGroup: null }, { studentGroup: "" }] } }
          : {})
      },
      select: { studentId: true, student: { select: { fullName: true } } }
    });

    if (enrollments.length > 0) {
      const gradeLabel = gradeLabelFull(gradeLevelRaw);
      const groupLabel =
        groupMode === "exact" && groupRaw ? ` - Grupo ${groupRaw}` : groupMode === "empty" ? " - Sin grupo" : "";
      const bodyText = `Nueva tarea registrada.\nGrado: ${gradeLabel}${groupLabel}\nPeriodo: ${created.period}\nPuntaje maximo: ${created.maxScore}`;
      const notificationBody = composeNotificationBodyWithMeta(bodyText, "PARENTS");
      const notifications = await Promise.all(
        enrollments.map((e) =>
          prisma.notification.create({
            data: {
              title: `Nueva tarea: ${created.title}`,
              body: notificationBody,
              status: "APPROVED",
              createdById: auth.userId,
              approvedById: auth.userId,
              approvedAt: new Date(),
              studentId: e.studentId
            }
          })
        )
      );
      const studentIds = enrollments.map((e) => e.studentId);
      const guardians = await prisma.guardian.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, parentId: true }
      });
      const parentsByStudent = new Map<string, string[]>();
      guardians.forEach((g) => {
        if (!parentsByStudent.has(g.studentId)) parentsByStudent.set(g.studentId, []);
        parentsByStudent.get(g.studentId)!.push(g.parentId);
      });
      const recipients = notifications.flatMap((notification) => {
        const parents = notification.studentId ? parentsByStudent.get(notification.studentId) || [] : [];
        return parents.map((parentId) => ({
          notificationId: notification.id,
          parentId
        }));
      });
      if (recipients.length > 0) {
        await prisma.notificationRecipient.createMany({
          data: recipients,
          skipDuplicates: true
        });
      }
      await Promise.all(notifications.map((notification) => enqueueNotification(notification.id)));
    }

    res.json(created);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Ya existe una tarea con ese nombre para este periodo." });
    }
    res.status(400).json({ message: error?.message || "No se pudo crear la tarea" });
  }
});

router.post("/tasks/score", requireAuth, requireRole(["TEACHER"]), validate(upsertTaskScoreSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { body } = (req as any).validated;
  const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
  if (!teacher) return res.status(403).json({ message: "Docente no encontrado" });

  const task = await prisma.task.findUnique({ where: { id: body.taskId } });
  if (!task || task.teacherId !== teacher.id) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: body.enrollmentId },
    include: { student: true, class: true }
  });
  if (!enrollment) return res.status(404).json({ message: "Estudiante no encontrado" });

  const enrollmentGrade = normalizeGradeKey(getEnrollmentGradeLevel(enrollment));
  const enrollmentGroup = normalizeGroupKey(String(enrollment.student?.studentGroup || ""));
  const taskGrade = normalizeGradeKey(task.gradeLevel);
  const taskGroup = normalizeGroupKey(task.group || "");
  if (enrollmentGrade !== taskGrade) {
    return res.status(400).json({ message: "La tarea no corresponde al grado del estudiante" });
  }
  if (task.group && taskGroup && enrollmentGroup !== taskGroup) {
    return res.status(400).json({ message: "La tarea no corresponde al grupo del estudiante" });
  }

  if (body.score > task.maxScore) {
    return res.status(400).json({ message: "La calificacion supera el maximo permitido" });
  }

  const taskScore = await prisma.taskScore.upsert({
    where: { taskId_enrollmentId: { taskId: task.id, enrollmentId: enrollment.id } },
    update: { score: body.score },
    create: { taskId: task.id, enrollmentId: enrollment.id, score: body.score }
  });

  const existingGrade = await prisma.grade.findFirst({
    where: {
      enrollmentId: enrollment.id,
      period: task.period,
      name: task.title,
      aspect: task.aspect
    }
  });

  const grade = existingGrade
    ? await prisma.grade.update({
        where: { id: existingGrade.id },
        data: { score: body.score, maxScore: task.maxScore }
      })
    : await prisma.grade.create({
        data: {
          enrollmentId: enrollment.id,
          period: task.period,
          name: task.title,
          aspect: task.aspect,
          score: body.score,
          maxScore: task.maxScore
        }
      });

  res.json({ taskScore, grade });
});

router.patch("/tasks/:id", requireAuth, requireRole(["TEACHER"]), validate(updateTaskSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { params, body } = (req as any).validated;
  const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
  if (!teacher) return res.status(403).json({ message: "Docente no encontrado" });

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.teacherId !== teacher.id) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }

  const updates: any = {};
  if (body.title !== undefined) updates.title = String(body.title || "").trim();
  if (body.aspect !== undefined) updates.aspect = body.aspect;
  if (body.maxScore !== undefined) updates.maxScore = body.maxScore;
  if (body.period !== undefined) updates.period = String(body.period || "").trim();

  if (Object.keys(updates).length === 0) return res.json(task);

  try {
    const enrollmentRows = await prisma.taskScore.findMany({
      where: { taskId: task.id },
      select: { enrollmentId: true }
    });
    const enrollmentIds = enrollmentRows.map((row) => row.enrollmentId);

    const updated = await prisma.$transaction(async (tx) => {
      const nextTask = await tx.task.update({
        where: { id: task.id },
        data: updates
      });

      if (enrollmentIds.length > 0) {
        const gradeWhere: any = {
          enrollmentId: { in: enrollmentIds },
          name: task.title,
          period: task.period,
          aspect: task.aspect
        };
        const gradeUpdates: any = {};
        if (updates.title !== undefined) gradeUpdates.name = updates.title;
        if (updates.period !== undefined) gradeUpdates.period = updates.period;
        if (updates.aspect !== undefined) gradeUpdates.aspect = updates.aspect;
        if (updates.maxScore !== undefined) gradeUpdates.maxScore = updates.maxScore;
        if (Object.keys(gradeUpdates).length > 0) {
          await tx.grade.updateMany({ where: gradeWhere, data: gradeUpdates });
        }
      }

      return nextTask;
    });

    res.json(updated);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Ya existe una tarea con ese nombre para este periodo." });
    }
    res.status(400).json({ message: error?.message || "No se pudo actualizar la tarea" });
  }
});

router.delete("/tasks/:id", requireAuth, requireRole(["TEACHER"]), validate(deleteTaskSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { params } = (req as any).validated;
  const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
  if (!teacher) return res.status(403).json({ message: "Docente no encontrado" });

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.teacherId !== teacher.id) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }

  const enrollmentRows = await prisma.taskScore.findMany({
    where: { taskId: task.id },
    select: { enrollmentId: true }
  });
  const enrollmentIds = enrollmentRows.map((row) => row.enrollmentId);

  await prisma.$transaction([
    prisma.taskScore.deleteMany({ where: { taskId: task.id } }),
    ...(enrollmentIds.length > 0
      ? [
          prisma.grade.deleteMany({
            where: {
              enrollmentId: { in: enrollmentIds },
              name: task.title,
              period: task.period,
              aspect: task.aspect
            }
          })
        ]
      : []),
    prisma.task.delete({ where: { id: task.id } })
  ]);

  res.json({ deleted: true });
});

router.get("/attendance", requireAuth, requireRole(["TEACHER", "ADMIN"]), async (req, res) => {
  const auth = (req as any).auth;
  const isTeacher = auth.role === "TEACHER";
  const teacher = isTeacher
    ? await prisma.teacher.findUnique({ where: { userId: auth.userId }, select: { id: true, subjectSchedules: true } })
    : null;
  if (isTeacher && !teacher) return res.json([]);

  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const paginateByDate = String(req.query.paginateByDate || "").trim() === "1";
  const validToday = String(req.query.validToday || "").trim() === "1";
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const group = String(req.query.group || "").trim();
  const student = String(req.query.student || "").trim();
  const teacherId = String(req.query.teacherId || "").trim();
  const date = String(req.query.date || "").trim();
  const classWhere: any = {};
  if (gradeLevel) {
    classWhere.gradeLevel = gradeLevel as any;
  }

  const enrollmentWhere: any = {};
  if (!isTeacher && Object.keys(classWhere).length > 0) {
    enrollmentWhere.class = classWhere;
  }
  if (isTeacher) {
    const dayOfWeek = dayOfWeekInSpanishUpper();
    const slots = normalizeTeacherSlots(teacher!.subjectSchedules);
    const scopedSlots = validToday ? slots.filter((s) => s.dayOfWeek === dayOfWeek) : slots;
    const uniquePairs = Array.from(
      new Set(scopedSlots.map((s) => `${normalizeGradeKey(s.gradeLevel)}::${normalizeGroupKey(s.group || "")}`))
    ).map((key) => {
      const [slotGradeLevel, slotGroup] = key.split("::");
      return { slotGradeLevel, slotGroup };
    });

    if (uniquePairs.length === 0) {
      return res.json({ data: [], total: 0, page, pageSize });
    }

    enrollmentWhere.OR = uniquePairs
      .filter((pair) => !gradeLevel || pair.slotGradeLevel === normalizeGradeKey(gradeLevel))
      .filter((pair) => !group || pair.slotGroup === normalizeGroupKey(group))
      .map((pair) => ({
        class: { gradeLevel: pair.slotGradeLevel as any },
        ...(pair.slotGroup && pair.slotGroup !== "-"
          ? { student: { studentGroup: { equals: pair.slotGroup, mode: "insensitive" as const } } }
          : {})
      }));

    if (!enrollmentWhere.OR.length) {
      return res.json({ data: [], total: 0, page, pageSize });
    }
  }
  if (group || student) {
    enrollmentWhere.student = {
      ...(group ? { studentGroup: { equals: group, mode: "insensitive" as const } } : {}),
      ...(student ? { fullName: { contains: student, mode: "insensitive" as const } } : {})
    };
  }

  const baseWhere: any = {
    enrollment: Object.keys(enrollmentWhere).length > 0 ? enrollmentWhere : undefined,
    ...(status ? { status: status as any } : {})
  };
  if (date) {
    const rawDate = new Date(date);
    if (!Number.isNaN(rawDate.getTime())) {
      const from = new Date(Date.UTC(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), rawDate.getUTCDate()));
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      baseWhere.date = { gte: from, lt: to };
    }
  }
  const where: any =
    !isTeacher && teacherId
      ? {
          ...baseWhere,
          OR: [
            {
              enrollment: {
                ...(Object.keys(enrollmentWhere).length > 0 ? enrollmentWhere : {}),
                class: {
                  ...((Object.keys(enrollmentWhere).length > 0 ? enrollmentWhere.class : {}) || {}),
                  teacherId
                }
              }
            },
            {
              ...(Object.keys(enrollmentWhere).length > 0 ? { enrollment: enrollmentWhere } : {}),
              notes: { contains: `[[teacherId:${teacherId}]]` }
            }
          ]
        }
      : baseWhere;
  const orderBy = isTeacher
    ? [{ date: "desc" as const }]
    : [
        { enrollment: { class: { gradeLevel: "asc" as const } } },
        { enrollment: { student: { studentGroup: "asc" as const } } },
        { enrollment: { student: { fullName: "asc" as const } } },
        { date: "desc" as const }
      ];

  const includePayload = {
    enrollment: {
      include: {
        student: true,
        class: { include: { teacher: { include: { user: { select: { fullName: true } } } } } }
      }
    }
  } as const;

  let data: any[] = [];
  let total = 0;
  if (paginateByDate) {
    const distinctDates = await prisma.attendance.findMany({
      where,
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" }
    });
    total = distinctDates.length;
    const selectedDates = distinctDates.slice((page - 1) * pageSize, page * pageSize).map((d) => d.date);
    if (selectedDates.length > 0) {
      data = await prisma.attendance.findMany({
        where: {
          ...where,
          date: { in: selectedDates }
        },
        include: includePayload,
        orderBy: [{ date: "desc" }, ...orderBy.filter((entry: any) => !("date" in entry))]
      });
    }
  } else {
    const result = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: includePayload,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.attendance.count({ where })
    ]);
    data = result[0];
    total = result[1];
  }
  const recordedTeacherIds = Array.from(
    new Set(
      data
        .map((item: any) => extractRecordedTeacherId(item.notes))
        .filter(Boolean)
    )
  );
  const recordedTeachers = recordedTeacherIds.length
    ? await prisma.teacher.findMany({
        where: { id: { in: recordedTeacherIds } },
        include: { user: { select: { fullName: true } } }
      })
    : [];
  const teachersById = new Map(recordedTeachers.map((t) => [t.id, t]));
  const mapped = data.map((item) => {
    const grade = getEnrollmentGradeLevel(item.enrollment);
    const groupName = String(item.enrollment?.student?.studentGroup || "");
    const recordedTeacherId = extractRecordedTeacherId((item as any).notes);
    const recordedTeacherName =
      (recordedTeacherId &&
        teachersById.get(recordedTeacherId)?.user?.fullName) ||
      item.enrollment?.class?.teacher?.user?.fullName ||
      "";
    return {
      ...item,
      grade,
      group: groupName,
      teacherName: recordedTeacherName
    };
  });
  res.json({ data: mapped, total, page, pageSize });
});

router.get("/attendance/export/excel", requireAuth, requireRole(["TEACHER", "ADMIN"]), async (req, res) => {
  const auth = (req as any).auth;
  const isTeacher = auth.role === "TEACHER";
  const teacher = isTeacher
    ? await prisma.teacher.findUnique({ where: { userId: auth.userId }, select: { id: true, subjectSchedules: true } })
    : null;
  if (isTeacher && !teacher) return res.status(404).json({ message: "Perfil docente no encontrado" });

  const validToday = String(req.query.validToday || "").trim() === "1";
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const group = String(req.query.group || "").trim();
  const student = String(req.query.student || "").trim();
  const teacherId = String(req.query.teacherId || "").trim();
  const date = String(req.query.date || "").trim();

  const classWhere: any = {};
  if (!isTeacher && teacherId) classWhere.teacherId = teacherId;
  if (gradeLevel) classWhere.gradeLevel = gradeLevel as any;

  const enrollmentWhere: any = {};
  if (!isTeacher && Object.keys(classWhere).length > 0) {
    enrollmentWhere.class = classWhere;
  }
  if (isTeacher) {
    const dayOfWeek = dayOfWeekInSpanishUpper();
    const slots = normalizeTeacherSlots(teacher!.subjectSchedules);
    const scopedSlots = validToday ? slots.filter((s) => s.dayOfWeek === dayOfWeek) : slots;
    const uniquePairs = Array.from(
      new Set(scopedSlots.map((s) => `${normalizeGradeKey(s.gradeLevel)}::${normalizeGroupKey(s.group || "")}`))
    ).map((key) => {
      const [slotGradeLevel, slotGroup] = key.split("::");
      return { slotGradeLevel, slotGroup };
    });

    if (uniquePairs.length === 0) {
      const branding = await getBrandingSettings();
      const xlsx = buildXlsxReportBuffer({
        title: "Asistencia",
        institutionName: branding.schoolName,
        columns: [
          { key: "student", label: "Estudiante" },
          { key: "teacher", label: "Docente" },
          { key: "grade", label: "Grado" },
          { key: "group", label: "Grupo" },
          { key: "date", label: "Fecha" },
          { key: "status", label: "Estado" }
        ],
        rows: []
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=\"asistencia.xlsx\"");
      return res.send(xlsx);
    }

    enrollmentWhere.OR = uniquePairs
      .filter((pair) => !gradeLevel || pair.slotGradeLevel === normalizeGradeKey(gradeLevel))
      .filter((pair) => !group || pair.slotGroup === normalizeGroupKey(group))
      .map((pair) => ({
        class: { gradeLevel: pair.slotGradeLevel as any },
        ...(pair.slotGroup && pair.slotGroup !== "-"
          ? { student: { studentGroup: { equals: pair.slotGroup, mode: "insensitive" as const } } }
          : {})
      }));

    if (!enrollmentWhere.OR.length) {
      const branding = await getBrandingSettings();
      const xlsx = buildXlsxReportBuffer({
        title: "Asistencia",
        institutionName: branding.schoolName,
        columns: [
          { key: "student", label: "Estudiante" },
          { key: "teacher", label: "Docente" },
          { key: "grade", label: "Grado" },
          { key: "group", label: "Grupo" },
          { key: "date", label: "Fecha" },
          { key: "status", label: "Estado" }
        ],
        rows: []
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=\"asistencia.xlsx\"");
      return res.send(xlsx);
    }
  }
  if (group || student) {
    enrollmentWhere.student = {
      ...(group ? { studentGroup: { equals: group, mode: "insensitive" as const } } : {}),
      ...(student ? { fullName: { contains: student, mode: "insensitive" as const } } : {})
    };
  }

  const where: any = {
    enrollment: Object.keys(enrollmentWhere).length > 0 ? enrollmentWhere : undefined,
    ...(status ? { status: status as any } : {})
  };
  if (date) {
    const rawDate = new Date(date);
    if (!Number.isNaN(rawDate.getTime())) {
      const from = new Date(Date.UTC(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), rawDate.getUTCDate()));
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      where.date = { gte: from, lt: to };
    }
  }

  const orderBy = isTeacher
    ? [{ date: "desc" as const }]
    : [
        { enrollment: { class: { gradeLevel: "asc" as const } } },
        { enrollment: { student: { studentGroup: "asc" as const } } },
        { enrollment: { student: { fullName: "asc" as const } } },
        { date: "desc" as const }
      ];

  const data = await prisma.attendance.findMany({
    where,
    include: {
      enrollment: {
        include: {
          student: true,
          class: { include: { teacher: { include: { user: { select: { fullName: true } } } } } }
        }
      }
    },
    orderBy
  });

  const branding = await getBrandingSettings();
  const xlsx = buildXlsxReportBuffer({
    title: "Asistencia",
    institutionName: branding.schoolName,
    columns: [
      { key: "student", label: "Estudiante" },
      { key: "teacher", label: "Docente" },
      { key: "grade", label: "Grado" },
      { key: "group", label: "Grupo" },
      { key: "date", label: "Fecha" },
      { key: "status", label: "Estado" }
    ],
    rows: data.map((item) => ({
      student: item.enrollment?.student?.fullName || "",
      teacher: item.enrollment?.class?.teacher?.user?.fullName || "",
      grade: getEnrollmentGradeLevel(item.enrollment),
      group: item.enrollment?.student?.studentGroup || "",
      date: item.date?.toISOString?.().slice(0, 10) || "",
      status: item.status
    }))
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"asistencia.xlsx\"");
  res.send(xlsx);
});

router.get("/attendance/export/pdf", requireAuth, requireRole(["TEACHER", "ADMIN"]), async (req, res) => {
  const auth = (req as any).auth;
  const isTeacher = auth.role === "TEACHER";
  const teacher = isTeacher
    ? await prisma.teacher.findUnique({ where: { userId: auth.userId }, select: { id: true, subjectSchedules: true } })
    : null;
  if (isTeacher && !teacher) return res.status(404).json({ message: "Perfil docente no encontrado" });

  const validToday = String(req.query.validToday || "").trim() === "1";
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const group = String(req.query.group || "").trim();
  const student = String(req.query.student || "").trim();
  const teacherId = String(req.query.teacherId || "").trim();
  const date = String(req.query.date || "").trim();

  const classWhere: any = {};
  if (!isTeacher && teacherId) classWhere.teacherId = teacherId;
  if (gradeLevel) classWhere.gradeLevel = gradeLevel as any;

  const enrollmentWhere: any = {};
  if (!isTeacher && Object.keys(classWhere).length > 0) {
    enrollmentWhere.class = classWhere;
  }
  if (isTeacher) {
    const dayOfWeek = dayOfWeekInSpanishUpper();
    const slots = normalizeTeacherSlots(teacher!.subjectSchedules);
    const scopedSlots = validToday ? slots.filter((s) => s.dayOfWeek === dayOfWeek) : slots;
    const uniquePairs = Array.from(
      new Set(scopedSlots.map((s) => `${normalizeGradeKey(s.gradeLevel)}::${normalizeGroupKey(s.group || "")}`))
    ).map((key) => {
      const [slotGradeLevel, slotGroup] = key.split("::");
      return { slotGradeLevel, slotGroup };
    });

    if (uniquePairs.length === 0) {
      const branding = await getBrandingSettings();
      return sendTabularPdf(res, {
        fileName: "asistencia.pdf",
        title: "Asistencia",
        branding,
        columns: [
          { key: "student", label: "Estudiante", width: 130 },
          { key: "teacher", label: "Docente", width: 120 },
          { key: "grade", label: "Grado", width: 70, align: "center" },
          { key: "group", label: "Grupo", width: 60, align: "center" },
          { key: "date", label: "Fecha", width: 75, align: "center" },
          { key: "status", label: "Estado", width: 70, align: "center" }
        ],
        rows: []
      });
    }

    enrollmentWhere.OR = uniquePairs
      .filter((pair) => !gradeLevel || pair.slotGradeLevel === normalizeGradeKey(gradeLevel))
      .filter((pair) => !group || pair.slotGroup === normalizeGroupKey(group))
      .map((pair) => ({
        class: { gradeLevel: pair.slotGradeLevel as any },
        ...(pair.slotGroup && pair.slotGroup !== "-"
          ? { student: { studentGroup: { equals: pair.slotGroup, mode: "insensitive" as const } } }
          : {})
      }));

    if (!enrollmentWhere.OR.length) {
      const branding = await getBrandingSettings();
      return sendTabularPdf(res, {
        fileName: "asistencia.pdf",
        title: "Asistencia",
        branding,
        columns: [
          { key: "student", label: "Estudiante", width: 130 },
          { key: "teacher", label: "Docente", width: 120 },
          { key: "grade", label: "Grado", width: 70, align: "center" },
          { key: "group", label: "Grupo", width: 60, align: "center" },
          { key: "date", label: "Fecha", width: 75, align: "center" },
          { key: "status", label: "Estado", width: 70, align: "center" }
        ],
        rows: []
      });
    }
  }
  if (group || student) {
    enrollmentWhere.student = {
      ...(group ? { studentGroup: { equals: group, mode: "insensitive" as const } } : {}),
      ...(student ? { fullName: { contains: student, mode: "insensitive" as const } } : {})
    };
  }

  const where: any = {
    enrollment: Object.keys(enrollmentWhere).length > 0 ? enrollmentWhere : undefined,
    ...(status ? { status: status as any } : {})
  };
  if (date) {
    const rawDate = new Date(date);
    if (!Number.isNaN(rawDate.getTime())) {
      const from = new Date(Date.UTC(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), rawDate.getUTCDate()));
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      where.date = { gte: from, lt: to };
    }
  }

  const orderBy = isTeacher
    ? [{ date: "desc" as const }]
    : [
        { enrollment: { class: { gradeLevel: "asc" as const } } },
        { enrollment: { student: { studentGroup: "asc" as const } } },
        { enrollment: { student: { fullName: "asc" as const } } },
        { date: "desc" as const }
      ];

  const data = await prisma.attendance.findMany({
    where,
    include: {
      enrollment: {
        include: {
          student: true,
          class: { include: { teacher: { include: { user: { select: { fullName: true } } } } } }
        }
      }
    },
    orderBy
  });

  const branding = await getBrandingSettings();
  return sendTabularPdf(res, {
    fileName: "asistencia.pdf",
    title: "Asistencia",
    branding,
    columns: [
      { key: "student", label: "Estudiante", width: 130 },
      { key: "teacher", label: "Docente", width: 120 },
      { key: "grade", label: "Grado", width: 70, align: "center" },
      { key: "group", label: "Grupo", width: 60, align: "center" },
      { key: "date", label: "Fecha", width: 75, align: "center" },
      { key: "status", label: "Estado", width: 70, align: "center" }
    ],
    rows: data.map((item) => ({
      student: item.enrollment?.student?.fullName || "",
      teacher: item.enrollment?.class?.teacher?.user?.fullName || "",
      grade: getEnrollmentGradeLevel(item.enrollment),
      group: item.enrollment?.student?.studentGroup || "",
      date: item.date?.toISOString?.().slice(0, 10) || "",
      status: item.status
    }))
  });
});

router.get("/grades", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
  if (!teacher) return res.json([]);

  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const period = String(req.query.period || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const classWhere: any = { teacherId: teacher.id };
  if (gradeLevel) {
    classWhere.gradeLevel = gradeLevel as any;
  }
  const where: any = {
    enrollment: { class: classWhere },
    ...(period ? { period } : {})
  };
  const [data, total] = await Promise.all([
    prisma.grade.findMany({
      where,
      include: { enrollment: { include: { student: true, class: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.grade.count({ where })
  ]);
  const mapped = data.map((item) => {
    const grade = getEnrollmentGradeLevel(item.enrollment);
    const groupName = String(item.enrollment?.student?.studentGroup || "");
    return {
      ...item,
      grade,
      group: groupName
    };
  });
  res.json({ data: mapped, total, page, pageSize });
});

router.get("/grades/final-summary", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
  if (!teacher) return res.json([]);

  const period = String(req.query.period || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const { group: groupRaw, mode: groupMode } = parseTaskGroup(String(req.query.group || ""));
  const allowedPairs = await resolveTeacherGradeGroups(auth.userId);
  if (!allowedPairs.length) return res.json([]);

  const normalizedGrade = normalizeGradeKey(gradeLevel);
  const normalizedGroup = normalizeGroupKey(groupRaw);
  if (gradeLevel) {
    const isAllowed = allowedPairs.some((pair) => {
      const pairGrade = normalizeGradeKey(pair.gradeLevel);
      const pairGroup = normalizeGroupKey(pair.group || "");
      if (pairGrade !== normalizedGrade) return false;
      if (groupMode === "empty") {
        return !pairGroup || pairGroup === "-" || pairGroup === "SIN_GRUPO";
      }
      if (groupMode === "exact") {
        if (!pairGroup || pairGroup === "-" || pairGroup === "SIN_GRUPO") return true;
        return pairGroup === normalizedGroup;
      }
      return true;
    });
    if (!isAllowed) return res.status(403).json({ message: "No tienes permisos para este grado/grupo" });
  }

  const taskWhere: any = {
    teacherId: teacher.id,
    ...(period ? { period } : {}),
    ...(gradeLevel ? { gradeLevel: gradeLevel as any } : {})
  };
  if (groupMode === "exact") {
    taskWhere.group = { equals: groupRaw, mode: "insensitive" as const };
  } else if (groupMode === "empty") {
    taskWhere.group = null;
  }

  const scores = await prisma.taskScore.findMany({
    where: { task: taskWhere },
    include: { task: true, enrollment: { include: { student: true, class: true } } },
    orderBy: { createdAt: "desc" }
  });

  const byEnrollment = new Map<string, any>();
  for (const entry of scores) {
    if (entry.score === null || entry.score === undefined) continue;
    const taskMax = Number(entry.task?.maxScore || 0);
    if (!Number.isFinite(taskMax) || taskMax <= 0) continue;
    const pct = (Number(entry.score) / taskMax) * 100;
    const key = `${entry.enrollmentId}:${entry.task.period}`;
    if (!byEnrollment.has(key)) {
      byEnrollment.set(key, {
        enrollmentId: entry.enrollmentId,
        period: entry.task.period,
        student: entry.enrollment.student.fullName,
        grade: getEnrollmentGradeLevel(entry.enrollment),
        group: String(entry.enrollment?.student?.studentGroup || ""),
        cognitive: [] as number[],
        personal: [] as number[],
        social: [] as number[]
      });
    }
    const row = byEnrollment.get(key);
    if (entry.task.aspect === "COGNITIVE") row.cognitive.push(pct);
    if (entry.task.aspect === "PERSONAL") row.personal.push(pct);
    if (entry.task.aspect === "SOCIAL") row.social.push(pct);
  }

  const avg = (items: number[]) => (items.length ? items.reduce((s, n) => s + n, 0) / items.length : 0);
  const wc = teacher.cognitiveWeight;
  const wp = teacher.personalWeight;
  const ws = teacher.socialWeight;

  const data = Array.from(byEnrollment.values()).map((r) => {
    const cog = avg(r.cognitive);
    const per = avg(r.personal);
    const soc = avg(r.social);
    const final100 = (cog * wc + per * wp + soc * ws) / 100;
    return {
      enrollmentId: r.enrollmentId,
      period: r.period,
      student: r.student,
      grade: r.grade,
      cognitiveAvg: Number(cog.toFixed(2)),
      personalAvg: Number(per.toFixed(2)),
      socialAvg: Number(soc.toFixed(2)),
      finalOver100: Number(final100.toFixed(2)),
      finalOver5: Number((final100 / 20).toFixed(2))
    };
  });

  res.json(data);
});

router.get("/notifications", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();
  const where = { createdById: auth.userId, ...(status ? { status: status as any } : {}) };
  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notification.count({ where })
  ]);
  res.json({
    data: data.map((n) => ({
      ...n,
      legalReference: extractNotificationLegalReference(n.body),
      body: stripNotificationMeta(n.body)
    })),
    total,
    page,
    pageSize
  });
});

router.get("/admin-notifications", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();
  const where: any = {
    createdBy: { role: "ADMIN" },
    OR: [{ body: { contains: "[[audience:TEACHERS]]" } }, { body: { contains: "[[audience:BOTH]]" } }],
    ...(status ? { status: status as any } : {}),
    AND: [
      {
        OR: [{ targetUserId: null }, { targetUserId: auth.userId }]
      }
    ]
  };
  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notification.count({ where })
  ]);
  res.json({
    data: data.map((n) => ({
      ...n,
      body: stripNotificationMeta(n.body)
    })),
    total,
    page,
    pageSize
  });
});

router.get("/attendance/windows", requireAuth, requireRole(["TEACHER"]), async (req, res) => {
  const auth = (req as any).auth;
  const teacher = await prisma.teacher.findUnique({
    where: { userId: auth.userId },
    select: { subjectSchedules: true }
  });
  if (!teacher) return res.json({ dayOfWeek: dayOfWeekInSpanishUpper(), grades: [] });

  const dayOfWeek = dayOfWeekInSpanishUpper();
  const slotsToday = normalizeTeacherSlots(teacher.subjectSchedules).filter((s) => s.dayOfWeek === dayOfWeek);
  const uniqueGrades = Array.from(new Set(slotsToday.map((s) => s.gradeLevel)));
  const uniqueGroups = Array.from(
    new Set(
      slotsToday
        .filter((s) => String(s.group || "").trim() && String(s.group || "").trim() !== "-")
        .map((s) => `${s.gradeLevel}-${s.group}`)
    )
  );

  res.json({
    dayOfWeek,
    grades: uniqueGrades,
    gradeGroups: uniqueGroups
  });
});

export default router;
