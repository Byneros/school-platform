import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import app from "./app.js";
import { startNotificationWorker } from "./workers/notificationWorker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
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
