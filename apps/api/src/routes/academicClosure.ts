import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { buildXlsxReportBuffer, sendTabularPdf } from "../utils/reportExport.js";
import { getBrandingSettings, saveBrandingSettings } from "../utils/brandingSettings.js";

const router = Router();

function toPercent(score: number, maxScore: number) {
  if (!maxScore || maxScore <= 0) return 0;
  return (score / maxScore) * 100;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

async function computeResultsForYear(
  year: number,
  rules: {
    minAverage: number;
    maxFailedSubjects: number;
  }
) {
  const enrollments = await prisma.enrollment.findMany({
    where: { year },
    include: {
      class: { select: { gradeLevel: true } },
      student: { select: { fullName: true, studentGroup: true } },
      grades: true,
    },
    orderBy: [{ studentFullName: "asc" }],
  });

  return enrollments.map((enrollment) => {
    const bySubject = new Map<string, number[]>();
    for (const g of enrollment.grades) {
      const key = String(g.name || "").trim() || "SIN_ASIGNATURA";
      const val = toPercent(Number(g.score || 0), Number(g.maxScore || 0));
      const list = bySubject.get(key) || [];
      list.push(val);
      bySubject.set(key, list);
    }

    const subjectAverages = Array.from(bySubject.entries()).map(([subject, scores]) => ({
      subject,
      average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    }));

    const totalSubjects = subjectAverages.length;
    const failedSubjects = subjectAverages.filter((s) => s.average < rules.minAverage).length;
    const finalAverage = round2(
      subjectAverages.length
        ? subjectAverages.reduce((a, s) => a + s.average, 0) / subjectAverages.length
        : 0
    );

    let status: "PROMOTED" | "NOT_PROMOTED" | "PENDING" = "PENDING";
    let notes = "Sin calificaciones suficientes para cierre.";
    if (totalSubjects > 0) {
      if (failedSubjects <= rules.maxFailedSubjects && finalAverage >= rules.minAverage) {
        status = "PROMOTED";
        notes = `Cumple criterio: promedio >= ${rules.minAverage} y <= ${rules.maxFailedSubjects} asignaturas reprobadas.`;
      } else {
        status = "NOT_PROMOTED";
        notes = `No cumple criterio: promedio >= ${rules.minAverage} y <= ${rules.maxFailedSubjects} asignaturas reprobadas.`;
      }
    }

    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      studentName: enrollment.student?.fullName || enrollment.studentFullName,
      gradeLevel: String(enrollment.class?.gradeLevel || enrollment.studentGradeLevel || ""),
      group: String(enrollment.student?.studentGroup || ""),
      finalAverage,
      totalSubjects,
      failedSubjects,
      status,
      notes,
    };
  });
}

router.get("/settings", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const branding = await getBrandingSettings();
  const minAverage = Number(branding.promotionRules?.minAverage ?? 60);
  const maxFailedSubjects = Number(branding.promotionRules?.maxFailedSubjects ?? 2);
  res.json({ minAverage, maxFailedSubjects });
});

router.get("/settings/history", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const branding = await getBrandingSettings();
  const history = Array.isArray(branding.promotionRulesHistory)
    ? branding.promotionRulesHistory
    : [];
  const total = history.length;
  const start = Math.max(0, (page - 1) * pageSize);
  const data = history.slice(start, start + pageSize).map((item: any) => {
    const source = item?.restoredFromId
      ? history.find((h: any) => h.id === item.restoredFromId)
      : null;
    return {
      ...item,
      restoredFrom: source
        ? {
            id: source.id,
            changedAt: source.changedAt,
            changedByName: source.changedByName,
            next: source.next,
          }
        : null,
    };
  });
  res.json({ data, total, page, pageSize });
});

router.put("/settings", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const auth = (req as any).auth as { userId: string };
  const minAverage = Number(req.body?.minAverage);
  const maxFailedSubjects = Number(req.body?.maxFailedSubjects);
  if (Number.isNaN(minAverage) || minAverage < 0 || minAverage > 100) {
    return res.status(400).json({ message: "El promedio minimo debe estar entre 0 y 100" });
  }
  if (!Number.isInteger(maxFailedSubjects) || maxFailedSubjects < 0 || maxFailedSubjects > 20) {
    return res
      .status(400)
      .json({ message: "Las asignaturas reprobadas maximas deben ser un entero entre 0 y 20" });
  }
  const current = await getBrandingSettings();
  const currentRules = {
    minAverage: Number(current.promotionRules?.minAverage ?? 60),
    maxFailedSubjects: Number(current.promotionRules?.maxFailedSubjects ?? 2),
  };
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { fullName: true },
  });

  const changed =
    currentRules.minAverage !== minAverage || currentRules.maxFailedSubjects !== maxFailedSubjects;

  const nextHistory = changed
    ? [
        {
          id: randomUUID(),
          changedAt: new Date().toISOString(),
          changedById: auth.userId,
          changedByName: user?.fullName || "Administrador",
          previous: currentRules,
          next: { minAverage, maxFailedSubjects },
        },
        ...(Array.isArray(current.promotionRulesHistory) ? current.promotionRulesHistory : []),
      ].slice(0, 200)
    : Array.isArray(current.promotionRulesHistory)
      ? current.promotionRulesHistory
      : [];

  const updated = await saveBrandingSettings({
    promotionRules: {
      minAverage,
      maxFailedSubjects,
    },
    promotionRulesHistory: nextHistory,
  } as any);
  res.json(updated.promotionRules);
});

router.post("/settings/restore", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const auth = (req as any).auth as { userId: string };
  const versionId = String(req.body?.id || "").trim();
  if (!versionId) return res.status(400).json({ message: "Version invalida" });

  const current = await getBrandingSettings();
  const history = Array.isArray(current.promotionRulesHistory) ? current.promotionRulesHistory : [];
  const target = history.find((h) => h.id === versionId);
  if (!target) return res.status(404).json({ message: "Version no encontrada" });

  const currentRules = {
    minAverage: Number(current.promotionRules?.minAverage ?? 60),
    maxFailedSubjects: Number(current.promotionRules?.maxFailedSubjects ?? 2),
  };
  const nextRules = {
    minAverage: Number(target.next?.minAverage ?? 60),
    maxFailedSubjects: Number(target.next?.maxFailedSubjects ?? 2),
  };

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { fullName: true },
  });

  const restoredHistory = [
    {
      id: randomUUID(),
      changedAt: new Date().toISOString(),
      changedById: auth.userId,
      changedByName: user?.fullName || "Administrador",
      restoredFromId: versionId,
      previous: currentRules,
      next: nextRules,
    },
    ...history,
  ].slice(0, 200);

  const updated = await saveBrandingSettings({
    promotionRules: nextRules,
    promotionRulesHistory: restoredHistory,
  } as any);

  res.json({
    ok: true,
    restoredFromId: versionId,
    promotionRules: updated.promotionRules,
  });
});

router.get("/preview", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ message: "Ano invalido" });
  }
  const branding = await getBrandingSettings();
  const data = await computeResultsForYear(year, {
    minAverage: Number(branding.promotionRules?.minAverage ?? 60),
    maxFailedSubjects: Number(branding.promotionRules?.maxFailedSubjects ?? 2),
  });
  res.json({ year, data, total: data.length });
});

router.post("/run", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const auth = (req as any).auth as { userId: string };
  const year = Number(req.body?.year || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ message: "Ano invalido" });
  }

  const branding = await getBrandingSettings();
  const rules = {
    minAverage: Number(branding.promotionRules?.minAverage ?? 60),
    maxFailedSubjects: Number(branding.promotionRules?.maxFailedSubjects ?? 2),
  };
  const computed = await computeResultsForYear(year, rules);
  const result = await prisma.$transaction(async (tx) => {
    for (const row of computed) {
      await tx.academicClosureResult.upsert({
        where: { year_enrollmentId: { year, enrollmentId: row.enrollmentId } },
        create: {
          year,
          enrollmentId: row.enrollmentId,
          finalAverage: row.finalAverage,
          totalSubjects: row.totalSubjects,
          failedSubjects: row.failedSubjects,
          status: row.status,
          notes: row.notes,
          closedById: auth.userId,
        },
        update: {
          finalAverage: row.finalAverage,
          totalSubjects: row.totalSubjects,
          failedSubjects: row.failedSubjects,
          status: row.status,
          notes: row.notes,
          closedById: auth.userId,
          closedAt: new Date(),
        },
      });
    }
    return computed.length;
  });

  res.json({ ok: true, year, processed: result, rules });
});

router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const group = String(req.query.group || "").trim();
  const search = String(req.query.search || "").trim();

  const where: Prisma.AcademicClosureResultWhereInput = {
    year,
    ...(status ? { status: status as any } : {}),
    enrollment: {
      ...(search
        ? {
            OR: [
              { studentFullName: { contains: search, mode: "insensitive" } },
              { student: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(gradeLevel ? { class: { gradeLevel: gradeLevel as any } } : {}),
      ...(group ? { student: { studentGroup: group } } : {}),
    },
  };

  const [data, total] = await Promise.all([
    prisma.academicClosureResult.findMany({
      where,
      include: {
        enrollment: { include: { student: true, class: true } },
        closedBy: { select: { fullName: true, role: true } },
      },
      orderBy: [{ status: "asc" }, { finalAverage: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.academicClosureResult.count({ where }),
  ]);
  res.json({ data, total, page, pageSize, year });
});

router.get("/export/excel", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const group = String(req.query.group || "").trim();
  const search = String(req.query.search || "").trim();
  const where: Prisma.AcademicClosureResultWhereInput = {
    year,
    ...(status ? { status: status as any } : {}),
    enrollment: {
      ...(search
        ? {
            OR: [
              { studentFullName: { contains: search, mode: "insensitive" } },
              { student: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(gradeLevel ? { class: { gradeLevel: gradeLevel as any } } : {}),
      ...(group ? { student: { studentGroup: group } } : {}),
    },
  };
  const data = await prisma.academicClosureResult.findMany({
    where,
    include: {
      enrollment: { include: { student: true, class: true } },
      closedBy: { select: { fullName: true } },
    },
    orderBy: [{ status: "asc" }, { finalAverage: "desc" }],
  });
  const branding = await getBrandingSettings();
  const xlsx = await buildXlsxReportBuffer({
    title: `Cierre Academico y Promocion ${year}`,
    institutionName: branding.schoolName,
    columns: [
      { key: "student", label: "Estudiante" },
      { key: "grade", label: "Grado" },
      { key: "group", label: "Grupo" },
      { key: "finalAverage", label: "Promedio final" },
      { key: "totalSubjects", label: "Asignaturas" },
      { key: "failedSubjects", label: "Reprobadas" },
      { key: "status", label: "Estado final" },
      { key: "closedBy", label: "Cerrado por" },
      { key: "closedAt", label: "Fecha cierre" },
    ],
    rows: data.map((r) => ({
      student: r.enrollment?.student?.fullName || r.enrollment?.studentFullName || "-",
      grade: String(r.enrollment?.class?.gradeLevel || r.enrollment?.studentGradeLevel || ""),
      group: String(r.enrollment?.student?.studentGroup || ""),
      finalAverage: round2(r.finalAverage),
      totalSubjects: r.totalSubjects,
      failedSubjects: r.failedSubjects,
      status: r.status,
      closedBy: r.closedBy?.fullName || "-",
      closedAt: r.closedAt.toISOString().slice(0, 10),
    })),
  });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="cierre-academico-${year}.xlsx"`);
  res.send(xlsx);
});

router.get("/export/pdf", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const status = String(req.query.status || "").trim();
  const gradeLevel = String(req.query.gradeLevel || "").trim();
  const group = String(req.query.group || "").trim();
  const search = String(req.query.search || "").trim();
  const where: Prisma.AcademicClosureResultWhereInput = {
    year,
    ...(status ? { status: status as any } : {}),
    enrollment: {
      ...(search
        ? {
            OR: [
              { studentFullName: { contains: search, mode: "insensitive" } },
              { student: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(gradeLevel ? { class: { gradeLevel: gradeLevel as any } } : {}),
      ...(group ? { student: { studentGroup: group } } : {}),
    },
  };
  const data = await prisma.academicClosureResult.findMany({
    where,
    include: {
      enrollment: { include: { student: true, class: true } },
      closedBy: { select: { fullName: true } },
    },
    orderBy: [{ status: "asc" }, { finalAverage: "desc" }],
  });
  const branding = await getBrandingSettings();
  sendTabularPdf(res, {
    fileName: `cierre-academico-${year}.pdf`,
    title: `Cierre Academico y Promocion ${year}`,
    branding,
    columns: [
      { key: "student", label: "Estudiante", width: 120 },
      { key: "grade", label: "Grado", width: 60, align: "center" },
      { key: "group", label: "Grupo", width: 40, align: "center" },
      { key: "finalAverage", label: "Prom.", width: 45, align: "center" },
      { key: "failedSubjects", label: "Rep.", width: 35, align: "center" },
      { key: "status", label: "Estado", width: 72, align: "center" },
      { key: "closedBy", label: "Cerrado por", width: 95 },
      { key: "closedAt", label: "Fecha", width: 55, align: "center" },
    ],
    rows: data.map((r) => ({
      student: r.enrollment?.student?.fullName || r.enrollment?.studentFullName || "-",
      grade: String(r.enrollment?.class?.gradeLevel || r.enrollment?.studentGradeLevel || ""),
      group: String(r.enrollment?.student?.studentGroup || ""),
      finalAverage: round2(r.finalAverage),
      failedSubjects: r.failedSubjects,
      status: r.status,
      closedBy: r.closedBy?.fullName || "-",
      closedAt: r.closedAt.toISOString().slice(0, 10),
    })),
  });
});

export default router;
