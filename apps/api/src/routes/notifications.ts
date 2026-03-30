import { Router } from "express";
import prisma from "../utils/prisma.js";
import { enqueueNotification } from "../services/notificationQueue.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../utils/validate.js";
import { createAdminNotificationSchema, createNotificationSchema, approveNotificationSchema, updateNotificationSchema } from "../schemas/notifications.js";
import {
  composeNotificationBodyWithMeta,
  extractNotificationAudience,
  extractNotificationLegalReference,
  stripNotificationMeta
} from "../utils/notificationMeta.js";

const router = Router();

async function ensureParentRecipientsForNotification(notificationId: string) {
  const parents = await prisma.parent.findMany({
    select: { id: true }
  });
  if (!parents.length) return 0;
  await prisma.notificationRecipient.createMany({
    data: parents.map((p) => ({
      notificationId,
      parentId: p.id
    })),
    skipDuplicates: true
  });
  return parents.length;
}

// Docente crea notificacion (pendiente)
router.post("/", requireAuth, requireRole(["TEACHER"]), validate(createNotificationSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { body } = (req as any).validated;
  if (body.studentId) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: auth.userId } });
    if (!teacher) return res.status(403).json({ error: "Forbidden" });
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: body.studentId, class: { teacherId: teacher.id } }
    });
    if (!enrollment) return res.status(403).json({ error: "Student not assigned to teacher" });
  }
  const notification = await prisma.notification.create({
    data: {
      title: body.title,
      body: composeNotificationBodyWithMeta(body.body, "PARENTS", body.legalReference),
      studentId: body.studentId,
      status: "PENDING",
      createdById: auth.userId
    }
  });
  res.json({
    ...notification,
    audience: "PARENTS",
    legalReference: body.legalReference || null,
    body: stripNotificationMeta(notification.body)
  });
});

// Admin crea notificacion y define audiencia (padres, docentes o ambos)
router.post("/admin", requireAuth, requireRole(["ADMIN"]), validate(createAdminNotificationSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { body } = (req as any).validated;
  const audience = body.audience;
  const studentId = body.studentId ? String(body.studentId).trim() : "";
  const targetUserId = body.targetUserId ? String(body.targetUserId).trim() : "";

  if (studentId && !(audience === "PARENTS" || audience === "BOTH")) {
    return res.status(400).json({ message: "studentId solo aplica para audiencia de padres" });
  }
  if (targetUserId && !(audience === "TEACHERS" || audience === "BOTH")) {
    return res.status(400).json({ message: "targetUserId solo aplica para audiencia de docentes" });
  }

  if (studentId) {
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) return res.status(404).json({ message: "Estudiante no encontrado" });
  }
  if (targetUserId) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true } });
    if (!target || target.role !== "TEACHER") {
      return res.status(400).json({ message: "Docente no valido para notificacion individual" });
    }
  }

  const notification = await prisma.notification.create({
    data: {
      title: body.title,
      body: composeNotificationBodyWithMeta(body.body, body.audience, body.legalReference),
      status: "APPROVED",
      createdById: auth.userId,
      approvedById: auth.userId,
      approvedAt: new Date(),
      ...(studentId ? { studentId } : {}),
      ...(targetUserId ? { targetUserId } : {})
    }
  });
  let parentRecipients = 0;
  if (body.audience === "PARENTS" || body.audience === "BOTH") {
    parentRecipients = await ensureParentRecipientsForNotification(notification.id);
  }
  const queueResult = await enqueueNotification(notification.id);
  res.json({
    ...notification,
    audience: body.audience,
    legalReference: body.legalReference || null,
    body: stripNotificationMeta(notification.body),
    parentRecipients,
    queue: queueResult
  });
});

// Admin aprueba
router.post("/:id/approve", requireAuth, requireRole(["ADMIN"]), validate(approveNotificationSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { params } = (req as any).validated;
  const notification = await prisma.notification.update({
    where: { id: params.id },
    data: { status: "APPROVED", approvedById: auth.userId, approvedAt: new Date() }
  });
  const audience = extractNotificationAudience(notification.body);
  const queueResult = audience === "ADMINS" ? { queued: false } : await enqueueNotification(notification.id);
  res.json({
    ...notification,
    queue: queueResult
  });
});

router.post("/:id/reject", requireAuth, requireRole(["ADMIN"]), validate(approveNotificationSchema), async (req, res) => {
  const auth = (req as any).auth;
  const { params } = (req as any).validated;
  const notification = await prisma.notification.update({
    where: { id: params.id },
    data: { status: "REJECTED", approvedById: auth.userId, approvedAt: new Date() }
  });
  res.json(notification);
});

router.patch("/:id", requireAuth, requireRole(["ADMIN"]), validate(updateNotificationSchema), async (req, res) => {
  const { params, body } = (req as any).validated;
  const current = await prisma.notification.findUnique({ where: { id: params.id }, select: { body: true } });
  if (!current) return res.status(404).json({ message: "Notificacion no encontrada" });
  const currentAudience = extractNotificationAudience(current.body);
  const currentLegalReference = extractNotificationLegalReference(current.body);
  const notification = await prisma.notification.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.body !== undefined
        ? {
          body: currentAudience
              ? composeNotificationBodyWithMeta(body.body, currentAudience, currentLegalReference)
              : body.body
          }
        : {})
    }
  });
  res.json({
    ...notification,
    audience: extractNotificationAudience(notification.body) || "PARENTS",
    legalReference: extractNotificationLegalReference(notification.body),
    body: stripNotificationMeta(notification.body)
  });
});

// Admin lista notificaciones con paginacion
router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || "").trim();

  const where = status ? { status: status as any } : {};
  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, gradeLevel: true, studentGroup: true } },
        targetUser: { select: { id: true, fullName: true, role: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notification.count({ where })
  ]);
  res.json({
    data: data.map((n) => ({
      ...n,
      audience: extractNotificationAudience(n.body) || "PARENTS",
      legalReference: extractNotificationLegalReference(n.body),
      body: stripNotificationMeta(n.body)
    })),
    total,
    page,
    pageSize
  });
});

export default router;
