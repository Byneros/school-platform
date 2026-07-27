import type { JobsOptions } from "bullmq";

export function getQueueJobOptions(overrides: JobsOptions = {}): JobsOptions {
  const attempts = Math.max(1, Number(process.env.QUEUE_ATTEMPTS || 3));
  const backoffMs = Math.max(1000, Number(process.env.QUEUE_BACKOFF_MS || 5000));

  return {
    attempts,
    backoff: { type: "exponential", delay: backoffMs },
    removeOnComplete: true,
    removeOnFail: 500,
    ...overrides,
  };
}
