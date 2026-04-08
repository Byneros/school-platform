import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { createRedisClient } from "../utils/redisClient.js";

type MetricBucket = {
  total: number;
  hit: number;
  miss: number;
  bypass: number;
  set: number;
  readErr: number;
  writeErr: number;
};

const globalMetrics = {
  startedAt: new Date().toISOString(),
  total: 0,
  hit: 0,
  miss: 0,
  bypass: 0,
  set: 0,
  readErr: 0,
  writeErr: 0,
  byPrefix: new Map<string, MetricBucket>(),
  byTag: new Map<string, MetricBucket>()
};

function bumpBucket(map: Map<string, MetricBucket>, key: string, field: keyof MetricBucket) {
  const bucket =
    map.get(key) || { total: 0, hit: 0, miss: 0, bypass: 0, set: 0, readErr: 0, writeErr: 0 };
  bucket.total += field === "total" ? 1 : 0;
  bucket[field] += 1;
  map.set(key, bucket);
}

function recordMetric(prefix: string, field: keyof MetricBucket, tags: string[]) {
  if (field === "total") globalMetrics.total += 1;
  else (globalMetrics as any)[field] += 1;
  bumpBucket(globalMetrics.byPrefix, prefix, field);
  tags.forEach((tag) => bumpBucket(globalMetrics.byTag, tag, field));
}

export function getCacheMetrics() {
  const mapToObj = (map: Map<string, MetricBucket>) =>
    Object.fromEntries(Array.from(map.entries()));
  const hitRate = globalMetrics.total ? Math.round((globalMetrics.hit / globalMetrics.total) * 100) : 0;
  const missRate = globalMetrics.total ? Math.round((globalMetrics.miss / globalMetrics.total) * 100) : 0;
  return {
    startedAt: globalMetrics.startedAt,
    total: globalMetrics.total,
    hit: globalMetrics.hit,
    miss: globalMetrics.miss,
    bypass: globalMetrics.bypass,
    set: globalMetrics.set,
    readErr: globalMetrics.readErr,
    writeErr: globalMetrics.writeErr,
    hitRate,
    missRate,
    byPrefix: mapToObj(globalMetrics.byPrefix),
    byTag: mapToObj(globalMetrics.byTag)
  };
}

export type CacheMiddlewareOptions = {
  ttlSeconds: number | ((req: Request) => number);
  keyPrefix?: string;
  shouldCache?: (req: Request) => boolean;
  excludePaths?: string[];
  logEvery?: number;
  keyFn?: (req: Request) => string;
  tagsFn?: (req: Request) => string[];
  tagPrefix?: string;
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
  const ttlDefault = options.ttlSeconds;
  const keyPrefix = options.keyPrefix || "cache";
  const tagPrefix = options.tagPrefix || `${keyPrefix}:tag`;
  const shouldCache = options.shouldCache || defaultShouldCache;
  const excludePaths = (options.excludePaths || []).filter(Boolean);
  const logEvery = Math.max(0, Number(options.logEvery || 0));
  const keyFn = options.keyFn;
  const tagsFn = options.tagsFn;
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
      recordMetric(keyPrefix, "total", []);
      recordMetric(keyPrefix, "bypass", []);
      return next();
    }

    const client = createRedisClient();
    if (!client) {
      bypasses += 1;
      recordMetric(keyPrefix, "total", []);
      recordMetric(keyPrefix, "bypass", []);
      return next();
    }

    const scope = keyFn ? keyFn(req) : "";
    const keyRaw = `${req.originalUrl}|${scope}`;
    const key = `${keyPrefix}:${createHash("sha1").update(keyRaw).digest("hex")}`;
    const ttlSeconds =
      typeof ttlDefault === "function" ? ttlDefault(req) : Math.max(5, Number(ttlDefault || 0));
    const tags = tagsFn ? tagsFn(req) : [];
    recordMetric(keyPrefix, "total", tags);

    try {
      if (client.status !== "ready") {
        await client.connect();
      }
      const cached = await client.get(key);
      if (cached) {
        hits += 1;
        recordMetric(keyPrefix, "hit", tags);
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        console.log(`Cache HIT ${keyPrefix} ${req.originalUrl}`);
        return res.send(cached);
      }
      misses += 1;
      recordMetric(keyPrefix, "miss", tags);
      console.log(`Cache MISS ${keyPrefix} ${req.originalUrl}`);
    } catch (error) {
      bypasses += 1;
      readErrors += 1;
      recordMetric(keyPrefix, "bypass", tags);
      recordMetric(keyPrefix, "readErr", tags);
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
              recordMetric(keyPrefix, "set", tags);
              console.log(`Cache SET ${keyPrefix} ${req.originalUrl} ttl=${ttlSeconds}`);
              if (tags.length > 0) {
                tags.forEach((tag) => {
                  const tagKey = `${tagPrefix}:${tag}`;
                  client
                    .sadd(tagKey, key)
                    .then(() => client.expire(tagKey, Math.max(60, ttlSeconds + 60)))
                    .catch((error) => {
                      console.warn("Cache tag write failed:", (error as any)?.message || error);
                    });
                });
              }
            })
            .catch((error) => {
              writeErrors += 1;
              recordMetric(keyPrefix, "writeErr", tags);
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
      const hitRate = total ? Math.round((hits / total) * 100) : 0;
      const missRate = total ? Math.round((misses / total) * 100) : 0;
      console.log(
        `Cache summary total=${total} hit=${hits} miss=${misses} bypass=${bypasses} set=${sets} readErr=${readErrors} writeErr=${writeErrors} hitRate=${hitRate}% missRate=${missRate}%`
      );
    }

    next();
  };
}
