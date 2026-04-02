import { Worker } from "bullmq";
import prisma from "../utils/prisma.js";
import { sendEmail } from "../utils/mailer.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";
import { extractNotificationAudience, stripNotificationMeta } from "../utils/notificationMeta.js";
import { getRedisConnectionOptions } from "../utils/redisClient.js";

export function startNotificationWorker() {
  const connection = getRedisConnectionOptions();
  if (!connection) {
    console.warn("Redis no configurado. Worker de notificaciones deshabilitado.");
    return null;
  }

  const worker = new Worker(
    "notifications",
    async (job) => {
      const { notificationId } = job.data as { notificationId: string };

      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        include: { createdBy: { include: { teacher: true } } }
      });
      if (!notification) return;
      const audience = extractNotificationAudience(notification.body);
      const plainBody = stripNotificationMeta(notification.body);
      const sendToParents = notification.createdBy.role === "TEACHER" || audience === "PARENTS" || audience === "BOTH" || !audience;
      const sendToTeachers = audience === "TEACHERS" || audience === "BOTH";

      let parents: { id: string }[] = [];
      if (sendToParents && notification.studentId) {
        const guardians = await prisma.guardian.findMany({
          where: { studentId: notification.studentId },
          select: { parentId: true }
        });
        parents = guardians.map((g) => ({ id: g.parentId }));
      } else if (sendToParents && notification.createdBy.role === "TEACHER" && notification.createdBy.teacher) {
        const enrollments = await prisma.enrollment.findMany({
          where: { class: { teacherId: notification.createdBy.teacher.id } },
          select: { studentId: true }
        });
        const studentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));
        if (studentIds.length > 0) {
          const guardians = await prisma.guardian.findMany({
            where: { studentId: { in: studentIds } },
            select: { parentId: true }
          });
          parents = guardians.map((g) => ({ id: g.parentId }));
        }
      } else if (sendToParents) {
        parents = await prisma.parent.findMany({ select: { id: true } });
      }

      if (parents.length > 0) {
        const recipients = parents.map((p) => ({
          notificationId,
          parentId: p.id
        }));

        await prisma.notificationRecipient.createMany({
          data: recipients,
          skipDuplicates: true
        });
      }

      const teacherEmails = sendToTeachers
        ? notification.targetUserId
          ? await prisma.user.findMany({
              where: { id: notification.targetUserId, role: "TEACHER", isActive: true },
              select: { email: true }
            })
          : await prisma.user.findMany({
              where: { role: "TEACHER", isActive: true },
              select: { email: true }
            })
        : [];

      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT", sentAt: new Date() }
      });

      const parentUsers = await prisma.parent.findMany({
        where: { id: { in: parents.map((p) => p.id) } },
        include: { user: true }
      });
      const toList = parentUsers.map((p) => p.user.email).filter(Boolean);
      const teacherToList = teacherEmails.map((t) => t.email).filter(Boolean);
      const allEmails = Array.from(new Set([...toList, ...teacherToList]));
      if (allEmails.length > 0) {
        const branding = await getBrandingSettings().catch(() => null);
        await Promise.all(
          allEmails.map((email) =>
            sendEmail({
              to: email,
              subject: branding ? `${notification.title} - ${branding.schoolName}` : notification.title,
              text: plainBody,
              html: `
                <div style="font-family: Arial, sans-serif; color: #0f172a;">
                  <div style="display:flex; align-items:center; gap:12px; margin-bottom: 8px;">
                    ${branding?.logoDataUrl ? `<img src="${branding.logoDataUrl}" alt="Logo" style="height:40px; width:40px; object-fit:contain;" />` : ""}
                    <div style="font-size:16px; font-weight:700; color:${branding?.primaryColor || "#1e3a8a"};">${branding?.schoolName || "Institucion Educativa"}</div>
                  </div>
                  <h2 style="margin: 0 0 8px; color:${branding?.primaryColor || "#1e3a8a"};">${notification.title}</h2>
                  <p style="white-space: pre-line;">${plainBody}</p>
                  <div style="margin-top: 12px; font-size: 12px; color: #64748b;">
                    ${branding?.footerText || "Notificacion enviada por la institucion educativa."}
                  </div>
                </div>
              `
            }).catch(() => undefined)
          )
        );
      }
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error("Notification job failed", job?.id, err);
  });
  worker.on("error", (err) => {
    console.error("Notification worker error:", err?.message || err);
  });

  return worker;
}
