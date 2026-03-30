import { Router } from "express";
import { Prisma, type AdmissionStatus, type InvoiceStatus } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import PDFDocument from "pdfkit";
import XLSX from "xlsx";
import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { buildCsvReport, buildXlsxReportBuffer, sendTabularPdf } from "../utils/reportExport.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";
import { createCertificateRequestSchema, reviewCertificateRequestSchema } from "../schemas/certificates.js";
import { validate } from "../utils/validate.js";
import { composeNotificationBodyWithMeta } from "../utils/notificationMeta.js";

const router = Router();
const CERT_REQUEST_APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const importHistoryPath = path.resolve(__dirname, "..", "data", "import-history.json");

async function readImportHistory() {
  try {
    const raw = await fs.readFile(importHistoryPath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeImportHistory(entries: any[]) {
  await fs.mkdir(path.dirname(importHistoryPath), { recursive: true });
  await fs.writeFile(importHistoryPath, JSON.stringify(entries, null, 2));
}

function classGradeLevelValue(classEntity: any) {
  return String(classEntity?.gradeLevel || "").trim();
}
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

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDateParam(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildDateFilter(from?: Date | null, to?: Date | null) {
  if (!from && !to) return null;
  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    filter.gte = start;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return filter;
}

async function loadAlertsReportData(params: { status?: string; from?: Date | null; to?: Date | null }) {
  const statusRaw = String(params.status || "").trim().toUpperCase();
  const status = ["PENDING", "APPROVED", "REJECTED"].includes(statusRaw) ? statusRaw : "";
  const dateFilter = buildDateFilter(params.from || null, params.to || null);
  const includeOperational = !status || status === "PENDING";
  const now = new Date();

  const [admissions, notifications, certificateRequests, invoices, followUps, pendingParents, branding] =
    await Promise.all([
      prisma.admission.findMany({
        where: {
          enrollment: null,
          ...(status ? { status: status as any } : {}),
          ...(status === "APPROVED"
            ? {
                OR: [{ enrollmentDueAt: null }, { enrollmentDueAt: { gte: now } }]
              }
            : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {})
        },
        orderBy: { createdAt: "desc" },
        take: 200
      }),
      prisma.notification.findMany({
        where: {
          ...(status ? { status: status as any } : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {})
        },
        include: {
          student: { select: { fullName: true } },
          targetUser: { select: { fullName: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 200
      }),
      prisma.certificateRequest.findMany({
        where: {
          ...(status ? { status: status as any } : {}),
          ...(dateFilter ? { requestedAt: dateFilter } : {})
        },
        include: {
          student: { select: { fullName: true } },
          requestedBy: { select: { fullName: true } }
        },
        orderBy: { requestedAt: "desc" },
        take: 200
      }),
      includeOperational
        ? prisma.invoice.findMany({
            where: {
              status: "PENDING",
              ...(dateFilter ? { dueDate: dateFilter } : {})
            },
            include: { student: { select: { fullName: true } } },
            orderBy: { dueDate: "asc" },
            take: 200
          })
        : Promise.resolve([]),
      includeOperational
        ? prisma.studentObservation.findMany({
            where: {
              followUpCompleted: false,
              followUpDate: {
                not: null,
                ...(dateFilter ? dateFilter : {})
              }
            },
            include: {
              student: { select: { fullName: true, gradeLevel: true } }
            },
            orderBy: { followUpDate: "asc" },
            take: 200
          })
        : Promise.resolve([]),
      includeOperational
        ? (async () => {
            const [enrollments, parentUsers] = await Promise.all([
              prisma.enrollment.findMany({
                where: { status: { not: "INACTIVE" } },
                select: {
                  guardianFullName: true,
                  guardianDocNumber: true,
                  contactEmail: true,
                  guardianRelation: true,
                  student: { select: { id: true, fullName: true } }
                },
                orderBy: [{ year: "desc" }, { studentFullName: "asc" }]
              }),
              prisma.user.findMany({
                where: { role: "PARENT" },
                select: {
                  fullName: true,
                  email: true,
                  parent: {
                    select: {
                      guardians: {
                        select: { studentId: true }
                      }
                    }
                  }
                }
              })
            ]);

            const bucketByKey = new Map<
              string,
              {
                guardianFullName: string;
                guardianDocNumber: string;
                contactEmail: string;
                relation: string;
                students: Array<{ studentId: string; studentName: string }>;
              }
            >();

            for (const e of enrollments) {
              const name = String(e.guardianFullName || "").trim();
              const doc = String(e.guardianDocNumber || "").trim();
              const email = String(e.contactEmail || "").trim().toLowerCase();
              if (!name && !doc && !email) continue;

              const key = doc ? `doc:${doc.toLowerCase()}` : email ? `email:${email}` : `name:${name.toLowerCase()}`;

              const current = bucketByKey.get(key) || {
                guardianFullName: name || "Sin nombre",
                guardianDocNumber: doc || "",
                contactEmail: email || "",
                relation: String(e.guardianRelation || "").trim() || "Acudiente",
                students: []
              };

              const studentId = String(e.student?.id || "");
              if (studentId && !current.students.some((s) => s.studentId === studentId)) {
                current.students.push({
                  studentId,
                  studentName: String(e.student?.fullName || "")
                });
              }
              bucketByKey.set(key, current);
            }

            const parentEmails = new Set(parentUsers.map((p) => normalizeText(p.email || "")).filter(Boolean));
            const parentNames = new Set(parentUsers.map((p) => normalizeText(p.fullName || "")).filter(Boolean));
            const parentStudentIds = new Set(
              parentUsers.flatMap((p) => (p.parent?.guardians || []).map((g) => g.studentId)).filter(Boolean)
            );

            return Array.from(bucketByKey.values())
              .filter((entry) => {
                const byEmail = entry.contactEmail ? parentEmails.has(normalizeText(entry.contactEmail)) : false;
                const byName = entry.guardianFullName ? parentNames.has(normalizeText(entry.guardianFullName)) : false;
                const byStudentLink = entry.students.some((s) => parentStudentIds.has(s.studentId));
                return !byEmail && !byName && !byStudentLink;
              })
              .map((entry) => ({
                guardianFullName: entry.guardianFullName,
                contactEmail: entry.contactEmail,
                relation: entry.relation,
                studentsCount: entry.students.length
              }))
              .sort((a, b) => a.guardianFullName.localeCompare(b.guardianFullName, "es"));
          })()
        : Promise.resolve([]),
      getBrandingSettings()
    ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueInvoices = (invoices as any[]).filter((inv) => {
    if (!inv?.dueDate) return false;
    const due = new Date(inv.dueDate);
    return !Number.isNaN(due.getTime()) && due < today;
  });

  const rows: Array<{ tipo: string; detalle: string; responsable: string; fecha: string; estado: string }> = [];

  admissions.forEach((a) => {
    rows.push({
      tipo: "Admision",
      detalle: `${a.studentName} (${gradeLabelShort(a.gradeLevel)})`,
      responsable: "-",
      fecha: a.createdAt ? a.createdAt.toISOString().slice(0, 10) : "-",
      estado: a.status
    });
  });

  notifications.forEach((n) => {
    const target = n.student?.fullName || n.targetUser?.fullName || "-";
    rows.push({
      tipo: "Notificacion",
      detalle: n.title || "-",
      responsable: target,
      fecha: n.createdAt ? n.createdAt.toISOString().slice(0, 10) : "-",
      estado: n.status
    });
  });

  certificateRequests.forEach((c) => {
    rows.push({
      tipo: "Certificado",
      detalle: c.type === "STUDY" ? "Constancia de estudio" : "Certificado de matricula",
      responsable: c.student?.fullName || "-",
      fecha: c.requestedAt ? c.requestedAt.toISOString().slice(0, 10) : "-",
      estado: c.status
    });
  });

  overdueInvoices.forEach((inv) => {
    rows.push({
      tipo: "Factura",
      detalle: `Factura ${inv.id}`,
      responsable: inv.student?.fullName || "-",
      fecha: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "-",
      estado: "VENCIDA"
    });
  });

  (followUps as any[]).forEach((f) => {
    const detail = String(f.detail || "").slice(0, 80);
    rows.push({
      tipo: "Seguimiento",
      detalle: detail || "-",
      responsable: f.student?.fullName || "-",
      fecha: f.followUpDate ? new Date(f.followUpDate).toISOString().slice(0, 10) : "-",
      estado: "PENDIENTE"
    });
  });

  (pendingParents as any[]).forEach((p) => {
    rows.push({
      tipo: "Acudiente",
      detalle: `${p.guardianFullName} (${p.relation || "Acudiente"})`,
      responsable: p.contactEmail || "-",
      fecha: "-",
      estado: "SIN CUENTA"
    });
  });

  const subtitleParts = [];
  if (status) subtitleParts.push(`Estado: ${status}`);
  if (params.from) subtitleParts.push(`Desde: ${params.from.toISOString().slice(0, 10)}`);
  if (params.to) subtitleParts.push(`Hasta: ${params.to.toISOString().slice(0, 10)}`);

  return {
    rows,
    branding,
    subtitle: subtitleParts.length ? subtitleParts.join(" | ") : undefined
  };
}

function surnameKey(fullName: string) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 4) return normalizeText(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
  if (parts.length >= 2) return normalizeText(parts[parts.length - 1]);
  return normalizeText(fullName);
}

function sortStudentsForExport<T extends { fullName: string; gradeLevel: string }>(students: T[]) {
  return [...students].sort((a, b) => {
    const ga = gradeOrder[a.gradeLevel] ?? 999;
    const gb = gradeOrder[b.gradeLevel] ?? 999;
    if (ga !== gb) return ga - gb;
    const sa = surnameKey(a.fullName);
    const sb = surnameKey(b.fullName);
    if (sa !== sb) return sa.localeCompare(sb, "es");
    return normalizeText(a.fullName).localeCompare(normalizeText(b.fullName), "es");
  });
}

function studentsWhereFromQuery(req: any): Prisma.StudentWhereInput {
  const search = String(req.query.search || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  return {
    ...(search ? { fullName: { contains: search, mode: "insensitive" } } : {}),
    ...(gradeLevel ? { gradeLevel: gradeLevel as any } : {})
  };
}

function attendanceStatusSymbol(status: string) {
  if (status === "PRESENT") return "P";
  if (status === "ABSENT") return "A";
  if (status === "LATE") return "T";
  if (status === "EXCUSED") return "J";
  return "";
}

function certificateTypeLabel(type: "STUDY" | "ENROLLMENT") {
  return type === "STUDY" ? "Constancia de estudio" : "Certificado de matricula";
}

function formatDateOnly(date?: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function calculateAge(birthDate?: Date | null) {
  if (!birthDate) return "";
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return String(age);
}

function gradeLabelShort(grade?: string) {
  const map: Record<string, string> = {
    PRE_JARDIN: "Pre Jardin",
    JARDIN: "Jardin",
    TRANSICION: "Transicion",
    PRIMERO: "1",
    SEGUNDO: "2",
    TERCERO: "3",
    CUARTO: "4",
    QUINTO: "5",
    SEXTO: "6",
    SEPTIMO: "7",
    OCTAVO: "8",
    NOVENO: "9",
    DECIMO: "10",
    ONCE: "11"
  };
  if (!grade) return "";
  return map[grade] || grade;
}

async function assertParentCanAccessStudent(auth: { userId: string; role: string }, studentId: string) {
  if (auth?.role !== "PARENT") return true;
  const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
  if (!parent) return false;
  const guardian = await prisma.guardian.findFirst({
    where: { parentId: parent.id, studentId }
  });
  return Boolean(guardian);
}

async function resolveCertificateIssuer(
  auth: { userId: string; role: string },
  studentId: string,
  type: "STUDY" | "ENROLLMENT"
) {
  if (auth.role === "ADMIN") {
    return { allowed: true, issuedById: auth.userId };
  }

  const latest = await prisma.certificateRequest.findFirst({
    where: {
      studentId,
      requestedById: auth.userId,
      type
    },
    orderBy: { reviewedAt: "desc" },
    select: { reviewedById: true, status: true, reviewedAt: true }
  });

  const isApprovedActive =
    latest?.status === "APPROVED" &&
    latest.reviewedAt &&
    Date.now() - latest.reviewedAt.getTime() <= CERT_REQUEST_APPROVAL_WINDOW_MS;

  if (!isApprovedActive) return { allowed: false, issuedById: auth.userId };
  return { allowed: true, issuedById: latest.reviewedById || auth.userId };
}

async function issueCertificate(params: {
  type: "STUDY" | "ENROLLMENT";
  studentId: string;
  issuedById: string;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const issued = await prisma.$transaction(async (tx) => {
    const latest = await tx.certificateIssue.findFirst({
      where: { type: params.type, year },
      orderBy: { serial: "desc" },
      select: { serial: true }
    });
    const serial = Number(latest?.serial || 0) + 1;
    const code = `${params.type.slice(0, 1)}-${year}-${serial}-${randomUUID().slice(0, 8)}`.toUpperCase();
    return tx.certificateIssue.create({
      data: {
        type: params.type,
        serial,
        year,
        code,
        studentId: params.studentId,
        issuedById: params.issuedById
      }
    });
  });
  return issued;
}

async function buildAttendanceByStudentMatrix() {
  const [enrollments, attendance] = await Promise.all([
    prisma.enrollment.findMany({
      include: {
        student: true,
        class: true
      }
    }),
    prisma.attendance.findMany({
      include: {
        enrollment: {
          include: {
            class: true
          }
        }
      }
    })
  ]);

  const dates = Array.from(new Set(attendance.map((item) => item.date.toISOString().slice(0, 10)))).sort();
  const statusByEnrollmentDate = new Map<string, string>();
  attendance.forEach((item) => {
    const date = item.date.toISOString().slice(0, 10);
    statusByEnrollmentDate.set(`${item.enrollmentId}::${date}`, String(item.status || ""));
  });

  const rows = [...enrollments]
    .sort((a, b) => {
      const ga = gradeOrder[classGradeLevelValue(a.class)] ?? 999;
      const gb = gradeOrder[classGradeLevelValue(b.class)] ?? 999;
      if (ga !== gb) return ga - gb;
      const groupA = String(a.student?.studentGroup || "");
      const groupB = String(b.student?.studentGroup || "");
      if (groupA !== groupB) return groupA.localeCompare(groupB, "es", { numeric: true });
      return String(a.student?.fullName || "").localeCompare(String(b.student?.fullName || ""), "es");
    })
    .map((enr) => {
      const row: Record<string, string> = {
        gradeLevel: classGradeLevelValue(enr.class),
        group: String(enr.student?.studentGroup || ""),
        student: String(enr.student?.fullName || "")
      };
      dates.forEach((d) => {
        const key = `${enr.id}::${d}`;
        row[d] = attendanceStatusSymbol(statusByEnrollmentDate.get(key) || "");
      });
      return row;
    });

  return { dates, rows };
}

// Reporte: resumen de calificaciones por grado
router.get("/grades-summary", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (_req, res) => {
  const grades = await prisma.grade.findMany({
    select: { score: true, maxScore: true, enrollment: { select: { class: { select: { gradeLevel: true } } } } }
  });

  const map = new Map<string, { grade: string; avg: number; count: number }>();
  for (const g of grades) {
    const gradeLevel = classGradeLevelValue(g.enrollment.class);
    const pct = g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0;
    const entry = map.get(gradeLevel) || { grade: gradeLevel, avg: 0, count: 0 };
    entry.avg = (entry.avg * entry.count + pct) / (entry.count + 1);
    entry.count += 1;
    map.set(gradeLevel, entry);
  }

  res.json(Array.from(map.values()));
});

// Reporte: resumen de asistencia global
router.get("/attendance-summary", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (_req, res) => {
  const total = await prisma.attendance.count();
  const present = await prisma.attendance.count({ where: { status: "PRESENT" } });
  const absent = await prisma.attendance.count({ where: { status: "ABSENT" } });
  const late = await prisma.attendance.count({ where: { status: "LATE" } });
  const excused = await prisma.attendance.count({ where: { status: "EXCUSED" } });
  res.json({ total, present, absent, late, excused });
});

router.get("/attendance-grade-dates-excel", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const { dates, rows } = await buildAttendanceByStudentMatrix();

  const columns: Array<{ key: string; label: string }> = [
    { key: "gradeLevel", label: "Grado" },
    { key: "group", label: "Grupo" },
    { key: "student", label: "Estudiante" },
    ...dates.map((d) => ({ key: d, label: d }))
  ];

  const branding = await getBrandingSettings();
  const xlsx = buildXlsxReportBuffer({
    title: "Reporte de Asistencia por Fechas (Matriz)",
    institutionName: branding.schoolName,
    columns,
    rows
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"asistencia-por-grado-fechas.xlsx\"");
  res.send(xlsx);
});

router.get("/attendance-grade-dates-pdf", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const { dates, rows } = await buildAttendanceByStudentMatrix();

  const dynamicDateColumns = dates.map((d) => ({
    key: d,
    label: d.slice(5),
    width: 28,
    align: "center" as const
  }));

  const branding = await getBrandingSettings();
  sendTabularPdf(res, {
    fileName: "asistencia-por-grado-fechas.pdf",
    title: "Reporte de Asistencia por Fechas (Matriz)",
    branding,
    columns: [
      { key: "gradeLevel", label: "Grado", width: 70, align: "center" },
      { key: "group", label: "Grupo", width: 45, align: "center" },
      { key: "student", label: "Estudiante", width: 140 },
      ...dynamicDateColumns
    ],
    rows
  });
});

// Reporte: resumen financiero
router.get("/finance-summary", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const invoices = await prisma.invoice.findMany({ select: { amount: true, status: true } });
  const total = invoices.reduce((sum, i) => sum + i.amount, 0);
  const pending = invoices.filter((i) => i.status === "PENDING").reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + i.amount, 0);
  const paid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);
  res.json({ total, paid, pending, overdue });
});

router.get("/finance-csv", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { student: true },
    orderBy: { createdAt: "desc" }
  });
  const branding = await getBrandingSettings();
  const csv = buildCsvReport({
    title: "Reporte Financiero",
    institutionName: branding.schoolName,
    columns: [
      { key: "id", label: "Factura" },
      { key: "student", label: "Estudiante" },
      { key: "amount", label: "Monto" },
      { key: "status", label: "Estado" },
      { key: "dueDate", label: "Vence" }
    ],
    rows: invoices.map((i) => ({
      id: i.id,
      student: i.student.fullName,
      amount: i.amount.toFixed(2),
      status: i.status,
      dueDate: i.dueDate.toISOString().slice(0, 10)
    }))
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"finance-report.csv\"");
  res.send(csv);
});

router.get("/finance-excel", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { student: true },
    orderBy: { createdAt: "desc" }
  });
  const branding = await getBrandingSettings();
  const xlsx = buildXlsxReportBuffer({
    title: "Reporte Financiero",
    institutionName: branding.schoolName,
    columns: [
      { key: "id", label: "Factura" },
      { key: "student", label: "Estudiante" },
      { key: "amount", label: "Monto" },
      { key: "status", label: "Estado" },
      { key: "dueDate", label: "Vence" }
    ],
    rows: invoices.map((i) => ({
      id: i.id,
      student: i.student.fullName,
      amount: i.amount.toFixed(2),
      status: i.status,
      dueDate: i.dueDate.toISOString().slice(0, 10)
    }))
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"finance-report.xlsx\"");
  res.send(xlsx);
});

router.get("/finance-pdf", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { student: true },
    orderBy: { createdAt: "desc" }
  });
  const branding = await getBrandingSettings();
  sendTabularPdf(res, {
    fileName: "finance-report.pdf",
    title: "Reporte Financiero",
    branding,
    columns: [
      { key: "id", label: "Factura", width: 105 },
      { key: "student", label: "Estudiante", width: 170 },
      { key: "amount", label: "Monto", width: 80, align: "right" },
      { key: "status", label: "Estado", width: 80, align: "center" },
      { key: "dueDate", label: "Vence", width: 80, align: "center" }
    ],
    rows: invoices.map((i) => ({
      id: i.id,
      student: i.student.fullName,
      amount: i.amount.toFixed(2),
      status: i.status,
      dueDate: i.dueDate.toISOString().slice(0, 10)
    }))
  });
});

router.get("/students-csv", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const where = studentsWhereFromQuery(req);
  const studentsRaw = await prisma.student.findMany({
    where,
    select: { id: true, fullName: true, gradeLevel: true, birthDate: true, isActive: true, createdAt: true },
    orderBy: [{ gradeLevel: "asc" }, { fullName: "asc" }]
  });
  const students = sortStudentsForExport(studentsRaw);
  const branding = await getBrandingSettings();

  const csv = buildCsvReport({
    title: "Reporte de Estudiantes",
    institutionName: branding.schoolName,
    columns: [
      { key: "fullName", label: "Nombre" },
      { key: "gradeLevel", label: "Nivel" },
      { key: "birthDate", label: "Nacimiento" },
      { key: "isActive", label: "Estado" },
      { key: "createdAt", label: "Registro" }
    ],
    rows: students.map((s) => ({
      fullName: s.fullName,
      gradeLevel: s.gradeLevel,
      birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : "-",
      isActive: s.isActive ? "Activo" : "Inactivo",
      createdAt: s.createdAt.toISOString().slice(0, 10)
    }))
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"students-report.csv\"");
  res.send(csv);
});

router.get("/students-excel", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const where = studentsWhereFromQuery(req);
  const studentsRaw = await prisma.student.findMany({
    where,
    select: { fullName: true, gradeLevel: true, birthDate: true, isActive: true, createdAt: true },
    orderBy: [{ gradeLevel: "asc" }, { fullName: "asc" }]
  });
  const students = sortStudentsForExport(studentsRaw);
  const branding = await getBrandingSettings();
  const xlsx = buildXlsxReportBuffer({
    title: "Reporte de Estudiantes",
    institutionName: branding.schoolName,
    columns: [
      { key: "fullName", label: "Nombre" },
      { key: "gradeLevel", label: "Nivel" },
      { key: "birthDate", label: "Nacimiento" },
      { key: "isActive", label: "Estado" },
      { key: "createdAt", label: "Registro" }
    ],
    rows: students.map((s) => ({
      fullName: s.fullName,
      gradeLevel: s.gradeLevel,
      birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : "-",
      isActive: s.isActive ? "Activo" : "Inactivo",
      createdAt: s.createdAt.toISOString().slice(0, 10)
    }))
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"students-report.xlsx\"");
  res.send(xlsx);
});

router.get("/students-pdf", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const where = studentsWhereFromQuery(req);
  const studentsRaw = await prisma.student.findMany({
    where,
    select: { id: true, fullName: true, gradeLevel: true, birthDate: true, isActive: true },
    orderBy: [{ gradeLevel: "asc" }, { fullName: "asc" }]
  });
  const students = sortStudentsForExport(studentsRaw);
  const branding = await getBrandingSettings();

  sendTabularPdf(res, {
    fileName: "students-report.pdf",
    title: "Reporte de Estudiantes",
    branding,
    columns: [
      { key: "fullName", label: "Nombre", width: 200 },
      { key: "gradeLevel", label: "Nivel", width: 90, align: "center" },
      { key: "birthDate", label: "Nacimiento", width: 90, align: "center" },
      { key: "isActive", label: "Estado", width: 90, align: "center" }
    ],
    rows: students.map((s) => ({
      fullName: s.fullName,
      gradeLevel: s.gradeLevel,
      birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : "-",
      isActive: s.isActive ? "Activo" : "Inactivo"
    }))
  });
});

const reportCardSubjectPriority = [
  "Lengua Castellana",
  "Matematicas",
  "Ciencias Naturales",
  "Ciencias Sociales",
  "Idiomas Extranjeros",
  "Tecnologia e Informatica",
  "Educacion Artistica",
  "Educacion Fisica",
  "Educacion Etica y en Valores Humanos",
  "Educacion Ambiental",
  "Educacion Religiosa",
  "Historia",
  "Geografia",
  "Constitucion Politica y Democracia",
  "Fisica",
  "Quimica",
  "Geometria",
  "Comprension Lectora"
];
const normalizeReportSubject = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const reportCardSubjectPriorityIndex = new Map(
  reportCardSubjectPriority.map((name, index) => [normalizeReportSubject(name), index])
);
const normalizeReportGradeKey = (value: unknown) => String(value || "").trim().toUpperCase();
const normalizeReportGroupKey = (value: unknown) => String(value || "").trim().toUpperCase();

// Reporte: boletin en PDF
router.get("/report-card/:studentId", requireAuth, requireRole(["ADMIN", "TEACHER", "PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const canAccess = await assertParentCanAccessStudent(auth, req.params.studentId);
  if (!canAccess) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const periodFilter = String(req.query.period || "").trim();

  const student = await prisma.student.findUnique({
    where: { id: req.params.studentId },
    include: {
      enrollments: {
        include: {
          class: true,
          grades: true
        }
      }
    }
  });

  if (!student) return res.status(404).json({ error: "Student not found" });

  const sortedEnrollments = [...student.enrollments].sort((a, b) => (b.year || 0) - (a.year || 0));
  const targetEnrollments = sortedEnrollments.length > 0 ? [sortedEnrollments[0]] : [];
  const baseEnrollment = targetEnrollments[0];
  const studentGrade = baseEnrollment ? classGradeLevelValue(baseEnrollment.class) : student.gradeLevel;
  const studentGroup = String(student.studentGroup || "");
  const studentCode = String(baseEnrollment?.studentDocNumber || student.id || "");
  const schoolYear = baseEnrollment?.year ? String(baseEnrollment.year) : "";
  const studentGradeKey = normalizeReportGradeKey(studentGrade);
  const studentGroupKey = normalizeReportGroupKey(studentGroup);

  const teachers = await prisma.teacher.findMany({
    select: { subjectSchedules: true }
  });

  const scheduledSubjects = new Map<string, string>();
  teachers.forEach((teacher) => {
    const schedulesMap =
      teacher.subjectSchedules && typeof teacher.subjectSchedules === "object"
        ? (teacher.subjectSchedules as Record<string, unknown>)
        : {};
    Object.entries(schedulesMap).forEach(([subject, entry]) => {
      const subjectName = String(subject || "").trim();
      if (!subjectName) return;
      const slots = Array.isArray(entry)
        ? entry
        : entry && typeof entry === "object"
        ? [entry]
        : [];
      slots.forEach((slot: any) => {
        const gradeKey = normalizeReportGradeKey(slot?.gradeLevel);
        if (!gradeKey || gradeKey !== studentGradeKey) return;
        const slotGroup = normalizeReportGroupKey(slot?.group);
        if (studentGroupKey && slotGroup && slotGroup !== studentGroupKey) return;
        const norm = normalizeReportSubject(subjectName);
        if (!scheduledSubjects.has(norm)) scheduledSubjects.set(norm, subjectName);
      });
    });
  });

  const subjectList = Array.from(scheduledSubjects.entries())
    .map(([norm, name]) => ({ norm, name }))
    .sort((a, b) => {
      const idxA = reportCardSubjectPriorityIndex.get(a.norm);
      const idxB = reportCardSubjectPriorityIndex.get(b.norm);
      if (idxA !== undefined && idxB !== undefined && idxA !== idxB) return idxA - idxB;
      if (idxA !== undefined && idxB === undefined) return -1;
      if (idxA === undefined && idxB !== undefined) return 1;
      return a.name.localeCompare(b.name, "es");
    });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"boletin-${student.id}.pdf\"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  const leftMargin = doc.page.margins.left;
  const rightMargin = doc.page.width - doc.page.margins.right;
  const sectionTitle = (title: string) => {
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).text(title, leftMargin);
    doc.moveDown(0.2);
  };
  const labelValue = (label: string, value: string, y: number, x = leftMargin, labelWidth = 80, totalWidth = 250) => {
    doc.font("Helvetica-Bold").fontSize(10).text(label, x, y, { width: labelWidth });
    doc.font("Helvetica").fontSize(10).text(value || "", x + labelWidth, y, { width: totalWidth - labelWidth });
  };

  doc.font("Helvetica-Bold").fontSize(18).text("Boletín de Calificaciones", { align: "center" });
  doc.moveDown(0.3);
  doc.strokeColor("#e2e8f0").moveTo(leftMargin, doc.y).lineTo(rightMargin, doc.y).stroke();
  sectionTitle("Información del Estudiante");

  const infoStartY = doc.y;
  const infoColWidth = 250;
  const infoGap = 12;
  labelValue("Nombre:", student.fullName, infoStartY, leftMargin, 70, infoColWidth);
  labelValue("Grado:", studentGrade || "", infoStartY, leftMargin + infoColWidth + infoGap, 60, infoColWidth);
  labelValue("Grupo:", studentGroup || "", infoStartY + 16, leftMargin, 60, infoColWidth);
  labelValue("Código:", studentCode, infoStartY + 16, leftMargin + infoColWidth + infoGap, 70, infoColWidth);
  labelValue("Año Lectivo:", schoolYear, infoStartY + 32, leftMargin, 90, infoColWidth);
  labelValue("Periodo:", periodFilter || "", infoStartY + 32, leftMargin + infoColWidth + infoGap, 70, infoColWidth);
  doc.moveDown(2.2);


  const performanceLabel = (score: number, maxScore: number) => {
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return "";
    const normalized = (score / maxScore) * 5;
    if (normalized >= 4.6) return "Superior";
    if (normalized >= 4.0) return "Alto";
    if (normalized >= 3.0) return "Básico";
    return "Bajo";
  };

  targetEnrollments.forEach((enr) => {
    const periodGrades = periodFilter ? enr.grades.filter((g) => g.period === periodFilter) : enr.grades;
    const bySubject = new Map<string, typeof periodGrades>();
    sectionTitle("Calificaciones");
    const tableX = doc.x;
    const tableY = doc.y;
    const colWidths = [240, 90, 140];
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Asignatura", tableX, tableY, { width: colWidths[0] });
    doc.text("Nota", tableX + colWidths[0], tableY, { width: colWidths[1], align: "center" });
    doc.text("Desempeño", tableX + colWidths[0] + colWidths[1], tableY, { width: colWidths[2], align: "center" });

    let rowY = tableY + 18;
    doc.font("Helvetica").fontSize(10);

    periodGrades.forEach((g) => {
      const key = normalizeReportSubject(String(g.name || "").trim());
      if (!key) return;
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key)!.push(g);
    });

    if (subjectList.length === 0) {
      doc.text("Sin asignaturas configuradas.", tableX, rowY);
      rowY += 18;
    } else {
      subjectList.forEach((subject) => {
        const items = bySubject.get(subject.norm) || [];
        if (items.length === 0) {
          doc.text(subject.name, tableX, rowY, { width: colWidths[0] });
          doc.text("-", tableX + colWidths[0], rowY, { width: colWidths[1], align: "center" });
          doc.text("", tableX + colWidths[0] + colWidths[1], rowY, { width: colWidths[2], align: "center" });
          rowY += 18;
          return;
        }
        const base = items[0];
        const maxScore = Number(base?.maxScore || 0);
        const normalized = items.map((g) => (Number(g.maxScore) > 0 ? (Number(g.score) / Number(g.maxScore)) * maxScore : 0));
        const finalScore = normalized.length
          ? normalized.reduce((sum, n) => sum + n, 0) / normalized.length
          : 0;
        doc.text(subject.name, tableX, rowY, { width: colWidths[0] });
        doc.text(`${finalScore.toFixed(2)}/${maxScore}`, tableX + colWidths[0], rowY, { width: colWidths[1], align: "center" });
        doc.text(performanceLabel(finalScore, maxScore), tableX + colWidths[0] + colWidths[1], rowY, { width: colWidths[2], align: "center" });
        rowY += 18;
      });
    }

    doc.moveDown(2);

    const subjectScores = subjectList.map((subject) => {
      const items = bySubject.get(subject.norm) || [];
      if (items.length === 0) return 0;
      const base = items[0];
      const maxScore = Number(base?.maxScore || 0);
      const normalized = items.map((g) => (Number(g.maxScore) > 0 ? (Number(g.score) / Number(g.maxScore)) * maxScore : 0));
      const finalScore = normalized.length ? normalized.reduce((sum, n) => sum + n, 0) / normalized.length : 0;
      return maxScore > 0 ? (finalScore / maxScore) * 5 : 0;
    });
    const avgOverall = subjectScores.length
      ? subjectScores.reduce((sum, n) => sum + n, 0) / subjectScores.length
      : 0;

    sectionTitle("Resumen Académico");
    doc.font("Helvetica").fontSize(10);
    doc.text(`Promedio General: ${avgOverall.toFixed(2)}`);
    doc.text("Grupo: " + (studentGroup || "Sin grupo"));
    doc.text("Puesto: __________");
    doc.text("Asistencia");
    doc.text("Faltas: __________    Justificadas: __________    Injustificadas: __________");
    doc.text("Comportamiento");
    doc.text("Nivel: __________");
    doc.text("Observación: __________________________");
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(10).text("Observaciones Generales");
    doc.font("Helvetica").fontSize(10);
    doc.text("________________________________________________________");
    doc.text("________________________________________________________");
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(10).text("Firmas");
    doc.font("Helvetica").fontSize(10);
    doc.text("Coordinador: ______________________");
    doc.text("Acudiente: ______________________");
  });

  doc.end();
});

router.get("/convivencia/protocolos", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (_req, res) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"protocolos-convivencia.pdf\"");

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  const branding = await getBrandingSettings();
  doc.font("Helvetica-Bold").fontSize(14).text("PROTOCOLOS DE ATENCION - RUTA DE CONVIVENCIA ESCOLAR", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).text(
    `${branding.schoolName || "Institucion Educativa"} | Ley 1620 de 2013 y Decreto 1965 de 2013`,
    { align: "center" }
  );
  doc.moveDown(1);

  const section = (title: string) => {
    doc.font("Helvetica-Bold").fontSize(12).text(title);
    doc.moveDown(0.4);
  };
  const bullet = (text: string) => {
    doc.font("Helvetica").fontSize(10).text(`- ${text}`);
  };

  section("Protocolo para Situaciones Tipo I (Conflictos escolares leves)");
  doc.font("Helvetica-Bold").fontSize(10).text("Ejemplos:");
  bullet("Discusiones, empujones, insultos ocasionales");
  bullet("Malentendidos entre estudiantes");
  bullet("Bromas pesadas o comentarios inadecuados");
  bullet("Conflictos por materiales o espacios");
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Procedimiento:");
  [
    "El docente identifica la situacion.",
    "Se separa a los estudiantes involucrados.",
    "Se realiza dialogo pedagogico entre las partes.",
    "Se promueve la mediacion y reconciliacion.",
    "Se establecen compromisos de convivencia.",
    "Se registra el hecho en el observador del estudiante.",
    "El docente realiza seguimiento para evitar repeticion."
  ].forEach(bullet);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Objetivo:");
  bullet("Resolver el conflicto de manera formativa.");
  doc.moveDown(1);

  section("Protocolo para Situaciones Tipo II (Agresion escolar o acoso escolar)");
  doc.font("Helvetica-Bold").fontSize(10).text("Ejemplos:");
  bullet("Bullying, amenazas, agresiones repetidas");
  bullet("Ciberacoso o intimidacion sistematica");
  bullet("Aislamiento intencional o discriminacion");
  bullet("Hostigamiento verbal o fisico reiterado");
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Procedimiento:");
  [
    "El docente informa al coordinador o directivo.",
    "Se realiza registro formal del caso.",
    "Se convoca al Comite Escolar de Convivencia.",
    "Se analiza la situacion y se escuchan las partes.",
    "Se cita a padres o acudientes.",
    "Se establecen acciones pedagogicas o correctivas.",
    "Se realiza seguimiento institucional."
  ].forEach(bullet);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Objetivo:");
  bullet("Proteger al estudiante afectado y evitar la repeticion del acoso.");
  doc.moveDown(1);

  section("Protocolo para Situaciones Tipo III (Situaciones que pueden constituir delito)");
  doc.font("Helvetica-Bold").fontSize(10).text("Ejemplos:");
  bullet("Abuso sexual");
  bullet("Porte de armas");
  bullet("Consumo o trafico de drogas");
  bullet("Extorsion o lesiones graves");
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Procedimiento:");
  [
    "Se protege inmediatamente al estudiante afectado.",
    "Se informa al rector o directivo.",
    "Se activa la Ruta de Atencion Externa.",
    "Se informa a las autoridades competentes:",
    "  - Policia de Infancia y Adolescencia",
    "  - Instituto Colombiano de Bienestar Familiar",
    "  - Fiscalia General de la Nacion",
    "Se registra el caso en el sistema institucional.",
    "Se realiza seguimiento institucional."
  ].forEach((line) => doc.font("Helvetica").fontSize(10).text(line));
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Objetivo:");
  bullet("Garantizar la proteccion de los derechos del menor.");

  doc.end();
});

router.get("/convivencia/acta", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (_req, res) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"acta-comite-convivencia.pdf\"");

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(14).text("FORMATO DE ACTA - COMITE DE CONVIVENCIA", { align: "center" });
  doc.moveDown(1);

  const line = (label: string) => {
    doc.font("Helvetica").fontSize(10).text(`${label}: ________________________________`);
  };

  line("INSTITUCION EDUCATIVA");
  line("ACTA N.°");
  line("FECHA");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(11).text("1. Integrantes del comite presentes");
  line("Rector(a)");
  line("Coordinador(a)");
  line("Docente");
  line("Representante de padres");
  line("Representante de estudiantes");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(11).text("2. Estudiante(s) involucrado(s)");
  line("Nombre");
  line("Grado");
  line("Edad");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(11).text("3. Descripcion de la situacion");
  doc.font("Helvetica").fontSize(10).text("________________________________________________________________________________");
  doc.text("________________________________________________________________________________");
  doc.text("________________________________________________________________________________");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(11).text("4. Clasificacion de la situacion");
  doc.font("Helvetica").fontSize(10).text("[ ] Tipo I    [ ] Tipo II    [ ] Tipo III");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(11).text("5. Analisis del comite");
  doc.font("Helvetica").fontSize(10).text("________________________________________________________________________________");
  doc.text("________________________________________________________________________________");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(11).text("6. Decisiones tomadas");
  doc.font("Helvetica").fontSize(10).text("[ ] Citacion a padres");
  doc.text("[ ] Compromiso pedagogico");
  doc.text("[ ] Seguimiento institucional");
  doc.text("[ ] Remision a entidad externa");
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(11).text("7. Compromisos establecidos");
  doc.font("Helvetica").fontSize(10).text("________________________________________________________________________________");
  doc.text("________________________________________________________________________________");
  doc.moveDown(1);

  line("Firma Rector");
  line("Firma Coordinador");
  line("Firma Docente");

  doc.end();
});

router.get("/convivencia/cartel", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (_req, res) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"cartel-ruta-convivencia.pdf\"");

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(18).text("RUTA DE CONVIVENCIA ESCOLAR", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(11).text("Ley 1620 de 2013 | Decreto 1965 de 2013", { align: "center" });
  doc.moveDown(1);

  const step = (title: string, body: string) => {
    doc.font("Helvetica-Bold").fontSize(12).text(title);
    doc.font("Helvetica").fontSize(10).text(body);
    doc.moveDown(0.5);
  };

  step("1. PROMOCION", "Fomentamos el respeto, la tolerancia y los valores.");
  step("2. PREVENCION", "Identificamos riesgos y promovemos el buen trato.");
  step("3. ATENCION", "Actuamos ante situaciones que afectan la convivencia.");
  doc.font("Helvetica-Bold").fontSize(11).text("Tipos de situaciones:");
  doc.font("Helvetica").fontSize(10).text("- Tipo I: conflictos leves");
  doc.text("- Tipo II: agresion o bullying");
  doc.text("- Tipo III: situaciones que pueden ser delito");
  doc.moveDown(0.5);
  step("4. SEGUIMIENTO", "Verificamos que se cumplan los compromisos y mejore la convivencia.");

  doc.font("Helvetica-Bold").fontSize(11).text("Participan:");
  doc.font("Helvetica").fontSize(10).text("Docentes, Directivos, Estudiantes, Padres de familia, Comite de convivencia");
  doc.moveDown(0.7);
  doc.font("Helvetica-Bold").fontSize(11).text("Mensaje final:");
  doc.font("Helvetica").fontSize(10).text(
    "La convivencia escolar es responsabilidad de todos. Respetar a los demas es respetarnos a nosotros mismos."
  );

  doc.end();
});

router.get("/student-observer/templates", requireAuth, requireRole(["ADMIN", "TEACHER"]), async (_req, res) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"plantillas-observador-estudiante.pdf\"");

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  const margin = 40;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (height: number) => {
    if (y + height > doc.page.height - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawTitle = (text: string) => {
    ensureSpace(24);
    doc.font("Helvetica-Bold").fontSize(13).text(text, margin, y);
    y += 18;
  };

  const drawParagraph = (text: string, font = "Helvetica", size = 10) => {
    doc.font(font).fontSize(size);
    const height = doc.heightOfString(text, { width: contentWidth });
    ensureSpace(height + 6);
    doc.text(text, margin, y, { width: contentWidth });
    y += height + 6;
  };

  drawTitle("PLANTILLAS AUTOMATICAS - OBSERVADOR DEL ESTUDIANTE");

  drawTitle("1. SEGUIMIENTO ACADEMICO");
  drawParagraph("Descripcion de la situacion: ________________________________");
  drawParagraph("Procedimiento aplicado:");
  [
    "El docente identifica la dificultad academica.",
    "Se revisa el desempeño y evidencias del estudiante.",
    "Se diseña un plan de apoyo pedagogico.",
    "Se acuerdan estrategias con el estudiante.",
    "Se comunica a padres o acudientes.",
    "Se registra el seguimiento en el observador."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Compromisos automaticos:");
  [
    "Cumplir el plan de apoyo y tareas asignadas.",
    "Asistir a refuerzos o tutorias programadas.",
    "Mantener comunicacion con docente y acudientes."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Tareas de seguimiento:");
  [
    "Seguimiento semanal del avance (fecha: ____ / responsable: ____).",
    "Reevaluacion del desempeño a 30 dias (fecha: ____ / responsable: ____)."
  ].forEach((line) => drawParagraph(`- [ ] ${line}`));
  drawParagraph("Citaciones y comunicaciones:");
  ["Citar a padres/acudientes si persiste la dificultad (fecha: ____ / medio: ____)."].forEach((line) =>
    drawParagraph(`- [ ] ${line}`)
  );

  drawTitle("2. CONVIVENCIA - TIPO I (CONFLICTOS LEVES)");
  drawParagraph("Falta reportada: ________________________________");
  drawParagraph("Descripcion de la situacion: ________________________________");
  drawParagraph("Procedimiento aplicado:");
  [
    "El docente identifica la situacion.",
    "Se separa a los estudiantes involucrados.",
    "Se realiza dialogo pedagogico entre las partes.",
    "Se promueve la mediacion y reconciliacion.",
    "Se establecen compromisos de convivencia.",
    "Se registra el hecho en el observador del estudiante.",
    "El docente realiza seguimiento para evitar repeticion."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Compromisos automaticos:");
  [
    "Respetar los acuerdos de convivencia definidos.",
    "Participar en actividades de mediacion y reparacion.",
    "Evitar reincidencia y reportar nuevas situaciones."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Tareas de seguimiento:");
  [
    "Seguimiento docente inicial (fecha: ____ / responsable: ____).",
    "Verificacion de compromisos a 15 dias (fecha: ____ / responsable: ____)."
  ].forEach((line) => drawParagraph(`- [ ] ${line}`));
  drawParagraph("Citaciones y comunicaciones:");
  ["Citar a acudientes si hay reincidencia (fecha: ____ / medio: ____)."].forEach((line) =>
    drawParagraph(`- [ ] ${line}`)
  );

  drawTitle("3. CONVIVENCIA - TIPO II (AGRESION O ACOSO ESCOLAR)");
  drawParagraph("Falta reportada: ________________________________");
  drawParagraph("Descripcion de la situacion: ________________________________");
  drawParagraph("Procedimiento aplicado:");
  [
    "El docente informa al coordinador o directivo.",
    "Se realiza registro formal del caso.",
    "Se convoca al Comite Escolar de Convivencia.",
    "Se analiza la situacion y se escuchan las partes.",
    "Se cita a padres o acudientes.",
    "Se establecen acciones pedagogicas o correctivas.",
    "Se realiza seguimiento institucional."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Compromisos automaticos:");
  [
    "Compromiso pedagogico firmado por el estudiante.",
    "Plan de apoyo socioemocional y seguimiento.",
    "Cumplir medidas correctivas definidas por el comite."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Tareas de seguimiento:");
  [
    "Seguimiento institucional semanal (fecha: ____ / responsable: ____).",
    "Informe de avance al Comite de Convivencia (fecha: ____)."
  ].forEach((line) => drawParagraph(`- [ ] ${line}`));
  drawParagraph("Citaciones y comunicaciones:");
  [
    "Citar a padres/acudientes (fecha: ____ / medio: ____).",
    "Registro en acta del Comite de Convivencia."
  ].forEach((line) => drawParagraph(`- [ ] ${line}`));

  drawTitle("4. CONVIVENCIA - TIPO III (SITUACIONES QUE PUEDEN CONSTITUIR DELITO)");
  drawParagraph("Falta reportada: ________________________________");
  drawParagraph("Descripcion de la situacion: ________________________________");
  drawParagraph("Procedimiento aplicado:");
  [
    "Se protege inmediatamente al estudiante afectado.",
    "Se informa al rector o directivo.",
    "Se activa la Ruta de Atencion Externa.",
    "Se informa a las autoridades competentes.",
    "Se registra el caso en el sistema institucional.",
    "Se realiza seguimiento institucional."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Compromisos automaticos:");
  [
    "Garantizar proteccion inmediata del estudiante.",
    "Coordinar con entidades externas y soporte psicosocial.",
    "Registrar avances y decisiones institucionales."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Tareas de seguimiento:");
  [
    "Seguimiento institucional permanente (fecha: ____ / responsable: ____).",
    "Reporte de avances a entidades competentes (fecha: ____)."
  ].forEach((line) => drawParagraph(`- [ ] ${line}`));
  drawParagraph("Citaciones y comunicaciones:");
  [
    "Citar a padres/acudientes de forma inmediata (fecha: ____ / medio: ____).",
    "Notificar a ICBF/Policia/Fiscalia segun corresponda."
  ].forEach((line) => drawParagraph(`- [ ] ${line}`));

  doc.end();
});

router.get("/student-observer/:studentId", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const studentId = String(req.params.studentId || "").trim();
  if (!studentId) return res.status(400).json({ error: "Student id required" });

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        include: { class: true },
        orderBy: [{ year: "desc" }, { id: "desc" }],
        take: 1
      }
    }
  });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const observations = await prisma.studentObservation.findMany({
    where: { studentId },
    include: { createdBy: { select: { fullName: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 20
  });

  const latestEnrollment = student.enrollments[0];
  const branding = await getBrandingSettings();
  const grade = latestEnrollment?.class?.gradeLevel || student.gradeLevel;
  const group = student.studentGroup || "";
  const year = latestEnrollment?.year ? String(latestEnrollment.year) : "";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"observador-estudiante-${student.id}.pdf\"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (height: number) => {
    if (y + height > doc.page.height - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawTitle = (text: string) => {
    ensureSpace(26);
    doc.font("Helvetica-Bold").fontSize(13).text(text, margin, y);
    y += 18;
  };

  const drawLine = (label: string, value?: string) => {
    ensureSpace(16);
    const text = value ? `${label}: ${value}` : `${label}: _________________________________`;
    doc.font("Helvetica").fontSize(10).text(text, margin, y);
    y += 14;
  };

  const drawTable = (headers: string[], rows: string[][], colWidths: number[], rowHeight = 18) => {
    const totalWidth = colWidths.reduce((s, w) => s + w, 0);
    const scale = totalWidth > 0 ? contentWidth / totalWidth : 1;
    const widths = colWidths.map((w) => w * scale);
    const tableHeight = (rows.length + 1) * rowHeight;
    ensureSpace(tableHeight + 4);

    let x = margin;
    doc.font("Helvetica-Bold").fontSize(9);
    headers.forEach((h, i) => {
      doc.rect(x, y, widths[i], rowHeight).stroke();
      doc.text(h, x + 3, y + 4, { width: widths[i] - 6 });
      x += widths[i];
    });
    y += rowHeight;
    doc.font("Helvetica").fontSize(9);
    rows.forEach((row) => {
      x = margin;
      row.forEach((cell, i) => {
        doc.rect(x, y, widths[i], rowHeight).stroke();
        if (cell) doc.text(cell, x + 3, y + 4, { width: widths[i] - 6 });
        x += widths[i];
      });
      y += rowHeight;
    });
    y += 6;
  };

  const drawParagraph = (text: string, font = "Helvetica", size = 10) => {
    doc.font(font).fontSize(size);
    const height = doc.heightOfString(text, { width: contentWidth });
    ensureSpace(height + 6);
    doc.text(text, margin, y, { width: contentWidth });
    y += height + 6;
  };

  const truncate = (text: string, max = 80) => {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 3)}...`;
  };

  const observationTypeLabel = (type?: string | null) => {
    if (type === "ACADEMIC") return "Academico";
    if (type === "COEXISTENCE") return "Convivencia";
    if (type === "DISCIPLINARY") return "Disciplinario";
    return type || "-";
  };

  const protocolLabel = (protocol?: string | null) => {
    if (protocol === "TIPO_I") return "Tipo I";
    if (protocol === "TIPO_II") return "Tipo II";
    if (protocol === "TIPO_III") return "Tipo III";
    return "-";
  };

  doc.font("Helvetica-Bold").fontSize(14).text("FORMATO: OBSERVADOR DEL ESTUDIANTE", margin, y);
  y += 20;

  drawTitle("1. INFORMACION GENERAL DEL ESTUDIANTE");
  drawLine("Institucion Educativa", branding.schoolName || "");
  drawLine("Sede", "");
  drawLine("Ano Lectivo", year);
  drawLine("Nombre completo del estudiante", student.fullName);
  drawLine("Tipo de documento", latestEnrollment?.studentDocType || "");
  drawLine("Numero de documento", latestEnrollment?.studentDocNumber || "");
  drawLine("Fecha de nacimiento", formatDateOnly(student.birthDate));
  drawLine("Edad", calculateAge(student.birthDate));
  drawLine("Grado", gradeLabelShort(String(grade || "")));
  drawLine("Grupo", group);
  drawLine("Jornada", "");
  drawLine("Direccion", latestEnrollment?.studentAddress || "");
  drawLine("Telefono", latestEnrollment?.contactPhone || "");

  drawTitle("2. INFORMACION DEL ACUDIENTE");
  drawLine("Nombre del acudiente", latestEnrollment?.guardianFullName || "");
  drawLine("Parentesco", latestEnrollment?.guardianRelation || "");
  drawLine("Telefono", latestEnrollment?.contactPhone || "");
  drawLine("Correo electronico", latestEnrollment?.contactEmail || "");
  drawLine("Direccion", latestEnrollment?.studentAddress || "");

  drawTitle("3. INFORMACION ACADEMICA");
  drawTable(
    ["Asignatura", "Docente", "Desempeno", "Observaciones"],
    [
      ["Matematicas", "", "", ""],
      ["Castellano", "", "", ""],
      ["Ciencias Naturales", "", "", ""],
      ["Sociales", "", "", ""],
      ["Ingles", "", "", ""],
      ["Informatica", "", "", ""],
      ["Artistica", "", "", ""],
      ["Educacion Fisica", "", "", ""],
      ["Etica y Valores", "", "", ""]
    ],
    [120, 120, 80, 160]
  );

  drawTitle("4. SEGUIMIENTO COMPORTAMENTAL Y CONVIVENCIAL");
  drawTable(
    ["Fecha", "Situacion presentada", "Tipo", "Falta", "Accion tomada", "Docente responsable"],
    Array.from({ length: 6 }).map(() => ["", "", "", "", "", ""]),
    [60, 150, 80, 110, 110, 100]
  );

  drawTitle("5. COMPROMISOS DEL ESTUDIANTE");
  drawTable(
    ["Fecha", "Compromiso adquirido", "Responsable", "Fecha de seguimiento", "Resultado"],
    Array.from({ length: 6 }).map(() => ["", "", "", "", ""]),
    [60, 170, 100, 90, 80]
  );

  drawTitle("6. CITACIONES A PADRES O ACUDIENTES");
  drawTable(
    ["Fecha", "Motivo", "Docente o directivo", "Observaciones", "Firma acudiente"],
    Array.from({ length: 6 }).map(() => ["", "", "", "", ""]),
    [60, 150, 120, 120, 90]
  );

  drawTitle("7. SEGUIMIENTO ACADEMICO Y PEDAGOGICO");
  drawTable(
    ["Fecha", "Dificultad identificada", "Estrategia aplicada", "Responsable", "Resultado"],
    Array.from({ length: 6 }).map(() => ["", "", "", "", ""]),
    [60, 170, 120, 90, 80]
  );

  drawTitle("7A. PLANTILLA AUTOMATICA DE SEGUIMIENTO ACADEMICO");
  drawParagraph("Descripcion de la situacion: ________________________________");
  drawParagraph("Procedimiento aplicado:");
  [
    "El docente identifica la dificultad academica.",
    "Se revisa el desempeño y evidencias del estudiante.",
    "Se diseña un plan de apoyo pedagogico.",
    "Se acuerdan estrategias con el estudiante.",
    "Se comunica a padres o acudientes.",
    "Se registra el seguimiento en el observador."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Compromisos automaticos:");
  [
    "Cumplir el plan de apoyo y tareas asignadas.",
    "Asistir a refuerzos o tutorias programadas.",
    "Mantener comunicacion con docente y acudientes."
  ].forEach((line) => drawParagraph(`- ${line}`));
  drawParagraph("Tareas de seguimiento:");
  [
    "Seguimiento semanal del avance (fecha: ____ / responsable: ____).",
    "Reevaluacion del desempeño a 30 dias (fecha: ____ / responsable: ____)."
  ].forEach((line) => drawParagraph(`- [ ] ${line}`));
  drawParagraph("Citaciones y comunicaciones:");
  ["Citar a padres/acudientes si persiste la dificultad (fecha: ____ / medio: ____)."].forEach((line) =>
    drawParagraph(`- [ ] ${line}`)
  );

  drawTitle("7B. PLANTILLAS AUTOMATICAS DE CONVIVENCIA");
  const drawConvivenciaTemplate = (title: string, items: string[], commitments: string[], followups: string[], citations: string[]) => {
    drawParagraph(title, "Helvetica-Bold", 10);
    drawParagraph("Falta reportada: ________________________________");
    drawParagraph("Descripcion de la situacion: ________________________________");
    drawParagraph("Procedimiento aplicado:");
    items.forEach((line) => drawParagraph(`- ${line}`));
    drawParagraph("Compromisos automaticos:");
    commitments.forEach((line) => drawParagraph(`- ${line}`));
    drawParagraph("Tareas de seguimiento:");
    followups.forEach((line) => drawParagraph(`- [ ] ${line}`));
    drawParagraph("Citaciones y comunicaciones:");
    citations.forEach((line) => drawParagraph(`- [ ] ${line}`));
    drawParagraph(" ");
  };

  drawConvivenciaTemplate(
    "Tipo I (conflictos leves)",
    [
      "El docente identifica la situacion.",
      "Se separa a los estudiantes involucrados.",
      "Se realiza dialogo pedagogico entre las partes.",
      "Se promueve la mediacion y reconciliacion.",
      "Se establecen compromisos de convivencia.",
      "Se registra el hecho en el observador del estudiante.",
      "El docente realiza seguimiento para evitar repeticion."
    ],
    [
      "Respetar los acuerdos de convivencia definidos.",
      "Participar en actividades de mediacion y reparacion.",
      "Evitar reincidencia y reportar nuevas situaciones."
    ],
    [
      "Seguimiento docente inicial (fecha: ____ / responsable: ____).",
      "Verificacion de compromisos a 15 dias (fecha: ____ / responsable: ____)."
    ],
    ["Citar a acudientes si hay reincidencia (fecha: ____ / medio: ____)."]
  );

  drawConvivenciaTemplate(
    "Tipo II (agresion o acoso escolar)",
    [
      "El docente informa al coordinador o directivo.",
      "Se realiza registro formal del caso.",
      "Se convoca al Comite Escolar de Convivencia.",
      "Se analiza la situacion y se escuchan las partes.",
      "Se cita a padres o acudientes.",
      "Se establecen acciones pedagogicas o correctivas.",
      "Se realiza seguimiento institucional."
    ],
    [
      "Compromiso pedagogico firmado por el estudiante.",
      "Plan de apoyo socioemocional y seguimiento.",
      "Cumplir medidas correctivas definidas por el comite."
    ],
    [
      "Seguimiento institucional semanal (fecha: ____ / responsable: ____).",
      "Informe de avance al Comite de Convivencia (fecha: ____)."
    ],
    [
      "Citar a padres/acudientes (fecha: ____ / medio: ____).",
      "Registro en acta del Comite de Convivencia."
    ]
  );

  drawConvivenciaTemplate(
    "Tipo III (situaciones que pueden constituir delito)",
    [
      "Se protege inmediatamente al estudiante afectado.",
      "Se informa al rector o directivo.",
      "Se activa la Ruta de Atencion Externa.",
      "Se informa a las autoridades competentes.",
      "Se registra el caso en el sistema institucional.",
      "Se realiza seguimiento institucional."
    ],
    [
      "Garantizar proteccion inmediata del estudiante.",
      "Coordinar con entidades externas y soporte psicosocial.",
      "Registrar avances y decisiones institucionales."
    ],
    [
      "Seguimiento institucional permanente (fecha: ____ / responsable: ____).",
      "Reporte de avances a entidades competentes (fecha: ____)."
    ],
    [
      "Citar a padres/acudientes de forma inmediata (fecha: ____ / medio: ____).",
      "Notificar a ICBF/Policia/Fiscalia segun corresponda."
    ]
  );

  drawTitle("8. RECONOCIMIENTOS O ASPECTOS POSITIVOS");
  drawTable(
    ["Fecha", "Reconocimiento", "Responsable"],
    Array.from({ length: 6 }).map(() => ["", "", ""]),
    [70, 240, 150]
  );

  drawTitle("9. DOCUMENTOS ANEXOS");
  ["Registro civil", "Documento de identidad", "Certificado de matricula", "Constancia de estudio", "Boletines academicos", "Compromisos disciplinarios", "Informes psicologicos o pedagogicos", "Otros: __________________________"].forEach((item) => {
    ensureSpace(14);
    doc.font("Helvetica").fontSize(10).text(`[ ] ${item}`, margin, y);
    y += 12;
  });

  drawTitle("10. HISTORIAL DE OBSERVACIONES REALIZADAS");
  const observationRows = observations.length
    ? observations.map((obs) => [
        formatDateOnly(obs.date),
        observationTypeLabel(obs.type),
        protocolLabel(obs.coexistenceProtocol),
        obs.coexistenceOffense || "-",
        truncate(obs.detail, 90),
        obs.createdBy?.fullName || "-"
      ])
    : [["", "No hay observaciones registradas.", "", "", "", ""]];
  drawTable(
    ["Fecha", "Tipo", "Protocolo", "Falta", "Detalle", "Docente"],
    observationRows,
    [60, 70, 70, 110, 210, 120],
    20
  );

  drawTitle("11. FIRMAS");
  drawLine("Director de grupo", "");
  drawLine("Docente que registra la observacion", "");
  drawLine("Estudiante", "");
  drawLine("Padre / Madre / Acudiente", "");
  drawLine("Fecha", "");

  doc.end();
});

router.post(
  "/certificate/requests",
  requireAuth,
  requireRole(["TEACHER", "PARENT"]),
  validate(createCertificateRequestSchema),
  async (req, res) => {
    const auth = (req as any).auth;
    const { body } = (req as any).validated;
    const studentId = String(body.studentId || "").trim();
    const type = String(body.type || "").trim() as "STUDY" | "ENROLLMENT";

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) return res.status(404).json({ error: "Student not found" });

    const canAccess = await assertParentCanAccessStudent(auth, studentId);
    if (!canAccess) return res.status(403).json({ error: "Forbidden" });

    const latest = await prisma.certificateRequest.findFirst({
      where: { studentId, requestedById: auth.userId, type },
      orderBy: { requestedAt: "desc" }
    });
    const latestApprovedActive =
      latest?.status === "APPROVED" &&
      latest.reviewedAt &&
      Date.now() - latest.reviewedAt.getTime() <= CERT_REQUEST_APPROVAL_WINDOW_MS;
    if (latest && (latest.status === "PENDING" || latestApprovedActive)) {
      return res.json({ request: latest });
    }

    const created = await prisma.certificateRequest.create({
      data: {
        studentId,
        requestedById: auth.userId,
        type
      }
    });

    const requester = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true, role: true }
    });
    const studentInfo = await prisma.student.findUnique({
      where: { id: studentId },
      select: { fullName: true, gradeLevel: true, studentGroup: true }
    });

    await prisma.notification.create({
      data: {
        title: "Nueva solicitud de certificado",
        body: composeNotificationBodyWithMeta(
          [
            `Tipo: ${certificateTypeLabel(type)}`,
            `Estudiante: ${studentInfo?.fullName || "-"}` +
              (studentInfo?.gradeLevel ? ` (${studentInfo.gradeLevel}${studentInfo.studentGroup ? `-${studentInfo.studentGroup}` : ""})` : ""),
            `Solicitante: ${requester?.fullName || "Usuario"} (${requester?.role || "N/A"})`,
            `Solicitud: ${created.id}`
          ].join("\n"),
          "ADMINS"
        ),
        status: "PENDING",
        createdById: auth.userId
      }
    });

    return res.status(201).json({ request: created });
  }
);

router.get("/certificate/requests/me", requireAuth, requireRole(["TEACHER", "PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const studentId = String(req.query.studentId || "").trim();
  const type = String(req.query.type || "").trim().toUpperCase();

  const data = await prisma.certificateRequest.findMany({
    where: {
      requestedById: auth.userId,
      ...(studentId ? { studentId } : {}),
      ...(type === "STUDY" || type === "ENROLLMENT" ? { type: type as any } : {})
    },
    include: {
      student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
      requestedBy: { select: { id: true, fullName: true, role: true } },
      reviewedBy: { select: { id: true, fullName: true, role: true } }
    },
    orderBy: { requestedAt: "desc" }
  });

  res.json({ data });
});

router.get("/certificate/requests", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim().toUpperCase();
  const type = String(req.query.type || "").trim().toUpperCase();
  const student = String(req.query.student || "").trim();
  const requestedBy = String(req.query.requestedBy || "").trim();

  const where: Prisma.CertificateRequestWhereInput = {
    ...(status === "PENDING" || status === "APPROVED" || status === "REJECTED" ? { status: status as any } : {}),
    ...(type === "STUDY" || type === "ENROLLMENT" ? { type: type as any } : {}),
    ...(student
      ? {
          student: { fullName: { contains: student, mode: "insensitive" } }
        }
      : {}),
    ...(requestedBy
      ? {
          requestedBy: { fullName: { contains: requestedBy, mode: "insensitive" } }
        }
      : {})
  };

  const [data, total] = await Promise.all([
    prisma.certificateRequest.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
        requestedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.certificateRequest.count({ where })
  ]);

  res.json({ data, total, page, pageSize });
});

router.post(
  "/certificate/requests/:id/approve",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(reviewCertificateRequestSchema),
  async (req, res) => {
    const auth = (req as any).auth;
    const id = String(req.params.id || "").trim();
    const existing = await prisma.certificateRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Request not found" });
    if (existing.status !== "PENDING") {
      return res.status(400).json({ error: "Request already reviewed" });
    }

    const updated = await prisma.certificateRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: auth.userId,
        reviewedAt: new Date()
      }
    });

    res.json({ request: updated });
  }
);

router.get("/alerts/pdf", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const from = parseDateParam(String(req.query.fromDate || ""));
  const to = parseDateParam(String(req.query.toDate || ""));
  const { rows, branding, subtitle } = await loadAlertsReportData({
    status: String(req.query.status || ""),
    from,
    to
  });

  sendTabularPdf(res, {
    fileName: "centro-alertas.pdf",
    title: "Centro de alertas",
    subtitle,
    branding,
    columns: [
      { key: "tipo", label: "Tipo", width: 90 },
      { key: "detalle", label: "Detalle", width: 190 },
      { key: "responsable", label: "Estudiante/Responsable", width: 160 },
      { key: "fecha", label: "Fecha", width: 70, align: "center" },
      { key: "estado", label: "Estado", width: 80, align: "center" }
    ],
    rows
  });
});

router.get("/alerts/excel", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const from = parseDateParam(String(req.query.fromDate || ""));
  const to = parseDateParam(String(req.query.toDate || ""));
  const { rows, branding } = await loadAlertsReportData({
    status: String(req.query.status || ""),
    from,
    to
  });

  const xlsx = buildXlsxReportBuffer({
    title: "Centro de alertas",
    institutionName: branding?.schoolName,
    columns: [
      { key: "tipo", label: "Tipo" },
      { key: "detalle", label: "Detalle" },
      { key: "responsable", label: "Estudiante/Responsable" },
      { key: "fecha", label: "Fecha" },
      { key: "estado", label: "Estado" }
    ],
    rows
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"centro-alertas.xlsx\"");
  res.send(xlsx);
});

router.get("/import-template/excel", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const branding = await getBrandingSettings();
  const workbook = XLSX.utils.book_new();

  const addSheet = (name: string, headers: string[]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, ws, name);
  };

  const instructions = [
    [`Plantilla de importacion - ${branding.schoolName || "Institucion Educativa"}`],
    ["Objetivo: cargar datos de manera masiva con una estructura compatible con la base de datos."],
    [""],
    ["Indicaciones generales:"],
    ["1. No combines celdas ni agregues columnas adicionales."],
    ["2. Mantén los encabezados exactamente como aparecen."],
    ["3. Usa fechas en formato YYYY-MM-DD (ej: 2026-03-25)."],
    ["4. Los campos JSON deben ir como texto JSON valido (ej: {\"Lunes\": []})."],
    ["5. Si un campo es opcional puedes dejarlo vacío."],
    [""],
    ["Enums (valores permitidos):"],
    ["RoleName: ADMIN | TEACHER | PARENT"],
    [
      "GradeLevel: PRE_JARDIN | JARDIN | TRANSICION | PRIMERO | SEGUNDO | TERCERO | CUARTO | QUINTO | SEXTO | SEPTIMO | OCTAVO | NOVENO | DECIMO | ONCE"
    ],
    ["AdmissionStatus: PENDING | APPROVED | REJECTED"],
    ["NotificationStatus: DRAFT | PENDING | APPROVED | REJECTED | SENT"],
    ["CertificateType: STUDY | ENROLLMENT"],
    ["ObservationType: ACADEMIC | DISCIPLINARY | COEXISTENCE"],
    ["CoexistenceProtocol: TIPO_I | TIPO_II | TIPO_III"],
    [""],
    ["Hojas disponibles:"],
    ["USUARIOS: crea usuarios base (ADMIN/TEACHER/PARENT)."],
    ["DOCENTES: configura detalle docente por correo."],
    ["ESTUDIANTES: crea estudiantes y sus datos principales."],
    ["CLASES: crea grupos/clases y asigna docente."],
    ["MATRICULAS: matricula estudiantes en clases."],
    ["ACUDIENTES: vincula padres a estudiantes."],
    ["ADMISIONES: registra solicitudes de admision."],
    ["FACTURAS: cargas de cartera por estudiante."],
    ["PAGOS: registra pagos sobre facturas."]
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "INSTRUCCIONES");

  addSheet("USUARIOS", ["email", "fullName", "role", "isActive", "password"]);
  addSheet("DOCENTES", [
    "userEmail",
    "subjects",
    "subjectHours",
    "subjectSchedules",
    "subjectHoursMode",
    "cognitiveWeight",
    "personalWeight",
    "socialWeight"
  ]);
  addSheet("ESTUDIANTES", ["fullName", "birthDate", "gradeLevel", "studentGroup", "isActive"]);
  addSheet("CLASES", ["teacherEmail", "gradeLevel", "schedule"]);
  addSheet("MATRICULAS", [
    "studentId",
    "classId",
    "year",
    "status",
    "studentFullName",
    "studentBirthDate",
    "studentGradeLevel",
    "studentAddress",
    "guardianFullName",
    "guardianDocNumber",
    "guardianRelation",
    "contactPhone",
    "contactEmail"
  ]);
  addSheet("ACUDIENTES", ["parentEmail", "studentId", "relation"]);
  addSheet("ADMISIONES", [
    "studentName",
    "gradeLevel",
    "status",
    "guardianFullName",
    "guardianDocNumber",
    "guardianRelation",
    "contactPhone",
    "contactEmail",
    "studentBirthDate",
    "studentDocType",
    "studentDocNumber",
    "studentAddress"
  ]);
  addSheet("FACTURAS", ["studentId", "amount", "dueDate", "status"]);
  addSheet("PAGOS", ["invoiceId", "amount", "paidAt", "method", "reference"]);

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer | Uint8Array;
  const output = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"plantilla-importacion.xlsx\"");
  res.send(output);
});

router.get("/import-template/history", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const history = await readImportHistory();
  res.json({ data: history });
});

router.post("/import-template/import", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const payload = (req as any).body || {};
  const rawBase64 = String(payload.fileBase64 || "").trim();
  const mode = String(payload.mode || "import").toLowerCase();
  if (!rawBase64) return res.status(400).json({ message: "Archivo requerido" });

  const base64 = rawBase64.includes("base64,") ? rawBase64.split("base64,")[1] : rawBase64;
  let workbook: XLSX.WorkBook;
  try {
    const buffer = Buffer.from(base64, "base64");
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return res.status(400).json({ message: "Archivo invalido o corrupto" });
  }

  const result = {
    mode: mode === "validate" ? "validate" : "import",
    created: {
      users: 0,
      teachers: 0,
      parents: 0,
      students: 0,
      classes: 0,
      enrollments: 0,
      guardians: 0,
      admissions: 0,
      invoices: 0,
      payments: 0
    },
    updated: {
      users: 0,
      teachers: 0,
      students: 0,
      classes: 0,
      enrollments: 0
    },
    skipped: 0,
    errors: [] as Array<{ sheet: string; row: number; message: string }>,
    defaultPasswordUsed: false
  };

  const sheetRows = (sheetName: string) => {
    const ws = workbook.Sheets[sheetName];
    if (!ws) return { headers: [] as string[], rows: [] as Array<Record<string, any>> };
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[];
    if (!data.length) return { headers: [] as string[], rows: [] as Array<Record<string, any>> };
    const [rawHeaderRow, ...rows] = data;
    const headerRow = Array.isArray(rawHeaderRow) ? rawHeaderRow : [];
    const headers: string[] = headerRow.map((h) => String(h || "").trim());
    const parsedRows = rows
      .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim() !== ""))
      .map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((key, idx) => {
          obj[key] = row[idx];
        });
        return obj;
      });
    return { headers, rows: parsedRows };
  };

  const ensureHeaders = (sheet: string, headers: string[], required: string[]) => {
    const missing = required.filter((h) => !headers.includes(h));
    if (missing.length) {
      result.errors.push({
        sheet,
        row: 1,
        message: `Faltan columnas requeridas: ${missing.join(", ")}`
      });
      return false;
    }
    return true;
  };

  const normalizeEmail = (value: any) => String(value || "").trim().toLowerCase();
  const normalizeText = (value: any) => String(value || "").trim();
  const parseBoolean = (value: any, fallback = true) => {
    if (value === "" || value === undefined || value === null) return fallback;
    const text = String(value).trim().toLowerCase();
    if (["true", "1", "si", "sí", "yes"].includes(text)) return true;
    if (["false", "0", "no"].includes(text)) return false;
    return fallback;
  };
  const parseDate = (value: any) => {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const parseJson = (value: any) => {
    if (!value) return null;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(String(value));
    } catch {
      return null;
    }
  };

  const DEFAULT_PASSWORD = process.env.PARENT_DEFAULT_PASSWORD || "Temporal123!";

  const roleValues = ["ADMIN", "TEACHER", "PARENT"];
  const gradeValues = [
    "PRE_JARDIN",
    "JARDIN",
    "TRANSICION",
    "PRIMERO",
    "SEGUNDO",
    "TERCERO",
    "CUARTO",
    "QUINTO",
    "SEXTO",
    "SEPTIMO",
    "OCTAVO",
    "NOVENO",
    "DECIMO",
    "ONCE"
  ];

  const modeIsImport = result.mode === "import";

  const usersSheet = sheetRows("USUARIOS");
  if (usersSheet.rows.length && ensureHeaders("USUARIOS", usersSheet.headers, ["email", "fullName", "role"])) {
    for (let i = 0; i < usersSheet.rows.length; i += 1) {
      const row = usersSheet.rows[i];
      const email = normalizeEmail(row.email);
      const fullName = normalizeText(row.fullName);
      const role = normalizeText(row.role).toUpperCase();
      const isActive = parseBoolean(row.isActive, true);
      const password = normalizeText(row.password);
      if (!email || !fullName || !roleValues.includes(role)) {
        result.errors.push({ sheet: "USUARIOS", row: i + 2, message: "Datos incompletos o rol invalido." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          const update: any = { fullName, role: role as any, isActive };
          if (password) {
            update.passwordHash = await bcrypt.hash(password, 10);
          }
          await prisma.user.update({ where: { id: existing.id }, data: update });
          result.updated.users += 1;
        } else {
          const passwordValue = password || DEFAULT_PASSWORD;
          if (!password) result.defaultPasswordUsed = true;
          const passwordHash = await bcrypt.hash(passwordValue, 10);
          const created = await prisma.user.create({
            data: { email, fullName, role: role as any, isActive, passwordHash }
          });
          if (role === "TEACHER") {
            await prisma.teacher.create({ data: { userId: created.id } });
            result.created.teachers += 1;
          }
          if (role === "PARENT") {
            await prisma.parent.create({ data: { userId: created.id } });
            result.created.parents += 1;
          }
          result.created.users += 1;
        }
      }
    }
  }

  const teachersSheet = sheetRows("DOCENTES");
  if (teachersSheet.rows.length && ensureHeaders("DOCENTES", teachersSheet.headers, ["userEmail"])) {
    for (let i = 0; i < teachersSheet.rows.length; i += 1) {
      const row = teachersSheet.rows[i];
      const email = normalizeEmail(row.userEmail);
      if (!email) {
        result.errors.push({ sheet: "DOCENTES", row: i + 2, message: "userEmail requerido." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          result.errors.push({ sheet: "DOCENTES", row: i + 2, message: "Usuario no encontrado para el docente." });
          result.skipped += 1;
          continue;
        }
        if (user.role !== "TEACHER") {
          await prisma.user.update({ where: { id: user.id }, data: { role: "TEACHER" } });
        }
        const subjects = row.subjects
          ? Array.isArray(row.subjects)
            ? row.subjects
            : String(row.subjects)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
          : [];
        const updateData: any = {
          subjects,
          subjectHours: parseJson(row.subjectHours) || undefined,
          subjectSchedules: parseJson(row.subjectSchedules) || undefined,
          subjectHoursMode: parseJson(row.subjectHoursMode) || undefined,
          cognitiveWeight: row.cognitiveWeight ? Number(row.cognitiveWeight) : undefined,
          personalWeight: row.personalWeight ? Number(row.personalWeight) : undefined,
          socialWeight: row.socialWeight ? Number(row.socialWeight) : undefined
        };
        const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
        if (teacher) {
          await prisma.teacher.update({ where: { id: teacher.id }, data: updateData });
          result.updated.teachers += 1;
        } else {
          await prisma.teacher.create({ data: { userId: user.id, ...updateData } });
          result.created.teachers += 1;
        }
      }
    }
  }

  const studentsSheet = sheetRows("ESTUDIANTES");
  if (studentsSheet.rows.length && ensureHeaders("ESTUDIANTES", studentsSheet.headers, ["fullName", "gradeLevel"])) {
    for (let i = 0; i < studentsSheet.rows.length; i += 1) {
      const row = studentsSheet.rows[i];
      const fullName = normalizeText(row.fullName);
      const gradeLevel = normalizeText(row.gradeLevel).toUpperCase();
      if (!fullName || !gradeValues.includes(gradeLevel)) {
        result.errors.push({ sheet: "ESTUDIANTES", row: i + 2, message: "Nombre o grado invalido." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        const birthDate = parseDate(row.birthDate);
        const studentGroup = normalizeText(row.studentGroup) || null;
        const isActive = parseBoolean(row.isActive, true);
        const existing = await prisma.student.findFirst({
          where: {
            fullName,
            ...(birthDate ? { birthDate } : {}),
            ...(birthDate ? {} : { gradeLevel: gradeLevel as any, studentGroup: studentGroup || undefined })
          }
        });
        if (existing) {
          await prisma.student.update({
            where: { id: existing.id },
            data: { gradeLevel: gradeLevel as any, studentGroup, birthDate, isActive }
          });
          result.updated.students += 1;
        } else {
          await prisma.student.create({
            data: { fullName, birthDate, gradeLevel: gradeLevel as any, studentGroup, isActive }
          });
          result.created.students += 1;
        }
      }
    }
  }

  const classesSheet = sheetRows("CLASES");
  if (classesSheet.rows.length && ensureHeaders("CLASES", classesSheet.headers, ["teacherEmail", "gradeLevel"])) {
    for (let i = 0; i < classesSheet.rows.length; i += 1) {
      const row = classesSheet.rows[i];
      const teacherEmail = normalizeEmail(row.teacherEmail);
      const gradeLevel = normalizeText(row.gradeLevel).toUpperCase();
      if (!teacherEmail || !gradeValues.includes(gradeLevel)) {
        result.errors.push({ sheet: "CLASES", row: i + 2, message: "teacherEmail o gradeLevel invalido." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        const teacherUser = await prisma.user.findUnique({ where: { email: teacherEmail } });
        if (!teacherUser) {
          result.errors.push({ sheet: "CLASES", row: i + 2, message: "Docente no encontrado." });
          result.skipped += 1;
          continue;
        }
        const teacher = await prisma.teacher.findUnique({ where: { userId: teacherUser.id } });
        if (!teacher) {
          result.errors.push({ sheet: "CLASES", row: i + 2, message: "Perfil docente no encontrado." });
          result.skipped += 1;
          continue;
        }
        const schedule = parseJson(row.schedule) || undefined;
        const existing = await prisma.class.findFirst({
          where: { teacherId: teacher.id, gradeLevel: gradeLevel as any }
        });
        if (existing) {
          await prisma.class.update({ where: { id: existing.id }, data: { schedule } });
          result.updated.classes += 1;
        } else {
          await prisma.class.create({
            data: { teacherId: teacher.id, gradeLevel: gradeLevel as any, schedule }
          });
          result.created.classes += 1;
        }
      }
    }
  }

  const enrollSheet = sheetRows("MATRICULAS");
  if (enrollSheet.rows.length && ensureHeaders("MATRICULAS", enrollSheet.headers, ["studentId", "classId", "year"])) {
    for (let i = 0; i < enrollSheet.rows.length; i += 1) {
      const row = enrollSheet.rows[i];
      const studentId = normalizeText(row.studentId);
      const classId = normalizeText(row.classId);
      const year = Number(row.year);
      if (!studentId || !classId || !year) {
        result.errors.push({ sheet: "MATRICULAS", row: i + 2, message: "studentId, classId y year requeridos." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        const student = await prisma.student.findUnique({ where: { id: studentId } });
        const classEntity = await prisma.class.findUnique({ where: { id: classId } });
        if (!student || !classEntity) {
          result.errors.push({ sheet: "MATRICULAS", row: i + 2, message: "studentId o classId no encontrado." });
          result.skipped += 1;
          continue;
        }
        const data: any = {
          studentId,
          classId,
          year,
          status: normalizeText(row.status) || "ACTIVE",
          studentFullName: normalizeText(row.studentFullName) || student.fullName,
          studentBirthDate: parseDate(row.studentBirthDate) || student.birthDate,
          studentGradeLevel: (normalizeText(row.studentGradeLevel) || student.gradeLevel) as any,
          studentAddress: normalizeText(row.studentAddress) || "",
          guardianFullName: normalizeText(row.guardianFullName) || "Acudiente",
          guardianDocNumber: normalizeText(row.guardianDocNumber) || "SIN_DOCUMENTO",
          guardianRelation: normalizeText(row.guardianRelation) || "Acudiente",
          contactPhone: normalizeText(row.contactPhone) || "SIN_TELEFONO",
          contactEmail: normalizeText(row.contactEmail) || ""
        };
        const existing = await prisma.enrollment.findUnique({
          where: { studentId_classId_year: { studentId, classId, year } }
        });
        if (existing) {
          await prisma.enrollment.update({ where: { id: existing.id }, data });
          result.updated.enrollments += 1;
        } else {
          await prisma.enrollment.create({ data });
          result.created.enrollments += 1;
        }
      }
    }
  }

  const guardiansSheet = sheetRows("ACUDIENTES");
  if (guardiansSheet.rows.length && ensureHeaders("ACUDIENTES", guardiansSheet.headers, ["parentEmail", "studentId"])) {
    for (let i = 0; i < guardiansSheet.rows.length; i += 1) {
      const row = guardiansSheet.rows[i];
      const parentEmail = normalizeEmail(row.parentEmail);
      const studentId = normalizeText(row.studentId);
      if (!parentEmail || !studentId) {
        result.errors.push({ sheet: "ACUDIENTES", row: i + 2, message: "parentEmail y studentId requeridos." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        let user = await prisma.user.findUnique({ where: { email: parentEmail } });
        if (!user) {
          const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
          result.defaultPasswordUsed = true;
          user = await prisma.user.create({
            data: {
              email: parentEmail,
              fullName: parentEmail.split("@")[0] || "Acudiente",
              role: "PARENT",
              isActive: true,
              passwordHash
            }
          });
          await prisma.parent.create({ data: { userId: user.id } });
          result.created.users += 1;
          result.created.parents += 1;
        }
        const parent = await prisma.parent.findUnique({ where: { userId: user.id } });
        if (!parent) {
          result.errors.push({ sheet: "ACUDIENTES", row: i + 2, message: "No se pudo crear el padre." });
          result.skipped += 1;
          continue;
        }
        const relation = normalizeText(row.relation) || "Acudiente";
        await prisma.guardian.createMany({
          data: [{ parentId: parent.id, studentId, relation }],
          skipDuplicates: true
        });
        result.created.guardians += 1;
      }
    }
  }

  const admissionsSheet = sheetRows("ADMISIONES");
  if (admissionsSheet.rows.length && ensureHeaders("ADMISIONES", admissionsSheet.headers, ["studentName", "gradeLevel"])) {
    for (let i = 0; i < admissionsSheet.rows.length; i += 1) {
      const row = admissionsSheet.rows[i];
      const studentName = normalizeText(row.studentName);
      const gradeLevel = normalizeText(row.gradeLevel).toUpperCase();
      if (!studentName || !gradeValues.includes(gradeLevel)) {
        result.errors.push({ sheet: "ADMISIONES", row: i + 2, message: "studentName o gradeLevel invalido." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        const admissionStatusRaw = normalizeText(row.status).toUpperCase();
        const admissionStatus: AdmissionStatus = ["PENDING", "APPROVED", "REJECTED"].includes(admissionStatusRaw)
          ? (admissionStatusRaw as AdmissionStatus)
          : "PENDING";
        await prisma.admission.create({
          data: {
            studentName,
            gradeLevel: gradeLevel as any,
            status: admissionStatus,
            guardianFullName: normalizeText(row.guardianFullName) || "",
            guardianDocNumber: normalizeText(row.guardianDocNumber) || "",
            guardianRelation: normalizeText(row.guardianRelation) || "",
            contactPhone: normalizeText(row.contactPhone) || "",
            contactEmail: normalizeText(row.contactEmail) || "",
            studentBirthDate: parseDate(row.studentBirthDate) || null,
            studentDocType: normalizeText(row.studentDocType) || "",
            studentDocNumber: normalizeText(row.studentDocNumber) || "",
            studentAddress: normalizeText(row.studentAddress) || ""
          }
        });
        result.created.admissions += 1;
      }
    }
  }

  const invoicesSheet = sheetRows("FACTURAS");
  if (invoicesSheet.rows.length && ensureHeaders("FACTURAS", invoicesSheet.headers, ["studentId", "amount", "dueDate"])) {
    for (let i = 0; i < invoicesSheet.rows.length; i += 1) {
      const row = invoicesSheet.rows[i];
      const studentId = normalizeText(row.studentId);
      const amount = Number(row.amount);
      const dueDate = parseDate(row.dueDate);
      if (!studentId || !amount || !dueDate) {
        result.errors.push({ sheet: "FACTURAS", row: i + 2, message: "studentId, amount o dueDate invalido." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        const invoiceStatusRaw = normalizeText(row.status).toUpperCase();
        const invoiceStatus: InvoiceStatus = ["PENDING", "PAID", "OVERDUE"].includes(invoiceStatusRaw)
          ? (invoiceStatusRaw as InvoiceStatus)
          : "PENDING";
        await prisma.invoice.create({
          data: {
            studentId,
            amount,
            dueDate,
            status: invoiceStatus
          }
        });
        result.created.invoices += 1;
      }
    }
  }

  const paymentsSheet = sheetRows("PAGOS");
  if (paymentsSheet.rows.length && ensureHeaders("PAGOS", paymentsSheet.headers, ["invoiceId", "amount", "paidAt", "method"])) {
    for (let i = 0; i < paymentsSheet.rows.length; i += 1) {
      const row = paymentsSheet.rows[i];
      const invoiceId = normalizeText(row.invoiceId);
      const amount = Number(row.amount);
      const paidAt = parseDate(row.paidAt);
      const method = normalizeText(row.method);
      if (!invoiceId || !amount || !paidAt || !method) {
        result.errors.push({ sheet: "PAGOS", row: i + 2, message: "invoiceId, amount, paidAt o method invalido." });
        result.skipped += 1;
        continue;
      }
      if (modeIsImport) {
        await prisma.payment.create({
          data: {
            invoiceId,
            amount,
            paidAt,
            method,
            reference: normalizeText(row.reference) || null
          }
        });
        result.created.payments += 1;
      }
    }
  }

  const auth = (req as any).auth;
  const creator = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { fullName: true, email: true }
  });
  const history = await readImportHistory();
  const entry = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    createdById: auth.userId,
    createdByName: creator?.fullName || "-",
    createdByEmail: creator?.email || "",
    mode: result.mode,
    summary: {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errorsCount: Array.isArray(result.errors) ? result.errors.length : 0,
      defaultPasswordUsed: result.defaultPasswordUsed
    },
    errors: Array.isArray(result.errors) ? result.errors.slice(0, 50) : []
  };
  const nextHistory = [entry, ...history].slice(0, 100);
  await writeImportHistory(nextHistory);

  res.json(result);
});

router.post(
  "/certificate/requests/:id/reject",
  requireAuth,
  requireRole(["ADMIN"]),
  validate(reviewCertificateRequestSchema),
  async (req, res) => {
    const auth = (req as any).auth;
    const id = String(req.params.id || "").trim();
    const existing = await prisma.certificateRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Request not found" });
    if (existing.status !== "PENDING") {
      return res.status(400).json({ error: "Request already reviewed" });
    }

    const updated = await prisma.certificateRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: auth.userId,
        reviewedAt: new Date()
      }
    });

    res.json({ request: updated });
  }
);

router.get("/certificate/study/:studentId", requireAuth, requireRole(["ADMIN", "TEACHER", "PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const studentId = String(req.params.studentId || "");
  if (!studentId) return res.status(400).json({ error: "Student id required" });

  const canAccess = await assertParentCanAccessStudent(auth, studentId);
  if (!canAccess) return res.status(403).json({ error: "Forbidden" });

  const authorization = await resolveCertificateIssuer(auth, studentId, "STUDY");
  if (!authorization.allowed) {
    return res.status(403).json({ error: "Requiere autorizacion administrativa" });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        include: { class: true },
        orderBy: { year: "desc" },
        take: 1
      }
    }
  });
  if (!student) return res.status(404).json({ error: "Student not found" });
  const certificate = await issueCertificate({ type: "STUDY", studentId, issuedById: authorization.issuedById });

  const latestEnrollment = student.enrollments[0];
  const grade = latestEnrollment ? classGradeLevelValue(latestEnrollment.class) : student.gradeLevel;
  const group = student.studentGroup || "-";
  const year = latestEnrollment?.year || new Date().getFullYear();
  const branding = await getBrandingSettings();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"constancia-estudio-${student.id}.pdf\"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  if (branding.logoDataUrl) {
    try {
      const base64 = String(branding.logoDataUrl).split(",")[1];
      if (base64) {
        doc.image(Buffer.from(base64, "base64"), 50, 40, { fit: [56, 56] });
      }
    } catch {
      // ignore logo parse errors
    }
  }

  doc.fontSize(18).text(branding.schoolName || "Institucion Educativa", 120, 52);
  doc.moveDown(2);
  doc.fontSize(16).text("Constancia de Estudio", { align: "center" });
  doc.moveDown(1.5);
  doc.fontSize(12).text(
    `La institucion certifica que el(la) estudiante ${student.fullName}, identificado(a) en el sistema institucional, `
      + `se encuentra matriculado(a) y activo(a) en el grado ${grade}, grupo ${group}, durante el ano lectivo ${year}.`,
    { align: "justify" }
  );
  doc.moveDown(2);
  doc.text(`Consecutivo: EST-${certificate.year}-${String(certificate.serial).padStart(5, "0")}`);
  doc.text(`Codigo de verificacion: ${certificate.code}`);
  doc.moveDown(0.5);
  doc.text(`Fecha de expedicion: ${new Date().toISOString().slice(0, 10)}`);
  doc.moveDown(2);
  doc.text("_______________________________");
  doc.text("Secretaria Academica");
  if (branding.footerText) {
    doc.moveDown(2);
    doc.fontSize(10).fillColor("#64748b").text(branding.footerText, { align: "center" });
  }
  doc.end();
});

router.get("/certificate/enrollment/:studentId", requireAuth, requireRole(["ADMIN", "TEACHER", "PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const studentId = String(req.params.studentId || "");
  if (!studentId) return res.status(400).json({ error: "Student id required" });

  const canAccess = await assertParentCanAccessStudent(auth, studentId);
  if (!canAccess) return res.status(403).json({ error: "Forbidden" });

  const authorization = await resolveCertificateIssuer(auth, studentId, "ENROLLMENT");
  if (!authorization.allowed) {
    return res.status(403).json({ error: "Requiere autorizacion administrativa" });
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId },
    include: { student: true, class: true },
    orderBy: { year: "desc" }
  });
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
  const certificate = await issueCertificate({ type: "ENROLLMENT", studentId, issuedById: authorization.issuedById });

  const branding = await getBrandingSettings();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"certificado-matricula-${enrollment.student.id}.pdf\"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  if (branding.logoDataUrl) {
    try {
      const base64 = String(branding.logoDataUrl).split(",")[1];
      if (base64) {
        doc.image(Buffer.from(base64, "base64"), 50, 40, { fit: [56, 56] });
      }
    } catch {
      // ignore logo parse errors
    }
  }

  doc.fontSize(18).text(branding.schoolName || "Institucion Educativa", 120, 52);
  doc.moveDown(2);
  doc.fontSize(16).text("Certificado de Matricula", { align: "center" });
  doc.moveDown(1.5);
  doc.fontSize(12).text(`Estudiante: ${enrollment.student.fullName}`);
  doc.text(`Grado: ${classGradeLevelValue(enrollment.class)}`);
  doc.text(`Grupo: ${enrollment.student.studentGroup || "-"}`);
  doc.text(`Ano lectivo: ${enrollment.year}`);
  doc.text(`Estado de matricula: ${enrollment.status}`);
  doc.text(`Acudiente registrado: ${enrollment.guardianFullName}`);
  doc.moveDown(1.5);
  doc.text(`Consecutivo: MAT-${certificate.year}-${String(certificate.serial).padStart(5, "0")}`);
  doc.text(`Codigo de verificacion: ${certificate.code}`);
  doc.moveDown(0.5);
  doc.text(`Fecha de expedicion: ${new Date().toISOString().slice(0, 10)}`);
  doc.moveDown(2);
  doc.text("_______________________________");
  doc.text("Secretaria Academica");
  if (branding.footerText) {
    doc.moveDown(2);
    doc.fontSize(10).fillColor("#64748b").text(branding.footerText, { align: "center" });
  }
  doc.end();
});

router.get("/certificate/verify/:code", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const auth = (req as any).auth;
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ message: "Codigo requerido" });

  const issued = await prisma.certificateIssue.findUnique({
    where: { code },
    include: {
      student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
      issuedBy: { select: { id: true, fullName: true, role: true } }
    }
  });
  if (!issued) return res.status(404).json({ valid: false, message: "Certificado no encontrado" });

  const canAccess = await assertParentCanAccessStudent(auth, issued.studentId);
  if (!canAccess) return res.status(403).json({ message: "Forbidden" });

  res.json({
    valid: true,
    certificate: {
      type: issued.type,
      serial: issued.serial,
      year: issued.year,
      code: issued.code,
      issuedAt: issued.issuedAt,
      student: issued.student,
      issuedBy: issued.issuedBy
    }
  });
});

router.get("/certificates", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const type = String(req.query.type || "").trim();
  const code = String(req.query.code || "").trim();
  const fromDate = String(req.query.fromDate || "").trim();
  const toDate = String(req.query.toDate || "").trim();
  const student = String(req.query.student || "").trim();
  const issuedBy = String(req.query.issuedBy || "").trim();

  const where: Prisma.CertificateIssueWhereInput = {
    ...(type ? { type: type as any } : {}),
    ...(code ? { code: { contains: code, mode: "insensitive" } } : {}),
    ...(fromDate || toDate
      ? {
          issuedAt: {
            ...(fromDate ? { gte: new Date(`${fromDate}T00:00:00.000Z`) } : {}),
            ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {})
          }
        }
      : {}),
    ...(student
      ? {
          student: {
            fullName: { contains: student, mode: "insensitive" }
          }
        }
      : {}),
    ...(issuedBy
      ? {
          issuedBy: {
            fullName: { contains: issuedBy, mode: "insensitive" }
          }
        }
      : {})
  };

  const [data, total] = await Promise.all([
    prisma.certificateIssue.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
        issuedBy: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: [{ issuedAt: "desc" }, { year: "desc" }, { serial: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.certificateIssue.count({ where })
  ]);

  res.json({ data, total, page, pageSize });
});

router.get("/certificates/export/excel", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const type = String(req.query.type || "").trim();
  const code = String(req.query.code || "").trim();
  const fromDate = String(req.query.fromDate || "").trim();
  const toDate = String(req.query.toDate || "").trim();
  const student = String(req.query.student || "").trim();
  const issuedBy = String(req.query.issuedBy || "").trim();

  const where: Prisma.CertificateIssueWhereInput = {
    ...(type ? { type: type as any } : {}),
    ...(code ? { code: { contains: code, mode: "insensitive" } } : {}),
    ...(fromDate || toDate
      ? {
          issuedAt: {
            ...(fromDate ? { gte: new Date(`${fromDate}T00:00:00.000Z`) } : {}),
            ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {})
          }
        }
      : {}),
    ...(student
      ? {
          student: {
            fullName: { contains: student, mode: "insensitive" }
          }
        }
      : {}),
    ...(issuedBy
      ? {
          issuedBy: {
            fullName: { contains: issuedBy, mode: "insensitive" }
          }
        }
      : {})
  };

  const data = await prisma.certificateIssue.findMany({
    where,
    include: {
      student: { select: { fullName: true, gradeLevel: true, studentGroup: true } },
      issuedBy: { select: { fullName: true, role: true } }
    },
    orderBy: [{ issuedAt: "desc" }, { year: "desc" }, { serial: "desc" }]
  });

  const branding = await getBrandingSettings();
  const xlsx = buildXlsxReportBuffer({
    title: "Libro de Certificados Emitidos",
    institutionName: branding.schoolName,
    columns: [
      { key: "issuedAt", label: "Fecha" },
      { key: "type", label: "Tipo" },
      { key: "serial", label: "Consecutivo" },
      { key: "code", label: "Codigo" },
      { key: "student", label: "Estudiante" },
      { key: "grade", label: "Grado" },
      { key: "group", label: "Grupo" },
      { key: "issuedBy", label: "Emitido por" }
    ],
    rows: data.map((i) => ({
      issuedAt: i.issuedAt.toISOString().slice(0, 10),
      type: i.type === "STUDY" ? "CONSTANCIA_ESTUDIO" : "CERTIFICADO_MATRICULA",
      serial: `${i.year}-${String(i.serial).padStart(5, "0")}`,
      code: i.code,
      student: i.student.fullName,
      grade: i.student.gradeLevel,
      group: i.student.studentGroup || "-",
      issuedBy: i.issuedBy.fullName
    }))
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"libro-certificados.xlsx\"");
  res.send(xlsx);
});

router.get("/certificates/export/pdf", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const type = String(req.query.type || "").trim();
  const code = String(req.query.code || "").trim();
  const fromDate = String(req.query.fromDate || "").trim();
  const toDate = String(req.query.toDate || "").trim();
  const student = String(req.query.student || "").trim();
  const issuedBy = String(req.query.issuedBy || "").trim();

  const where: Prisma.CertificateIssueWhereInput = {
    ...(type ? { type: type as any } : {}),
    ...(code ? { code: { contains: code, mode: "insensitive" } } : {}),
    ...(fromDate || toDate
      ? {
          issuedAt: {
            ...(fromDate ? { gte: new Date(`${fromDate}T00:00:00.000Z`) } : {}),
            ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {})
          }
        }
      : {}),
    ...(student
      ? {
          student: {
            fullName: { contains: student, mode: "insensitive" }
          }
        }
      : {}),
    ...(issuedBy
      ? {
          issuedBy: {
            fullName: { contains: issuedBy, mode: "insensitive" }
          }
        }
      : {})
  };

  const data = await prisma.certificateIssue.findMany({
    where,
    include: {
      student: { select: { fullName: true, gradeLevel: true, studentGroup: true } },
      issuedBy: { select: { fullName: true, role: true } }
    },
    orderBy: [{ issuedAt: "desc" }, { year: "desc" }, { serial: "desc" }]
  });
  const branding = await getBrandingSettings();
  sendTabularPdf(res, {
    fileName: "libro-certificados.pdf",
    title: "Libro de Certificados Emitidos",
    branding,
    columns: [
      { key: "issuedAt", label: "Fecha", width: 62, align: "center" },
      { key: "type", label: "Tipo", width: 80, align: "center" },
      { key: "serial", label: "Consec.", width: 62, align: "center" },
      { key: "code", label: "Codigo", width: 110, align: "center" },
      { key: "student", label: "Estudiante", width: 120 },
      { key: "grade", label: "Grado", width: 55, align: "center" },
      { key: "group", label: "Grupo", width: 45, align: "center" },
      { key: "issuedBy", label: "Emitido por", width: 100 }
    ],
    rows: data.map((i) => ({
      issuedAt: i.issuedAt.toISOString().slice(0, 10),
      type: i.type === "STUDY" ? "ESTUDIO" : "MATRICULA",
      serial: `${i.year}-${String(i.serial).padStart(5, "0")}`,
      code: i.code,
      student: i.student.fullName,
      grade: i.student.gradeLevel,
      group: i.student.studentGroup || "-",
      issuedBy: i.issuedBy.fullName
    }))
  });
});

export default router;
