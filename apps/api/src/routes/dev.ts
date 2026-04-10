import { Router } from "express";
import prisma from "../utils/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { getCacheMetrics } from "../middlewares/responseCache.js";
import { getRateLimitMetrics } from "../middlewares/rateLimit.js";

const router = Router();

router.use(requireAuth, requireRole(["DEVELOPER"]));

router.get("/info", async (_req, res) => {
  const uptimeSeconds = Math.round(process.uptime());
  const dbOk = await prisma
    .$queryRawUnsafe("SELECT 1")
    .then(() => true)
    .catch(() => false);

  return res.json({
    service: "school-api",
    env: process.env.NODE_ENV || "unknown",
    node: process.version,
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    checks: {
      db: dbOk ? "up" : "down"
    },
    cache: getCacheMetrics(),
    rateLimit: getRateLimitMetrics()
  });
});

export default router;
