import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireDeveloper } from "../middlewares/requireDeveloper.js";
import { getCacheMetrics } from "../middlewares/responseCache.js";
import { getRateLimitMetrics } from "../middlewares/rateLimit.js";

const router = Router();

router.use(requireAuth, requireDeveloper);

router.get("/info", async (_req, res) => {
  const uptimeSeconds = Math.round(process.uptime());

  const [dbOk, usersByRole, activeSessions, feedbackOpen] = await Promise.all([
    prisma
      .$queryRawUnsafe("SELECT 1")
      .then(() => true)
      .catch(() => false),
    prisma.user.groupBy({
      by: ["role"],
      _count: { role: true }
    }),
    prisma.refreshSession.count({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    }),
    prisma.feedback.count({
      where: { status: "OPEN" }
    })
  ]);

  return res.json({
    service: "school-api",
    env: process.env.NODE_ENV || "unknown",
    node: process.version,
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    checks: {
      db: dbOk ? "up" : "down"
    },
    metrics: {
      usersByRole: Object.fromEntries(usersByRole.map((item) => [item.role, item._count.role])),
      activeSessions,
      feedbackOpen
    },
    cache: getCacheMetrics(),
    rateLimit: getRateLimitMetrics()
  });
});

router.get("/users", async (req, res) => {
  const role = String(req.query.role || "").trim().toUpperCase();
  const search = String(req.query.search || "").trim();

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role: role as any } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true,
      createdAt: true
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    take: 200
  });

  res.json({ data: users });
});

router.get("/sessions", async (_req, res) => {
  const sessions = await prisma.refreshSession.findMany({
    where: {
      expiresAt: { gt: new Date() }
    },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      deviceLabel: true,
      ip: true,
      geoCity: true,
      geoRegion: true,
      geoCountry: true,
      user: {
        select: {
          fullName: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.json({ data: sessions });
});

router.post("/database/purge", async (req, res) => {
  const confirmation = String(req.body?.confirmation || "").trim();
  if (confirmation !== "BORRAR BASE DE DATOS") {
    return res.status(400).json({
      message: "Confirmacion invalida. Escribe exactamente: BORRAR BASE DE DATOS"
    });
  }

  const auth = (req as any).auth;
  const developerUsers = await prisma.user.findMany({
    where: { role: "DEVELOPER" },
    select: { id: true, email: true }
  });
  if (!developerUsers.length) {
    return res.status(409).json({
      message: "No hay usuarios desarrolladores para preservar. Operacion cancelada."
    });
  }

  const developerUserIds = new Set(developerUsers.map((user) => user.id));
  if (!developerUserIds.has(auth.userId)) {
    return res.status(403).json({
      message: "El usuario autenticado no esta en la lista de desarrolladores preservados."
    });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const counts: Record<string, number> = {};
    const capture = async (key: string, promise: Promise<{ count: number }>) => {
      const result = await promise;
      counts[key] = result.count;
    };

    await capture("notificationRecipients", tx.notificationRecipient.deleteMany({}));
    await capture("payments", tx.payment.deleteMany({}));
    await capture("invoices", tx.invoice.deleteMany({}));
    await capture("taskScores", tx.taskScore.deleteMany({}));
    await capture("tasks", tx.task.deleteMany({}));
    await capture("grades", tx.grade.deleteMany({}));
    await capture("attendance", tx.attendance.deleteMany({}));
    await capture("academicClosures", tx.academicClosureResult.deleteMany({}));
    await capture("certificateRequests", tx.certificateRequest.deleteMany({}));
    await capture("certificateIssues", tx.certificateIssue.deleteMany({}));
    await capture("studentObservations", tx.studentObservation.deleteMany({}));
    await capture("notifications", tx.notification.deleteMany({}));
    await capture("guardians", tx.guardian.deleteMany({}));
    await capture("enrollments", tx.enrollment.deleteMany({}));
    await capture("admissions", tx.admission.deleteMany({}));
    await capture("classes", tx.class.deleteMany({}));
    await capture("teachers", tx.teacher.deleteMany({}));
    await capture("parents", tx.parent.deleteMany({}));
    await capture("students", tx.student.deleteMany({}));
    await capture("feedback", tx.feedback.deleteMany({}));
    await capture(
      "refreshSessions",
      tx.refreshSession.deleteMany({
        where: { userId: { notIn: Array.from(developerUserIds) } }
      })
    );
    await capture(
      "users",
      tx.user.deleteMany({
        where: { role: { not: "DEVELOPER" } }
      })
    );

    return counts;
  });

  const remainingDevelopers = await prisma.user.findMany({
    where: { role: "DEVELOPER" },
    select: { id: true, email: true, fullName: true, isActive: true },
    orderBy: { createdAt: "asc" }
  });

  return res.json({
    ok: true,
    message: "Base de datos borrada. Se conservaron los usuarios desarrolladores.",
    deleted,
    remainingDevelopers
  });
});

export default router;
