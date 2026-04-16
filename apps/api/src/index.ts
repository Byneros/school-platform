import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import app from "./app.js";
import { startNotificationWorker } from "./workers/notificationWorker.js";
import { startEmailWorker } from "./workers/emailWorker.js";
import { startCacheWarmWorker } from "./workers/cacheWarmWorker.js";

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

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
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
