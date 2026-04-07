import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { createRedisClient } from "../utils/redisClient.js";

export type CacheMiddlewareOptions = {
  ttlSeconds: number;
  keyPrefix?: string;
  shouldCache?: (req: Request) => boolean;
  excludePaths?: string[];
  logEvery?: number;
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
  const excludePaths = (options.excludePaths || []).filter(Boolean);
  const logEvery = Math.max(0, Number(options.logEvery || 0));
  let total = 0;
  let hits = 0;
  let misses = 0;
  let bypasses = 0;
  let sets = 0;
  let readErrors = 0;
  let writeErrors = 0;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!shouldCache(req)) return next();
    total += 1;
    if (excludePaths.some((path) => req.originalUrl.startsWith(path))) {
      bypasses += 1;
      return next();
    }

    const client = createRedisClient();
    if (!client) {
      bypasses += 1;
      return next();
    }

    const auth = String(req.headers.authorization || "");
    const keyRaw = `${req.originalUrl}|${auth}`;
    const key = `${keyPrefix}:${createHash("sha1").update(keyRaw).digest("hex")}`;

    try {
      if (client.status !== "ready") {
        await client.connect();
      }
      const cached = await client.get(key);
      if (cached) {
        hits += 1;
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        console.log(`Cache HIT ${keyPrefix} ${req.originalUrl}`);
        return res.send(cached);
      }
      misses += 1;
      console.log(`Cache MISS ${keyPrefix} ${req.originalUrl}`);
    } catch (error) {
      bypasses += 1;
      readErrors += 1;
      console.warn("Cache read failed:", (error as any)?.message || error);
      res.setHeader("X-Cache", "BYPASS");
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const payload = JSON.stringify(body);
          client
            .set(key, payload, "EX", ttlSeconds)
            .then(() => {
              sets += 1;
              console.log(`Cache SET ${keyPrefix} ${req.originalUrl} ttl=${ttlSeconds}`);
            })
            .catch((error) => {
              writeErrors += 1;
              console.warn("Cache write failed:", (error as any)?.message || error);
              res.setHeader("X-Cache", "BYPASS");
            });
          res.setHeader("X-Cache", "MISS");
        }
      } catch {
        // ignore cache write errors
      }
      return originalJson(body);
    };

    if (logEvery > 0 && total % logEvery === 0) {
      console.log(
        `Cache summary total=${total} hit=${hits} miss=${misses} bypass=${bypasses} set=${sets} readErr=${readErrors} writeErr=${writeErrors}`
      );
    }

    next();
  };
}
