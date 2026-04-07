import type { NextFunction, Request, Response } from "express";
import { createRedisClient } from "../utils/redisClient.js";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyFn?: (req: Request) => string;
  skip?: (req: Request) => boolean;
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
    const key = `${options.keyPrefix}:${keyPart}`;

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

        if (count > options.max) {
          res.setHeader("Retry-After", String(retryAfterSec));
          return res.status(429).json({
            error: "Too many requests",
            message: `Demasiadas solicitudes. Intenta de nuevo en ${retryAfterSec} segundos.`
          });
        }

        return next();
      } catch (error) {
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

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        error: "Too many requests",
        message: `Demasiadas solicitudes. Intenta de nuevo en ${retryAfterSec} segundos.`
      });
    }

    next();
  };
}
