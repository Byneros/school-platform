import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { stripNotificationMeta } from "../utils/notificationMeta.js";

const router = Router();

function getEnrollmentGradeLevel(enrollment: any) {
  return String(enrollment?.class?.gradeLevel || "").trim();
}

router.get("/children", requireAuth, requireRole(["PARENT"]), async (req, res) => {
  const auth = (req as any).auth;
  const parent = await prisma.parent.findUnique({ where: { userId: auth.userId } });
  if (!parent) return res.json([]);

  const guardians = await prisma.guardian.findMany({
    where: { parentId: parent.id },
    include: { student: true }
  });

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
  const [data, total] = await Promise.all([
    prisma.grade.findMany({
      where: { enrollment: { studentId: { in: studentIds }, ...(studentId ? { studentId } : {}) }, ...(period ? { period } : {}) },
      include: { enrollment: { include: { student: true, class: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.grade.count({
      where: {
        enrollment: { studentId: { in: studentIds }, ...(studentId ? { studentId } : {}) },
        ...(period ? { period } : {})
      }
    })
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

export default router;
