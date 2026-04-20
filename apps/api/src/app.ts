import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import type { ErrorRequestHandler } from "express";
import { randomUUID } from "crypto";
import { createRedisClient } from "./utils/redisClient.js";
import routes from "./routes/index.js";
import prisma from "./utils/prisma.js";
import { requireAuth, requireRole } from "./middlewares/auth.js";
import { createRateLimit, getRateLimitMetrics } from "./middlewares/rateLimit.js";
import { cacheResponse, getCacheMetrics } from "./middlewares/responseCache.js";
import { invalidateCache } from "./middlewares/cacheInvalidation.js";
import jwt from "jsonwebtoken";
import { enqueueCacheWarm } from "./services/cacheWarmQueue.js";

const app = express();

// Redis client
const redis = createRedisClient();
if (!redis) {
  console.log("Redis not configured (cache/queue disabled).");
}

// ================= CONFIG =================

const corsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const rateLimitWindowMs = Math.max(
  1000,
  Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000)
);

const rateLimitMax = Math.max(
  10,
  Number(process.env.RATE_LIMIT_MAX || 300)
);

const loginRateLimitMax = Math.max(
  3,
  Number(process.env.LOGIN_RATE_LIMIT_MAX || 10)
);

const writeRateLimitWindowMs = Math.max(
  1000,
  Number(process.env.WRITE_RATE_LIMIT_WINDOW_MS || 60 * 1000)
);

const writeRateLimitMax = Math.max(
  10,
  Number(process.env.WRITE_RATE_LIMIT_MAX || 120)
);

const notificationsRateLimitWindowMs = Math.max(
  1000,
  Number(process.env.NOTIFICATIONS_RATE_LIMIT_WINDOW_MS || 60 * 1000)
);

const notificationsRateLimitMax = Math.max(
  10,
  Number(process.env.NOTIFICATIONS_RATE_LIMIT_MAX || 120)
);

const reportsRateLimitWindowMs = Math.max(
  1000,
  Number(process.env.REPORTS_RATE_LIMIT_WINDOW_MS || 60 * 1000)
);

const reportsRateLimitMax = Math.max(
  5,
  Number(process.env.REPORTS_RATE_LIMIT_MAX || 30)
);

const twoFactorRateLimitWindowMs = Math.max(
  60_000,
  Number(process.env.TWO_FACTOR_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000)
);

const twoFactorRateLimitMax = Math.max(
  3,
  Number(process.env.TWO_FACTOR_RATE_LIMIT_MAX || 10)
);

const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "1mb";
const cacheTtlSeconds = Math.max(5, Number(process.env.REDIS_CACHE_TTL_SECONDS || 300));
const cacheTtlCritical = Math.max(60, Number(process.env.REDIS_CACHE_TTL_CRITICAL || 600));
const cacheTtlSuggestions = Math.max(30, Number(process.env.REDIS_CACHE_TTL_SUGGESTIONS || 120));
const cacheTtlClasses = Math.max(300, Number(process.env.REDIS_CACHE_TTL_CLASSES || 3600));
const cacheTtlParent = Math.max(60, Number(process.env.REDIS_CACHE_TTL_PARENT || 300));
const cacheExcludePaths = String(process.env.REDIS_CACHE_EXCLUDE_PATHS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean)
  .map((v) => (v.startsWith("/") ? v : `/${v}`));
const cacheLogEvery = Math.max(0, Number(process.env.REDIS_CACHE_LOG_EVERY || 25));
const rateLimitMetricsToken = String(process.env.RATE_LIMIT_METRICS_TOKEN || "").trim();
const cacheMetricsToken = String(process.env.CACHE_METRICS_TOKEN || "").trim();
const cacheWarmEnabled = String(process.env.CACHE_WARM_ENABLED || "").toLowerCase() === "true";

const trustProxyEnv = String(process.env.TRUST_PROXY || "").toLowerCase();

const trustProxy =
  trustProxyEnv === "true" ||
  trustProxyEnv === "1" ||
  trustProxyEnv === "yes";

type TokenScope = { role: string; userId: string };

function getTokenScope(req: express.Request): TokenScope {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return { role: "ANON", userId: "" };
  const token = header.slice(7).trim();
  if (!token) return { role: "ANON", userId: "" };
  const secret = process.env.JWT_SECRET || "";
  if (!secret) return { role: "ANON", userId: "" };
  try {
    const payload = jwt.verify(token, secret) as any;
    return {
      role: String(payload?.role || "ANON"),
      userId: String(payload?.userId || "")
    };
  } catch {
    return { role: "ANON", userId: "" };
  }
}

function cacheScopeForPath(req: express.Request) {
  const scope = getTokenScope(req);
  const path = req.path || "";
  if (path.startsWith("/api/parent") || path.startsWith("/api/teacher")) {
    return scope.userId ? `${scope.role}:${scope.userId}` : scope.role;
  }
  return scope.role;
}

function cacheTagsForPath(req: express.Request) {
  const path = req.path || "";
  const tags = new Set<string>();
  if (path.startsWith("/auth") || path.startsWith("/ops")) {
    return [];
  }
  const segments = path.split("/").filter(Boolean);
  const base = segments[0] || "";
  const idCandidate = segments[1] || "";
  const statusRaw = String(req.query?.status || "").toUpperCase().trim();
  const typeRaw = String(req.query?.type || "").toLowerCase().trim();
  const isIdCandidate =
    idCandidate &&
    idCandidate.length >= 8 &&
    !["approved", "pending", "export", "history", "simple", "access"].includes(idCandidate);

  const scope = getTokenScope(req);
  const roleTag = scope.role ? `role:${scope.role}` : "role:ANON";
  tags.add(roleTag);

  if (base) tags.add(base);

  if (path.startsWith("/api/notifications")) tags.add("notifications");
  if (path.startsWith("/api/reports/certificate/requests")) tags.add("cert-requests");
  if (path.startsWith("/api/reports/import-template/history")) tags.add("report-history");
  if (path.startsWith("/api/admissions")) tags.add("admissions");
  if (path.startsWith("/api/enrollments")) tags.add("enrollments");
  if (path.startsWith("/api/users")) tags.add("users");
  if (path.startsWith("/api/invoices")) tags.add("invoices");
  if (path.startsWith("/api/parent")) tags.add("parent");
  if (path.startsWith("/api/teacher")) tags.add("teacher");
  if (path.startsWith("/api/classes")) tags.add("classes");
  if (path.startsWith("/api/suggestions")) tags.add("suggestions");
  if (path.startsWith("/api/students")) tags.add("students");
  if (path.startsWith("/api/branding")) tags.add("branding");

  if (isIdCandidate && base) {
    tags.add(`${base}:${idCandidate}`);
  }

  if (statusRaw && (base === "admissions" || base === "notifications" || base === "invoices")) {
    tags.add(`${base}:status:${statusRaw}`);
  }
  if (path.startsWith("/api/reports/certificate/requests") && statusRaw) {
    tags.add(`cert-requests:status:${statusRaw}`);
  }
  if (typeRaw && base === "suggestions") {
    tags.add(`suggestions:${typeRaw}`);
  }
  if (base === "parent" && scope.userId) {
    tags.add(`parent:${scope.userId}`);
  }
  if (base === "teacher" && scope.userId) {
    tags.add(`teacher:${scope.userId}`);
  }
  return Array.from(tags);
}

function cacheTtlForPath(req: express.Request) {
  const path = req.path || "";
  if (path.startsWith("/api/suggestions")) return cacheTtlSuggestions;
  if (path.startsWith("/api/classes/simple")) return cacheTtlClasses;
  if (path.startsWith("/api/parent")) return cacheTtlParent;
  if (
    path.startsWith("/api/notifications") ||
    path.startsWith("/api/reports/certificate/requests") ||
    path.startsWith("/api/admissions") ||
    path.startsWith("/api/enrollments") ||
    path.startsWith("/api/users") ||
    path.startsWith("/api/invoices")
  ) {
    return cacheTtlCritical;
  }
  return cacheTtlSeconds;
}

function cacheWarmUrlsForTags(tags: string[]) {
  const urls = new Set<string>();
  const has = (tag: string) => tags.includes(tag);
  if (has("notifications")) {
    urls.add("/api/notifications?page=1&pageSize=10&status=PENDING");
  }
  if (has("cert-requests")) {
    urls.add("/api/reports/certificate/requests?page=1&pageSize=10&status=PENDING");
  }
  if (has("admissions")) {
    urls.add("/api/admissions?page=1&pageSize=10&status=PENDING");
  }
  if (has("enrollments")) {
    urls.add("/api/enrollments?page=1&pageSize=10");
  }
  if (has("users")) {
    urls.add("/api/users?page=1&pageSize=10");
  }
  if (has("invoices")) {
    urls.add("/api/invoices?page=1&pageSize=10&status=PENDING");
  }
  if (has("classes")) {
    urls.add("/api/classes/simple");
  }
  if (has("students")) {
    urls.add("/api/students?page=1&pageSize=10");
  }
  if (has("report-history")) {
    urls.add("/api/reports/import-template/history");
  }
  if (has("suggestions")) {
    urls.add("/api/suggestions?type=users&q=&limit=8");
  }
  return Array.from(urls);
}

// ================= LOGS =================

function logInfo(message: string, details: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      msg: message,
      ...details,
    })
  );
}

function logError(message: string, details: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      msg: message,
      ...details,
    })
  );
}

// ================= MIDDLEWARE =================

app.disable("x-powered-by");

if (trustProxy) {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cookieParser());

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
    credentials: true,
  })
);

app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: jsonBodyLimit }));

// ================= RATE LIMIT =================

app.use(
  createRateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    keyPrefix: "global",
    roleKey: true,
    skip: (req) => req.path === "/health" || req.path === "/ready",
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
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      return `${ip}:${email}`;
    },
  })
);

app.use(
  "/api/auth/2fa",
  createRateLimit({
    windowMs: twoFactorRateLimitWindowMs,
    max: twoFactorRateLimitMax,
    keyPrefix: "2fa",
  })
);

app.use(
  "/api/notifications",
  createRateLimit({
    windowMs: notificationsRateLimitWindowMs,
    max: notificationsRateLimitMax,
    keyPrefix: "notifications",
    roleKey: true,
  })
);

app.use(
  "/api/reports",
  createRateLimit({
    windowMs: reportsRateLimitWindowMs,
    max: reportsRateLimitMax,
    keyPrefix: "reports",
    roleKey: true,
  })
);

const writeRateLimiter = createRateLimit({
  windowMs: writeRateLimitWindowMs,
  max: writeRateLimitMax,
  keyPrefix: "write",
  roleKey: true,
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
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
  "/api/attendance",
].forEach((path) => app.use(path, writeRateLimiter));

// ================= REQUEST LOGGER =================

app.use((req, res, next) => {
  const requestIdHeader = req.headers["x-request-id"];

  const requestId =
    typeof requestIdHeader === "string" && requestIdHeader.trim()
      ? requestIdHeader
      : randomUUID();

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
      role: auth?.role || null,
    });
  });

  next();
});

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("API funcionando correctamente 🚀");
});


app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/ready", async (req, res) => {
  const requestId = (req as any).requestId || null;

  let dbOk = false;
  let redisOk = redis ? false : true;

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }

  if (redis) {
    try {
      const pong = await redis.ping();
      redisOk = pong === "PONG";
    } catch {
      redisOk = false;
    }
  }

  const ok = dbOk && redisOk;

  res.status(ok ? 200 : 503).json({
    ok,
    requestId,
    checks: {
      db: dbOk ? "up" : "down",
      redis: redisOk ? "up" : "down",
    },
  });
});

if (rateLimitMetricsToken) {
  app.get("/ops/ratelimit", (req, res) => {
    const token = String(req.headers["x-metrics-token"] || "");
    if (!token || token !== rateLimitMetricsToken) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(getRateLimitMetrics());
  });
}

if (cacheMetricsToken) {
  app.get("/ops/cache", (req, res) => {
    const token = String(req.headers["x-metrics-token"] || "");
    if (!token || token !== cacheMetricsToken) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(getCacheMetrics());
  });
}

app.get("/api/ops/cache", requireAuth, requireRole(["DEVELOPER"]), (_req, res) => {
  return res.json(getCacheMetrics());
});

// ================= ROUTES =================

app.use(
  "/api",
  cacheResponse({
    ttlSeconds: cacheTtlForPath,
    excludePaths: [
      "/api/auth",
      "/api/ops",
      "/api/reports/export",
      "/api/notifications/export",
      "/api/certificates/export",
      ...cacheExcludePaths
    ],
    logEvery: cacheLogEvery,
    keyFn: cacheScopeForPath,
    tagsFn: cacheTagsForPath
  })
);

app.use(
  "/api",
  invalidateCache({
    tagsFn: cacheTagsForPath,
    onInvalidated: (tags) => {
      if (!cacheWarmEnabled) return;
      const urls = cacheWarmUrlsForTags(tags);
      if (urls.length > 0) {
        enqueueCacheWarm(urls).catch(() => undefined);
      }
    }
  })
);

app.use("/api", routes);

app.use("/api", (req, res) => {
  res.status(404).json({
    message: "Endpoint no encontrado",
    requestId: (req as any).requestId || null,
  });
});

// ================= ERROR HANDLER =================

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = (req as any).requestId || null;

  const status = Number((error as any)?.status || 500);

  const isJsonParseError =
    (error as any)?.type === "entity.parse.failed";

  const message = isJsonParseError
    ? "JSON invalido en la solicitud"
    : String(
        (error as any)?.message || "Error interno del servidor"
      );

  if (status >= 500) {
    logError("http_unhandled_error", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: status,
      errorName: (error as any)?.name || "Error",
      errorMessage: (error as any)?.message || "Unknown error",
    });
  }

  res.status(status).json({ message, requestId });
};

app.use(errorHandler);

export default app;


