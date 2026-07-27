import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const apiEnvPath = path.join(rootDir, "apps", "api", ".env");
const npmCmd = "npm";

function logStep(message) {
  console.log(`\n[preprod] ${message}`);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function runNpm(args, extraEnv = {}, options = {}) {
  const command = [npmCmd, ...args].join(" ");
  logStep(`Ejecutando: ${command}`);
  const result = spawnSync(npmCmd, args, {
    cwd: rootDir,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (options.allowFailure) {
      return { ok: false, status: result.status, command };
    }
    throw new Error(`Comando fallo: ${command}`);
  }
  return { ok: true, status: result.status, command };
}

function releaseApiPort(port) {
  if (process.platform !== "win32") return;
  const psScript = `
    $pids = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
      try { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } catch {}
    }
  `;
  spawnSync("powershell", ["-NoProfile", "-Command", psScript], {
    cwd: rootDir,
    shell: true,
    stdio: "ignore",
  });
}

function stopProjectNodeProcesses() {
  if (process.platform !== "win32") return;
  const psScript = `
    $current = ${process.pid}
    $targets = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
      Where-Object {
        $_.ProcessId -ne $current -and
        $_.CommandLine -match 'school-platform'
      }
    foreach ($p in $targets) {
      try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }
  `;
  spawnSync("powershell", ["-NoProfile", "-Command", psScript], {
    cwd: rootDir,
    shell: true,
    stdio: "ignore",
  });
}

async function requestJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const json = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForReady(baseUrl, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await requestJson(`${baseUrl}/ready`, 2500);
      if (res.ok && res.json?.ok === true) return true;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function main() {
  const envVars = parseEnvFile(apiEnvPath);
  const required = ["PORT", "DATABASE_URL", "JWT_SECRET"];
  const missing = required.filter((key) => !String(envVars[key] || "").trim());
  if (missing.length > 0) {
    throw new Error(`Faltan variables en apps/api/.env: ${missing.join(", ")}`);
  }

  if (String(envVars.JWT_SECRET || "").trim() === "change_me") {
    console.warn(
      "[preprod] ADVERTENCIA: JWT_SECRET sigue con valor por defecto 'change_me'. Cambialo antes de produccion."
    );
  }

  const port = Number(envVars.PORT || 4000);
  const baseUrl = process.env.TEST_API_URL || `http://localhost:${port}`;
  const skipLive = process.argv.includes("--skip-live");

  runNpm(["run", "prisma:migrate:deploy"]);
  releaseApiPort(port);
  stopProjectNodeProcesses();
  const generate = runNpm(
    ["run", "prisma:generate"],
    {},
    { allowFailure: process.platform === "win32" }
  );
  if (!generate.ok) {
    console.warn(
      "[preprod] ADVERTENCIA: prisma:generate fallo en Windows (bloqueo de query_engine). " +
        "Continuando con verificacion. Cierra procesos Node y vuelve a correr para validar este paso."
    );
  }
  runNpm(["--workspace", "apps/api", "run", "build"]);
  runNpm(["--workspace", "apps/web", "run", "build"]);

  if (skipLive) {
    logStep("Verificacion live omitida (--skip-live).");
    console.log("\n[preprod] Verificacion tecnica completada.");
    return;
  }

  logStep(`Verificando API en ${baseUrl}`);
  let apiStartedByScript = null;
  let isUp = await waitForReady(baseUrl, 5000);

  if (!isUp) {
    logStep("API no detectada. Iniciando API temporalmente...");
    apiStartedByScript = spawn(npmCmd, ["run", "start:api"], {
      cwd: rootDir,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    apiStartedByScript.stdout.on("data", (chunk) => {
      process.stdout.write(`[api] ${String(chunk)}`);
    });
    apiStartedByScript.stderr.on("data", (chunk) => {
      process.stderr.write(`[api] ${String(chunk)}`);
    });

    isUp = await waitForReady(baseUrl, 30000);
  }

  if (!isUp) {
    if (apiStartedByScript) apiStartedByScript.kill();
    throw new Error(`No se pudo validar /ready en ${baseUrl}`);
  }

  try {
    runNpm(["--workspace", "apps/api", "run", "test:regression"], {
      TEST_API_URL: baseUrl,
    });
  } finally {
    if (apiStartedByScript) {
      apiStartedByScript.kill();
    }
  }

  console.log("\n[preprod] Verificacion completa OK.");
}

main().catch((error) => {
  console.error(`\n[preprod] ERROR: ${error?.message || error}`);
  process.exit(1);
});
