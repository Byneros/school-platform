import { Worker } from "bullmq";
import { getRedisConnectionOptions } from "../utils/redisClient.js";

type CacheWarmPayload = {
  urls: string[];
};

function getWarmConfig() {
  const enabled = String(process.env.CACHE_WARM_ENABLED || "").toLowerCase() === "true";
  const baseUrl = String(process.env.CACHE_WARM_BASE_URL || "").replace(/\/+$/, "");
  const token = String(process.env.CACHE_WARM_TOKEN || "");
  const timeoutMs = Math.max(500, Number(process.env.CACHE_WARM_TIMEOUT_MS || 4000));
  return { enabled, baseUrl, token, timeoutMs };
}

async function warmUrl(url: string, config: ReturnType<typeof getWarmConfig>) {
  if (!config.token && url.startsWith("/api")) {
    console.warn("CACHE_WARM_TOKEN no configurado. Omitiendo warm para:", url);
    return;
  }
  if (url.startsWith("http")) {
    return await fetch(url, {
      method: "GET",
      headers: {
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        "X-Cache-Warm": "1"
      },
      signal: controller.signal
    }).then((res) => {
      if (!res.ok) throw new Error(`Warm failed ${res.status}`);
      return res.text();
    }).finally(() => clearTimeout(timeout));
  }
  const base = config.baseUrl.replace(/\/+$/, "");
  let path = url.startsWith("/") ? url : `/${url}`;
  if (base.endsWith("/api") && path.startsWith("/api")) {
    path = path.slice(4);
  }
  const fullUrl = `${base}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(fullUrl, {
      method: "GET",
      headers: {
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        "X-Cache-Warm": "1"
      },
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`Warm failed ${res.status}`);
    }
    await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function startCacheWarmWorker() {
  const connection = getRedisConnectionOptions();
  if (!connection) {
    console.warn("Redis no configurado. Cache warm worker deshabilitado.");
    return null;
  }
  const config = getWarmConfig();
  if (!config.enabled) {
    console.log("Cache warm deshabilitado (CACHE_WARM_ENABLED!=true).");
    return null;
  }
  if (!config.baseUrl) {
    console.warn("CACHE_WARM_BASE_URL no configurado. Cache warm worker deshabilitado.");
    return null;
  }

  const worker = new Worker(
    "cache-warm",
    async (job) => {
      const payload = job.data as CacheWarmPayload;
      const urls = Array.isArray(payload.urls) ? payload.urls : [];
      for (const url of urls) {
        await warmUrl(url, config);
      }
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.warn("Cache warm job failed", job?.id, err?.message || err);
  });
  worker.on("error", (err) => {
    console.warn("Cache warm worker error:", err?.message || err);
  });

  return worker;
}
