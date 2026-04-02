import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

export function createRedisClient() {
  if (!redisUrl) {
    return null;
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 1500
  });

  client.on("connect", () => {
    console.log("Redis conectado");
  });

  client.on("error", (err) => {
    console.error("Error Redis:", err?.message || err);
  });

  return client;
}
