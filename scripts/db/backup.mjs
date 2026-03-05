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

function nowStamp() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
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

async function dumpToFile({ containerId, dbUser, dbName, filePath, dryRun }) {
  if (dryRun) {
    console.log(`[dry-run] docker exec ${containerId} pg_dump -U ${dbUser} -d ${dbName} ... > ${filePath}`);
    return;
  }

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(filePath, { encoding: "utf8" });
    const child = spawn(
      "docker",
      [
        "exec",
        containerId,
        "pg_dump",
        "-U",
        dbUser,
        "-d",
        dbName,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges"
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    child.stdout.pipe(out);
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      out.close();
      if (code !== 0) {
        reject(new Error(stderr || `pg_dump fallo con codigo ${code}`));
        return;
      }
      resolve();
    });
  });
}

function cleanupOldBackups({ outputDir, retentionDays, dryRun }) {
  const files = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("school-platform-backup-") && entry.name.endsWith(".sql"))
    .map((entry) => ({
      name: entry.name,
      fullPath: path.join(outputDir, entry.name),
      mtimeMs: fs.statSync(path.join(outputDir, entry.name)).mtimeMs
    }));

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const toDelete = files.filter((f) => f.mtimeMs < cutoff);
  for (const file of toDelete) {
    if (dryRun) {
      console.log(`[dry-run] delete ${file.fullPath}`);
    } else {
      fs.unlinkSync(file.fullPath);
    }
  }
  return toDelete.length;
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, "..", "..");
  const composeFile = path.resolve(rootDir, "infra", "docker-compose.yml");
  const outputDir = path.resolve(getArg("output-dir", path.resolve(rootDir, "backups")));
  const retentionDays = Number(getArg("retention-days", process.env.BACKUP_RETENTION_DAYS || "14"));
  const dbUser = getArg("db-user", process.env.DB_USER || "postgres");
  const dbName = getArg("db-name", process.env.DB_NAME || "school_platform");
  const dryRun =
    hasFlag("dry-run") ||
    hasFlag("simulate") ||
    process.env.DRY_RUN === "1" ||
    process.env.npm_config_dry_run === "true";
  const explicitContainer = getArg("container", process.env.DB_CONTAINER || "");

  if (Number.isNaN(retentionDays) || retentionDays < 1) {
    throw new Error("retention-days debe ser un numero mayor o igual a 1");
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const containerId = explicitContainer || detectContainerId(composeFile);
  const fileName = `school-platform-backup-${nowStamp()}.sql`;
  const filePath = path.join(outputDir, fileName);

  await dumpToFile({ containerId, dbUser, dbName, filePath, dryRun });
  const deleted = cleanupOldBackups({ outputDir, retentionDays, dryRun });

  console.log(
    dryRun
      ? `[dry-run] backup listo (simulado): ${filePath}. Eliminados por retencion: ${deleted}`
      : `Backup generado: ${filePath}. Eliminados por retencion: ${deleted}`
  );
}

main().catch((error) => {
  console.error("Error en backup:", error?.message || error);
  process.exit(1);
});
