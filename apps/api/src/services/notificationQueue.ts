import { Queue } from "bullmq";
import { createRedisClient } from "../utils/redisClient.js";

const connection = createRedisClient();
const notificationQueue = connection
  ? new Queue("notifications", { connection })
  : null;

export async function enqueueNotification(notificationId: string) {
  try {
    if (!connection || !notificationQueue) {
      console.warn("Redis no configurado. Notificacion no encolada.");
      return { queued: false };
    }
    if (connection.status !== "ready") {
      await connection.connect();
    }
    await notificationQueue.add("send", { notificationId });
    return { queued: true };
  } catch (error) {
    console.error("No fue posible encolar notificacion:", (error as any)?.message || error);
    return { queued: false };
  }
}
