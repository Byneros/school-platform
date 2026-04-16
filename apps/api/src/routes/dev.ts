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

export default router;
