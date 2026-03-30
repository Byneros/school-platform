import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { composeNotificationBodyWithMeta, stripNotificationMeta } from "../utils/notificationMeta.js";

const router = Router();

function getEnrollmentGradeLevel(enrollment: any) {
  return String(enrollment?.class?.gradeLevel || "").trim();
}

router.get("/children", requireAuth, requireRole(["PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const parent = await prisma.parent.findUnique({
    where: { userId: auth.userId },
    include: { user: { select: { email: true } } }
  });
  if (!parent) return res.json([]);

  let guardians = await prisma.guardian.findMany({
    where: { parentId: parent.id },
    include: { student: true }
  });

  const parentEmail = String(parent.user?.email || "").trim();
  if (parentEmail) {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        contactEmail: { equals: parentEmail, mode: "insensitive" as const }
      },
      select: { studentId: true, guardianRelation: true }
    });
    if (enrollments.length > 0) {
      await prisma.$transaction(
        enrollments.map((enr) =>
          prisma.guardian.upsert({
            where: {
              parentId_studentId: {
                parentId: parent.id,
                studentId: enr.studentId
              }
            },
            update: { relation: enr.guardianRelation || "Acudiente" },
            create: {
              parentId: parent.id,
              studentId: enr.studentId,
              relation: enr.guardianRelation || "Acudiente"
            }
          })
        )
      );
      guardians = await prisma.guardian.findMany({
        where: { parentId: parent.id },
        include: { student: true }
      });
    }
  }

  res.json(guardians.map((g) => g.student));
});

router.get("/boletines", requireAuth, requireRole(["PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
  if (!parent) return res.json([]);

  const guardians = await prisma.guardian.findMany({
    where: { parentId: parent.id },
    select: { studentId: true }
  });
  const studentIds = guardians.map((g) => g.studentId);

  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const period = String(req.query.period || "").trim();
  const studentId = String(req.query.studentId || "").trim();
  const grades = await prisma.grade.findMany({
    where: { enrollment: { studentId: { in: studentIds }, ...(studentId ? { studentId } : {}) }, ...(period ? { period } : {}) },
    include: { enrollment: { include: { student: true, class: true } } },
    orderBy: { createdAt: "desc" }
  });

  const grouped = new Map<string, {
    enrollmentId: string;
    studentId: string;
    student: string;
    grade: string;
    group: string;
    period: string;
    subject: string;
    maxScore: number;
    sum: number;
    count: number;
  }>();

  grades.forEach((item) => {
    const enrollment = item.enrollment;
    if (!enrollment) return;
    const gradeLevel = getEnrollmentGradeLevel(enrollment);
    const groupName = String(enrollment?.student?.studentGroup || "");
    const subject = String(item.name || "").trim();
    if (!subject) return;
    const key = `${enrollment.id}::${item.period}::${subject}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        student: enrollment.student?.fullName || "",
        grade: gradeLevel,
        group: groupName,
        period: item.period,
        subject,
        maxScore: Number(item.maxScore || 0),
        sum: 0,
        count: 0
      });
    }
    const entry = grouped.get(key)!;
    const currentMax = Number(item.maxScore || 0);
    if (entry.maxScore <= 0 && currentMax > 0) entry.maxScore = currentMax;
    const baseMax = entry.maxScore || currentMax;
    const normalized = currentMax > 0 ? (Number(item.score) / currentMax) * baseMax : 0;
    entry.sum += normalized;
    entry.count += 1;
  });

  const rows = Array.from(grouped.values()).map((entry) => {
    const finalScore = entry.count ? entry.sum / entry.count : 0;
    return {
      enrollmentId: entry.enrollmentId,
      studentId: entry.studentId,
      student: entry.student,
      grade: entry.grade,
      group: entry.group,
      period: entry.period,
      subject: entry.subject,
      finalScore: Number(finalScore.toFixed(2)),
      maxScore: entry.maxScore
    };
  }).sort((a, b) => {
    const studentA = String(a.student || "");
    const studentB = String(b.student || "");
    if (studentA !== studentB) return studentA.localeCompare(studentB, "es");
    const gradeA = String(a.grade || "");
    const gradeB = String(b.grade || "");
    if (gradeA !== gradeB) return gradeA.localeCompare(gradeB, "es");
    const groupA = String(a.group || "");
    const groupB = String(b.group || "");
    if (groupA !== groupB) return groupA.localeCompare(groupB, "es");
    const periodA = String(a.period || "");
    const periodB = String(b.period || "");
    if (periodA !== periodB) return periodA.localeCompare(periodB, "es");
    return String(a.subject || "").localeCompare(String(b.subject || ""), "es");
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const data = rows.slice(start, start + pageSize);

  res.json({ data, total, page, pageSize });
});

router.get("/invoices", requireAuth, requireRole(["PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
  if (!parent) return res.json([]);

  const guardians = await prisma.guardian.findMany({
    where: { parentId: parent.id },
    select: { studentId: true }
  });
  const studentIds = guardians.map((g) => g.studentId);

  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();
  const studentId = String(req.query.studentId || "").trim();
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId: { in: studentIds }, ...(studentId ? { studentId } : {}), ...(status ? { status: status as any } : {}) },
      include: { student: true, payments: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.invoice.count({ where: { studentId: { in: studentIds }, ...(status ? { status: status as any } : {}) } })
  ]);

  res.json({ data, total, page, pageSize });
});

router.get("/notifications", requireAuth, requireRole(["PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
  if (!parent) return res.json([]);

  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();
  const [data, total] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where: { parentId: parent.id, ...(status ? { notification: { status: status as any } } : {}) },
      include: { notification: true },
      orderBy: { notification: { createdAt: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notificationRecipient.count({ where: { parentId: parent.id, ...(status ? { notification: { status: status as any } } : {}) } })
  ]);

  res.json({
    data: data.map((item) => ({
      ...item,
      notification: item.notification
        ? {
            ...item.notification,
            body: stripNotificationMeta(item.notification.body)
          }
        : item.notification
    })),
    total,
    page,
    pageSize
  });
});

router.post("/association-request", requireAuth, requireRole(["PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const parent = await prisma.parent.findUnique({
    where: { userId: auth.userId },
    include: { user: { select: { email: true, fullName: true } } }
  });
  if (!parent) return res.status(404).json({ message: "Acudiente no encontrado" });

  const recentWindow = new Date();
  recentWindow.setDate(recentWindow.getDate() - 7);
  const existing = await prisma.notification.count({
    where: {
      createdById: auth.userId,
      title: "Solicitud de asociacion de acudiente",
      status: "PENDING",
      createdAt: { gte: recentWindow },
      body: { contains: "[[audience:ADMINS]]" }
    }
  });
  if (existing > 0) {
    return res.json({ ok: true, alreadyPending: true, message: "Ya existe una solicitud pendiente en los ultimos dias." });
  }

  const guardians = await prisma.guardian.findMany({
    where: { parentId: parent.id },
    include: { student: { select: { fullName: true, gradeLevel: true, studentGroup: true } } }
  });

  const studentLines =
    guardians.length > 0
      ? guardians.map((g) =>
          `${g.student?.fullName || "-"}${g.student?.gradeLevel ? ` (${g.student.gradeLevel}${g.student?.studentGroup ? `-${g.student.studentGroup}` : ""})` : ""}`
        )
      : ["(Sin estudiantes vinculados)"];

  const note = String((req as any).body?.message || "").trim();
  const bodyLines = [
    "Solicitud de asociacion de acudiente",
    `Nombre: ${parent.user?.fullName || "-"}`,
    `Correo: ${parent.user?.email || "-"}`,
    "Estudiantes vinculados:",
    ...studentLines,
    ...(note ? ["", `Mensaje: ${note}`] : [])
  ];

  const notification = await prisma.notification.create({
    data: {
      title: "Solicitud de asociacion de acudiente",
      body: composeNotificationBodyWithMeta(bodyLines.join("\n"), "ADMINS", null),
      status: "PENDING",
      createdById: auth.userId
    }
  });

  res.json({ ok: true, notificationId: notification.id });
});

export default router;
