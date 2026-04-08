import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "../utils/redisClient.js";
import { getQueueJobOptions } from "../utils/queueDefaults.js";
import { canSendEmail } from "../utils/mailer.js";

export type EmailJobPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const connection = getRedisConnectionOptions();
const emailQueue = connection ? new Queue("emails", { connection }) : null;

export async function enqueueEmail(payload: EmailJobPayload) {
  try {
    if (!canSendEmail()) {
      console.warn("SMTP no configurado. Email no encolado.");
      return false;
    }
    if (!emailQueue) {
      console.warn("Redis no configurado. Email no encolado.");
      return false;
    }
    await emailQueue.add("send", payload, getQueueJobOptions());
    return true;
  } catch (error) {
    console.error("No fue posible encolar email:", (error as any)?.message || error);
    return false;
  }
}
