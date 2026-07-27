import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
if (!isProd) {
  const envFromCwd = resolve(process.cwd(), ".env");
  const envFromSrc = resolve(__dirname, "..", ".env");
  const cwdResult = dotenv.config({ path: envFromCwd });
  if (cwdResult.error) {
    dotenv.config({ path: envFromSrc });
  }
}

const { default: app } = await import("./app.js");
const { startNotificationWorker } = await import("./workers/notificationWorker.js");
const { startEmailWorker } = await import("./workers/emailWorker.js");
const { startCacheWarmWorker } = await import("./workers/cacheWarmWorker.js");

const PORT = Number(process.env.PORT) || (isProd ? 3000 : 4003);
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      [
        `No se pudo iniciar la API: el puerto ${PORT} ya esta en uso.`,
        "Cierra el proceso que ocupa ese puerto o define otro puerto antes de iniciar:",
        "  PowerShell: $env:PORT=4004; npm.cmd run dev:api",
        "  CMD: set PORT=4004 && npm.cmd run dev:api",
      ].join("\n")
    );
    process.exit(1);
  }

  console.error("No se pudo iniciar la API:", error.message || error);
  process.exit(1);
});

function shouldStartWorker(envKey: string) {
  const raw = process.env[envKey];
  const fallback = process.env.NODE_ENV === "production" ? "true" : "false";
  return String(raw ?? fallback).toLowerCase() === "true";
}

if (shouldStartWorker("NOTIFICATION_WORKER_ENABLED")) {
  try {
    startNotificationWorker();
  } catch (error) {
    console.error("No se pudo iniciar el worker de notificaciones:", error);
  }
} else {
  console.log("Notification worker deshabilitado (NOTIFICATION_WORKER_ENABLED!=true).");
}

if (shouldStartWorker("EMAIL_WORKER_ENABLED")) {
  try {
    startEmailWorker();
  } catch (error) {
    console.error("No se pudo iniciar el worker de emails:", error);
  }
} else {
  console.log("Email worker deshabilitado (EMAIL_WORKER_ENABLED!=true).");
}

if (shouldStartWorker("CACHE_WARM_WORKER_ENABLED")) {
  try {
    startCacheWarmWorker();
  } catch (error) {
    console.error("No se pudo iniciar el worker de cache warm:", error);
  }
} else {
  console.log("Cache warm worker deshabilitado (CACHE_WARM_WORKER_ENABLED!=true).");
}
