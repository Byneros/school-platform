import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import app from "./app.js";
import { startNotificationWorker } from "./workers/notificationWorker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFromCwd = resolve(process.cwd(), ".env");
const envFromSrc = resolve(__dirname, "..", ".env");
const cwdResult = dotenv.config({ path: envFromCwd });
if (cwdResult.error) {
  dotenv.config({ path: envFromSrc });
}

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

const workerEnabledEnv = String(
  process.env.NOTIFICATION_WORKER_ENABLED ||
    (process.env.NODE_ENV === "production" ? "true" : "false")
).toLowerCase();
const shouldStartWorker = workerEnabledEnv === "true";

if (shouldStartWorker) {
  try {
    startNotificationWorker();
  } catch (error) {
    console.error("No se pudo iniciar el worker de notificaciones:", error);
  }
} else {
  console.log("Notification worker deshabilitado (NOTIFICATION_WORKER_ENABLED!=true).");
}
