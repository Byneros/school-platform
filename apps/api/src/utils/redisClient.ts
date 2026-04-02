import { Redis } from "ioredis";

let redisInstance: Redis | null = null;

export function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log("⚠️ REDIS_URL no definida");
    return null;
  }

  // ✅ Evita múltiples conexiones
  if (redisInstance) {
    return redisInstance;
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,

    // 🔥 CLAVE PARA UPSTASH
    tls: {},

    // Reintentos controlados
    retryStrategy: (times) => {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
  });

  client.on("connect", () => {
    console.log("✅ Redis conectado");
  });

  client.on("ready", () => {
    console.log("🚀 Redis listo");
  });

  client.on("error", (err) => {
    console.error("❌ Error Redis:", err?.message || err);
  });

  client.on("close", () => {
    console.warn("⚠️ Redis cerrado");
  });

  redisInstance = client;

  return client;
}

export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  return {
    url: redisUrl,
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,

    // 🔥 IMPORTANTE
    tls: {},
  };
}
