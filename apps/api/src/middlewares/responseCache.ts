import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { createRedisClient } from "../utils/redisClient.js";

export type CacheMiddlewareOptions = {
  ttlSeconds: number;
  keyPrefix?: string;
  shouldCache?: (req: Request) => boolean;
};

function defaultShouldCache(req: Request) {
  if (req.method !== "GET") return false;
  if (req.query && ("noCache" in req.query || "nocache" in req.query)) return false;
  const cacheControl = String(req.headers["cache-control"] || "").toLowerCase();
  if (cacheControl.includes("no-cache") || cacheControl.includes("no-store")) return false;
  if (req.originalUrl.includes("/export")) return false;
  return true;
}

export function cacheResponse(options: CacheMiddlewareOptions) {
  const ttlSeconds = Math.max(5, Number(options.ttlSeconds || 0));
  const keyPrefix = options.keyPrefix || "cache";
  const shouldCache = options.shouldCache || defaultShouldCache;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!shouldCache(req)) return next();

    const client = createRedisClient();
    if (!client) return next();

    const auth = String(req.headers.authorization || "");
    const keyRaw = `${req.originalUrl}|${auth}`;
    const key = `${keyPrefix}:${createHash("sha1").update(keyRaw).digest("hex")}`;

    try {
      if (client.status !== "ready") {
        await client.connect();
      }
      const cached = await client.get(key);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.send(cached);
      }
    } catch (error) {
      console.warn("Cache read failed:", (error as any)?.message || error);
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const payload = JSON.stringify(body);
          client
            .set(key, payload, "EX", ttlSeconds)
            .catch(() => undefined);
          res.setHeader("X-Cache", "MISS");
        }
      } catch {
        // ignore cache write errors
      }
      return originalJson(body);
    };

    next();
  };
}
