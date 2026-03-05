import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

function parseArgs(argv) {
  const out = {
    config: "infra/bootstrap/schools-batch.json",
    execute: false,
    stopOnError: true,
    useSudo: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") out.config = argv[++i];
    else if (arg === "--execute") out.execute = true;
    else if (arg === "--no-stop-on-error") out.stopOnError = false;
    else if (arg === "--no-sudo") out.useSudo = false;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Argumento no reconocido: ${arg}`);
  }
  return out;
}

function usage() {
  console.log(
    [
      "Uso:",
      "  node scripts/bootstrap-multi-schools.mjs --config infra/bootstrap/schools-batch.json",
      "  node scripts/bootstrap-multi-schools.mjs --config <file.json> --execute",
      "",
      "Opciones:",
      "  --config <path>       JSON de lote (default infra/bootstrap/schools-batch.json)",
      "  --execute             Ejecuta comandos. Sin esto, solo imprime plan",
      "  --no-stop-on-error    Continua aunque un colegio falle",
      "  --no-sudo             Ejecuta sin prefijo sudo",
    ].join("\n"),
  );
}

function loadConfig(path) {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Config JSON invalido.");
  }
  const schools = Array.isArray(parsed.schools) ? parsed.schools : [];
  if (!schools.length) {
    throw new Error("Config sin colegios: 'schools' vacio.");
  }
  const defaults = parsed.defaults && typeof parsed.defaults === "object" ? parsed.defaults : {};
  return { defaults, schools };
}

function normalizeSchools(defaults, schools) {
  const webPortStart = Number(defaults.webPortStart ?? 8081);
  if (!Number.isInteger(webPortStart) || webPortStart < 1 || webPortStart > 65535) {
    throw new Error(`defaults.webPortStart invalido: ${defaults.webPortStart}`);
  }

  const usedPorts = new Set();
  const usedCodes = new Set();
  const usedDomains = new Set();

  return schools.map((s, idx) => {
    const collegeCode = String(s?.collegeCode || "").trim();
    const domain = String(s?.domain || "").trim();
    const email = String(s?.email || "").trim();
    const schoolName = String(s?.schoolName || "").trim();
    const repoUrl = String(s?.repoUrl || defaults.repoUrl || "").trim();
    const branch = String(s?.branch || defaults.branch || "main").trim();
    const repoDir = String(s?.repoDir || defaults.repoDir || "/opt/school-platform").trim();

    if (!collegeCode || !domain || !email || !schoolName || !repoUrl) {
      throw new Error(`Colegio en posicion ${idx} tiene campos obligatorios faltantes.`);
    }

    let webPort = Number(s?.webPort);
    if (!Number.isInteger(webPort)) {
      webPort = webPortStart + idx;
    }
    if (webPort < 1 || webPort > 65535) {
      throw new Error(`webPort invalido en ${collegeCode}: ${webPort}`);
    }

    if (usedCodes.has(collegeCode)) throw new Error(`collegeCode duplicado: ${collegeCode}`);
    if (usedDomains.has(domain)) throw new Error(`domain duplicado: ${domain}`);
    if (usedPorts.has(webPort)) throw new Error(`webPort duplicado: ${webPort}`);

    usedCodes.add(collegeCode);
    usedDomains.add(domain);
    usedPorts.add(webPort);

    return { collegeCode, domain, email, schoolName, webPort, repoUrl, branch, repoDir };
  });
}

function buildCommand(item, useSudo) {
  const args = [
    "bash",
    "scripts/bootstrap-school-server.sh",
    "--college-code",
    item.collegeCode,
    "--domain",
    item.domain,
    "--email",
    item.email,
    "--school-name",
    item.schoolName,
    "--web-port",
    String(item.webPort),
    "--repo-url",
    item.repoUrl,
    "--branch",
    item.branch,
    "--repo-dir",
    item.repoDir,
  ];

  if (useSudo) {
    return { cmd: "sudo", args };
  }
  return { cmd: args[0], args: args.slice(1) };
}

function printableCommand(command) {
  return [command.cmd, ...command.args].join(" ");
}

function run(command, execute) {
  console.log(`[bootstrap:multi] ${printableCommand(command)}`);
  if (!execute) return 0;
  const result = spawnSync(command.cmd, command.args, { stdio: "inherit" });
  return result.status ?? 1;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const configPath = resolve(process.cwd(), args.config);
  const { defaults, schools } = loadConfig(configPath);
  const normalized = normalizeSchools(defaults, schools);

  console.log(`[bootstrap:multi] Config: ${configPath}`);
  console.log(`[bootstrap:multi] Colegios: ${normalized.length}`);
  console.log(`[bootstrap:multi] Modo: ${args.execute ? "EXECUTE" : "PLAN"}`);

  let ok = 0;
  let fail = 0;

  for (const item of normalized) {
    console.log(
      `[bootstrap:multi] >>> ${item.collegeCode} | ${item.domain} | puerto=${item.webPort}`,
    );
    const cmd = buildCommand(item, args.useSudo);
    const code = run(cmd, args.execute);
    if (code === 0) {
      ok += 1;
      continue;
    }

    fail += 1;
    console.error(`[bootstrap:multi] ERROR ${item.collegeCode} (exit=${code})`);
    if (args.stopOnError) {
      break;
    }
  }

  console.log(`[bootstrap:multi] Resumen: ${ok} OK, ${fail} ERROR`);
  if (fail > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`[bootstrap:multi] ERROR ${error?.message || error}`);
  usage();
  process.exit(1);
}
