import { Queue } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  connectTimeout: 1500
});

connection.on("error", (err) => {
  console.error("Redis connection error (notification queue):", err?.message || err);
});

const notificationQueue = new Queue("notifications", {
  connection
});

export async function enqueueNotification(notificationId: string) {
  try {
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
