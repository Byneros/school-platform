import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function getArg(name, fallback = "") {
  const idx = process.argv.findIndex((arg) => arg === `--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function detectContainerId(composeFile) {
  const output = execFileSync(
    "docker",
    ["compose", "-f", composeFile, "ps", "-q", "db"],
    { encoding: "utf8" }
  ).trim();
  if (!output) {
    throw new Error(
      "No se pudo detectar el contenedor de DB. Ejecuta: npm run infra:up"
    );
  }
  return output;
}

function latestBackup(outputDir) {
  const files = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("school-platform-backup-") && entry.name.endsWith(".sql"))
    .map((entry) => path.join(outputDir, entry.name))
    .sort();
  return files.length ? files[files.length - 1] : "";
}

async function restoreFromFile({ containerId, dbUser, dbName, filePath, dryRun }) {
  if (dryRun) {
    console.log(`[dry-run] docker exec -i ${containerId} psql -v ON_ERROR_STOP=1 -U ${dbUser} -d ${dbName} < ${filePath}`);
    return;
  }

  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(filePath, { encoding: "utf8" });
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        containerId,
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        dbUser,
        "-d",
        dbName
      ],
      { stdio: ["pipe", "inherit", "pipe"] }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    input.pipe(child.stdin);
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `restore fallo con codigo ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, "..", "..");
  const composeFile = path.resolve(rootDir, "infra", "docker-compose.yml");
  const backupDir = path.resolve(getArg("backup-dir", path.resolve(rootDir, "backups")));
  const dbUser = getArg("db-user", process.env.DB_USER || "postgres");
  const dbName = getArg("db-name", process.env.DB_NAME || "school_platform");
  const dryRun =
    hasFlag("dry-run") ||
    hasFlag("simulate") ||
    process.env.DRY_RUN === "1" ||
    process.env.npm_config_dry_run === "true";
  const explicitContainer = getArg("container", process.env.DB_CONTAINER || "");
  const fileArg = getArg("file", "");

  const filePath = fileArg ? path.resolve(fileArg) : latestBackup(backupDir);
  if (!filePath) {
    throw new Error("No se encontro backup. Usa --file <ruta> o genera uno con npm run db:backup");
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  const containerId = explicitContainer || detectContainerId(composeFile);
  await restoreFromFile({ containerId, dbUser, dbName, filePath, dryRun });

  console.log(dryRun ? `[dry-run] restore listo (simulado) desde: ${filePath}` : `Restore completado desde: ${filePath}`);
}

main().catch((error) => {
  console.error("Error en restore:", error?.message || error);
  process.exit(1);
});
