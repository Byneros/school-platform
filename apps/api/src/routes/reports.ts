import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import PDFDocument from "pdfkit";
import { randomUUID } from "crypto";
import { buildCsvReport, buildXlsxReportBuffer, sendTabularPdf } from "../utils/reportExport.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";

const router = Router();

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

async function assertParentCanAccessStudent(auth: { userId: string; role: string }, studentId: string) {
  if (auth?.role !== "PARENT") return true;
  const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
  if (!parent) return false;
  const guardian = await prisma.guardian.findFirst({
    where: { parentId: parent.id, studentId }
  });
  return Boolean(guardian);
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

// Reporte: boletin en PDF
router.get("/report-card/:studentId", requireAuth, requireRole(["ADMIN", "TEACHER", "PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const canAccess = await assertParentCanAccessStudent(auth, req.params.studentId);
  if (!canAccess) {
    return res.status(403).json({ error: "Forbidden" });
  }

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

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"boletin-${student.id}.pdf\"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(20).text("Boletin de Calificaciones", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Estudiante: ${student.fullName}`);
  doc.text(`Grado: ${student.gradeLevel}`);
  doc.moveDown();

  student.enrollments.forEach((enr) => {
    doc.fontSize(14).text(`Grado ${classGradeLevelValue(enr.class)}`, { underline: true });
    if (enr.grades.length === 0) {
      doc.fontSize(11).text("Sin calificaciones registradas.");
    } else {
      enr.grades.forEach((g) => {
        doc.fontSize(11).text(`- ${g.name} (${g.period}): ${g.score}/${g.maxScore}`);
      });
    }
    doc.moveDown(0.5);
  });

  doc.end();
});

router.get("/certificate/study/:studentId", requireAuth, requireRole(["ADMIN", "TEACHER", "PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const studentId = String(req.params.studentId || "");
  if (!studentId) return res.status(400).json({ error: "Student id required" });

  const canAccess = await assertParentCanAccessStudent(auth, studentId);
  if (!canAccess) return res.status(403).json({ error: "Forbidden" });

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
  const certificate = await issueCertificate({ type: "STUDY", studentId, issuedById: auth.userId });

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

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId },
    include: { student: true, class: true },
    orderBy: { year: "desc" }
  });
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
  const certificate = await issueCertificate({ type: "ENROLLMENT", studentId, issuedById: auth.userId });

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

router.get("/certificate/verify/:code", requireAuth, requireRole(["ADMIN", "TEACHER", "PARENT"]), async (req, res) => {
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
