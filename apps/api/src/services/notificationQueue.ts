import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "../utils/redisClient.js";
import { getQueueJobOptions } from "../utils/queueDefaults.js";

const connection = getRedisConnectionOptions();
const notificationQueue = connection ? new Queue("notifications", { connection }) : null;

export async function closeNotificationQueue() {
  await notificationQueue?.close();
}

export async function enqueueNotification(notificationId: string) {
  try {
    if (!notificationQueue) {
      console.warn("Redis no configurado. Notificacion no encolada.");
      return { queued: false };
    }
    await notificationQueue.add("send", { notificationId }, getQueueJobOptions());
    return { queued: true };
  } catch (error) {
    console.error("No fue posible encolar notificacion:", (error as any)?.message || error);
    return { queued: false };
  }
}
