import type { NextFunction, Request, Response } from "express";
import { createRedisClient } from "../utils/redisClient.js";

type CacheInvalidationOptions = {
  tagsFn: (req: Request) => string[];
  keyPrefix?: string;
  onInvalidated?: (tags: string[], req: Request) => void;
};

export function invalidateCache(options: CacheInvalidationOptions) {
  const keyPrefix = options.keyPrefix || "cache";
  const tagPrefix = `${keyPrefix}:tag`;
  const tagsFn = options.tagsFn;
  const onInvalidated = options.onInvalidated;

  return (req: Request, res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const tags = tagsFn(req);
    if (!tags || tags.length === 0) return next();

    const client = createRedisClient();
    if (!client) return next();

    res.on("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 400) return;
      (async () => {
        try {
          if (client.status !== "ready") {
            await client.connect();
          }
          for (const tag of tags) {
            const tagKey = `${tagPrefix}:${tag}`;
            const keys = await client.smembers(tagKey);
            if (keys.length > 0) {
              await client.del(...keys);
            }
            await client.del(tagKey);
          }
          console.log(`Cache invalidated tags=${tags.join(",")}`);
          if (onInvalidated) {
            onInvalidated(tags, req);
          }
        } catch (error) {
          console.warn("Cache invalidation failed:", (error as any)?.message || error);
        }
      })();
    });

    next();
  };
}
