import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "../utils/redisClient.js";
import { getQueueJobOptions } from "../utils/queueDefaults.js";

type CacheWarmPayload = {
  urls: string[];
};

const connection = getRedisConnectionOptions();
const warmQueue = connection ? new Queue("cache-warm", { connection }) : null;

export async function enqueueCacheWarm(urls: string[]) {
  if (!urls.length) return false;
  if (!warmQueue) {
    console.warn("Redis no configurado. Cache warm no encolado.");
    return false;
  }
  try {
    const payload: CacheWarmPayload = { urls };
    await warmQueue.add("warm", payload, getQueueJobOptions({ removeOnFail: 200 }));
    return true;
  } catch (error) {
    console.warn("No fue posible encolar cache warm:", (error as any)?.message || error);
    return false;
  }
}
