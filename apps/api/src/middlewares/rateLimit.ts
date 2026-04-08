import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { createRedisClient } from "../utils/redisClient.js";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyFn?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  roleKey?: boolean;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const redisClient = createRedisClient();

const RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`;

type MetricBucket = { total: number; blocked: number };
const metrics = {
  total: 0,
  blocked: 0,
  redisErrors: 0,
  byRole: new Map<string, MetricBucket>(),
  byPrefix: new Map<string, MetricBucket>()
};

function bumpMetric(map: Map<string, MetricBucket>, key: string, blocked: boolean) {
  const bucket = map.get(key) || { total: 0, blocked: 0 };
  bucket.total += 1;
  if (blocked) bucket.blocked += 1;
  map.set(key, bucket);
}

function getRoleFromRequest(req: Request) {
  const auth = (req as any).auth;
  if (auth?.role) return String(auth.role);
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return "ANON";
  const token = header.slice(7).trim();
  if (!token) return "ANON";
  const secret = process.env.JWT_SECRET || "";
  if (!secret) return "ANON";
  try {
    const payload = jwt.verify(token, secret) as any;
    return String(payload?.role || "ANON");
  } catch {
    return "ANON";
  }
}

export function getRateLimitMetrics() {
  const mapToObj = (map: Map<string, MetricBucket>) =>
    Object.fromEntries(Array.from(map.entries()));
  return {
    total: metrics.total,
    blocked: metrics.blocked,
    redisErrors: metrics.redisErrors,
    byRole: mapToObj(metrics.byRole),
    byPrefix: mapToObj(metrics.byPrefix)
  };
}

function cleanupExpired(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function createRateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (options.skip?.(req)) return next();

    const now = Date.now();
    const keyPart = options.keyFn ? options.keyFn(req) : req.ip || "unknown";
    const role = options.roleKey ? getRoleFromRequest(req) : "";
    const key = `${options.keyPrefix}:${role ? `${role}:` : ""}${keyPart}`;

    if (redisClient) {
      try {
        if (redisClient.status !== "ready") {
          await redisClient.connect();
        }
        const result = (await redisClient.eval(
          RATE_LIMIT_LUA,
          1,
          key,
          String(options.windowMs)
        )) as [number, number];
        const count = Number(result?.[0] ?? 0);
        const ttlMs = Number(result?.[1] ?? options.windowMs);
        const remaining = Math.max(0, options.max - count);
        const resetAt = now + Math.max(0, ttlMs);
        const retryAfterSec = Math.max(1, Math.ceil(Math.max(0, ttlMs) / 1000));

        res.setHeader("X-RateLimit-Limit", String(options.max));
        res.setHeader("X-RateLimit-Remaining", String(remaining));
        res.setHeader("X-RateLimit-Reset", String(Math.floor(resetAt / 1000)));

        const blocked = count > options.max;
        metrics.total += 1;
        if (blocked) metrics.blocked += 1;
        bumpMetric(metrics.byPrefix, options.keyPrefix, blocked);
        if (options.roleKey) bumpMetric(metrics.byRole, role || "ANON", blocked);

        if (blocked) {
          res.setHeader("Retry-After", String(retryAfterSec));
          return res.status(429).json({
            error: "Too many requests",
            message: `Demasiadas solicitudes. Intenta de nuevo en ${retryAfterSec} segundos.`
          });
        }

        return next();
      } catch (error) {
        metrics.redisErrors += 1;
        console.warn("Rate limit redis failed, falling back to memory:", (error as any)?.message || error);
      }
    }

    cleanupExpired(now);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + options.windowMs
      };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));

    const blocked = bucket.count > options.max;
    metrics.total += 1;
    if (blocked) metrics.blocked += 1;
    bumpMetric(metrics.byPrefix, options.keyPrefix, blocked);
    if (options.roleKey) bumpMetric(metrics.byRole, role || "ANON", blocked);

    if (blocked) {
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        error: "Too many requests",
        message: `Demasiadas solicitudes. Intenta de nuevo en ${retryAfterSec} segundos.`
      });
    }

    next();
  };
}
