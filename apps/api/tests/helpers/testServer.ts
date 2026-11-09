import type { AddressInfo } from "node:net";
import { after } from "node:test";

import app from "../../src/app.js";
import { closeCacheWarmQueue } from "../../src/services/cacheWarmQueue.js";
import { closeEmailQueue } from "../../src/services/emailQueue.js";
import { closeNotificationQueue } from "../../src/services/notificationQueue.js";
import prisma from "../../src/utils/prisma.js";
import { disconnectRedisClient } from "../../src/utils/redisClient.js";

after(async () => {
  await Promise.all([closeCacheWarmQueue(), closeEmailQueue(), closeNotificationQueue()]);
  disconnectRedisClient();
  await prisma.$disconnect();
});

export async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", (err) => reject(err));
  });

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
