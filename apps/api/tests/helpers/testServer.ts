import type { AddressInfo } from "node:net";

import app from "../../src/app.js";

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
