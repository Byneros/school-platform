import { Worker } from "bullmq";
import { sendEmail } from "../utils/mailer.js";
import { getRedisConnectionOptions } from "../utils/redisClient.js";

type EmailJobPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function startEmailWorker() {
  const connection = getRedisConnectionOptions();
  if (!connection) {
    console.warn("Redis no configurado. Worker de emails deshabilitado.");
    return null;
  }

  const worker = new Worker(
    "emails",
    async (job) => {
      const data = job.data as EmailJobPayload;
      const sent = await sendEmail(data);
      if (!sent) {
        throw new Error("SMTP no configurado o envio fallido");
      }
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error("Email job failed", job?.id, err?.message || err);
  });
  worker.on("error", (err) => {
    console.error("Email worker error:", err?.message || err);
  });

  return worker;
}
