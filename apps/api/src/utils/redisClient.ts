import { Redis } from "ioredis";

let redisInstance: Redis | null = null;

function buildRedisOptions(redisUrl: string) {
  const useTls = redisUrl.startsWith("rediss://");
  return {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 1500,
    ...(useTls ? { tls: {} } : {}),
  };
}

export function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log("REDIS_URL not defined.");
    return null;
  }

  if (redisInstance) {
    return redisInstance;
  }

  const client = new Redis(redisUrl, buildRedisOptions(redisUrl));

  client.on("connect", () => {
    console.log("Redis connected");
  });

  client.on("ready", () => {
    console.log("Redis ready");
  });

  client.on("error", (err) => {
    console.error("Redis error:", err?.message || err);
  });

  client.on("close", () => {
    console.warn("Redis connection closed");
  });

  redisInstance = client;

  return client;
}

export function disconnectRedisClient() {
  redisInstance?.disconnect();
  redisInstance = null;
}

export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  return {
    url: redisUrl,
    ...buildRedisOptions(redisUrl),
  };
}
