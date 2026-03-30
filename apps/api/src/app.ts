import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { ErrorRequestHandler } from "express";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import routes from "./routes/index.js";
import prisma from "./utils/prisma.js";
import { createRateLimit } from "./middlewares/rateLimit.js";

const app = express();
const redisUrl = process.env.REDIS_URL || "";
const corsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const rateLimitWindowMs = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000));
const rateLimitMax = Math.max(10, Number(process.env.RATE_LIMIT_MAX || 300));
const loginRateLimitMax = Math.max(3, Number(process.env.LOGIN_RATE_LIMIT_MAX || 10));
const writeRateLimitWindowMs = Math.max(1000, Number(process.env.WRITE_RATE_LIMIT_WINDOW_MS || 60 * 1000));
const writeRateLimitMax = Math.max(10, Number(process.env.WRITE_RATE_LIMIT_MAX || 120));
const notificationsRateLimitWindowMs = Math.max(
  1000,
  Number(process.env.NOTIFICATIONS_RATE_LIMIT_WINDOW_MS || 60 * 1000)
);
const notificationsRateLimitMax = Math.max(10, Number(process.env.NOTIFICATIONS_RATE_LIMIT_MAX || 120));
const reportsRateLimitWindowMs = Math.max(
  1000,
  Number(process.env.REPORTS_RATE_LIMIT_WINDOW_MS || 60 * 1000)
);
const reportsRateLimitMax = Math.max(5, Number(process.env.REPORTS_RATE_LIMIT_MAX || 30));
const twoFactorRateLimitWindowMs = Math.max(
  60_000,
  Number(process.env.TWO_FACTOR_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000)
);
const twoFactorRateLimitMax = Math.max(3, Number(process.env.TWO_FACTOR_RATE_LIMIT_MAX || 10));
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "1mb";
const trustProxyEnv = String(process.env.TRUST_PROXY || "").toLowerCase();
const trustProxy =
  trustProxyEnv === "true" || trustProxyEnv === "1" || trustProxyEnv === "yes";

function logInfo(message: string, details: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      msg: message,
      ...details
    })
  );
}

function logError(message: string, details: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      msg: message,
      ...details
    })
  );
}

app.disable("x-powered-by");
if (trustProxy) {
  app.set("trust proxy", 1);
}
app.use(helmet());
const corsOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  if (!origin) return callback(null, true);
  if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
    return callback(null, true);
  }
  const error: any = new Error("Origen no permitido por CORS");
  error.status = 403;
  return callback(error);
};
app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: jsonBodyLimit }));
app.use(
  createRateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    keyPrefix: "global",
    skip: (req) => req.path === "/health" || req.path === "/ready"
  })
);
app.use(
  "/api/auth/login",
  createRateLimit({
    windowMs: rateLimitWindowMs,
    max: loginRateLimitMax,
    keyPrefix: "login",
    keyFn: (req) => {
      const ip = req.ip || "unknown";
      const email = String(req.body?.email || "").trim().toLowerCase();
      return `${ip}:${email}`;
    }
  })
);
app.use(
  "/api/auth/2fa",
  createRateLimit({
    windowMs: twoFactorRateLimitWindowMs,
    max: twoFactorRateLimitMax,
    keyPrefix: "2fa"
  })
);
app.use(
  "/api/notifications",
  createRateLimit({
    windowMs: notificationsRateLimitWindowMs,
    max: notificationsRateLimitMax,
    keyPrefix: "notifications"
  })
);
app.use(
  "/api/reports",
  createRateLimit({
    windowMs: reportsRateLimitWindowMs,
    max: reportsRateLimitMax,
    keyPrefix: "reports"
  })
);
const writeRateLimiter = createRateLimit({
  windowMs: writeRateLimitWindowMs,
  max: writeRateLimitMax,
  keyPrefix: "write",
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method)
});
[
  "/api/users",
  "/api/notifications",
  "/api/reports",
  "/api/admissions",
  "/api/enrollments",
  "/api/invoices",
  "/api/payments",
  "/api/student-observations",
  "/api/teacher",
  "/api/classes",
  "/api/grades",
  "/api/attendance"
].forEach((path) => app.use(path, writeRateLimiter));
app.use((req, res, next) => {
  const requestIdHeader = req.headers["x-request-id"];
  const requestId = typeof requestIdHeader === "string" && requestIdHeader.trim() ? requestIdHeader : randomUUID();
  const start = Date.now();
  (req as any).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const auth = (req as any).auth;
    logInfo("http_request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userId: auth?.userId || null,
      role: auth?.role || null
    });
  });

  next();
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    requestId: (req as any).requestId || null
  });
});
app.get("/ready", async (req, res) => {
  const requestId = (req as any).requestId || null;
  let dbOk = false;
  let redisOk = redisUrl ? false : true;

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }

  if (redisUrl) {
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 1000, lazyConnect: true });
    try {
      await redis.connect();
      const pong = await redis.ping();
      redisOk = pong === "PONG";
    } catch {
      redisOk = false;
    } finally {
      redis.disconnect();
    }
  }

  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({
    ok,
    requestId,
    checks: {
      db: dbOk ? "up" : "down",
      redis: redisOk ? "up" : "down"
    }
  });
});
app.use("/api", routes);

app.use("/api", (req, res) => {
  res.status(404).json({
    message: "Endpoint no encontrado",
    requestId: (req as any).requestId || null
  });
});

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = (req as any).requestId || null;
  const status = Number((error as any)?.status || 500);
  const isJsonParseError = (error as any)?.type === "entity.parse.failed";
  const message = isJsonParseError
    ? "JSON invalido en la solicitud"
    : String((error as any)?.message || "Error interno del servidor");

  if (status >= 500) {
    logError("http_unhandled_error", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: status,
      errorName: (error as any)?.name || "Error",
      errorMessage: (error as any)?.message || "Unknown error"
    });
  }

  res.status(status).json({ message, requestId });
};

app.use(errorHandler);

export default app;
