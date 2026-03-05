import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

function parseArgs(argv) {
  const out = {
    map: "infra/nginx/edge/schools-map.example.json",
    mode: "issue",
    webroot: "/var/www/certbot",
    email: "",
    staging: false,
    execute: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--map") out.map = argv[++i];
    else if (arg === "--mode") out.mode = argv[++i];
    else if (arg === "--webroot") out.webroot = argv[++i];
    else if (arg === "--email") out.email = argv[++i];
    else if (arg === "--staging") out.staging = true;
    else if (arg === "--execute") out.execute = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Argumento no reconocido: ${arg}`);
  }

  return out;
}

function usage() {
  console.log(
    [
      "Uso:",
      "  node scripts/certbot-multi.mjs --mode issue --email admin@dominio.com [--execute] [--staging]",
      "  node scripts/certbot-multi.mjs --mode renew [--execute]",
      "  node scripts/certbot-multi.mjs --mode renew-dry-run [--execute]",
      "",
      "Opciones:",
      "  --map <path>       Archivo JSON de colegios (default infra/nginx/edge/schools-map.example.json)",
      "  --mode <mode>      issue | renew | renew-dry-run",
      "  --webroot <path>   Webroot ACME (default /var/www/certbot)",
      "  --email <email>    Email requerido para mode=issue",
      "  --staging          Usa Let's Encrypt staging (solo issue)",
      "  --execute          Ejecuta comandos. Sin esto, solo imprime plan",
    ].join("\n"),
  );
}

function loadDomains(mapFile) {
  const raw = readFileSync(mapFile, "utf8");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [parsed];

  if (!items.length) throw new Error("El mapping no contiene colegios.");

  const domains = [];
  for (const item of items) {
    const domain = String(item?.domain || "").trim();
    if (!domain) throw new Error("Un item del mapping no tiene 'domain'.");
    domains.push(domain);
  }
  return [...new Set(domains)];
}

function runCommand(args, execute) {
  const printable = ["certbot", ...args].join(" ");
  console.log(`[certbot] ${printable}`);
  if (!execute) return { status: 0 };

  const result = spawnSync("certbot", args, { stdio: "inherit" });
  return result;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const validModes = new Set(["issue", "renew", "renew-dry-run"]);
  if (!validModes.has(args.mode)) {
    throw new Error(`Modo invalido: ${args.mode}`);
  }

  if (args.mode === "issue" && !args.email) {
    throw new Error("En mode=issue debes pasar --email.");
  }

  const domains = loadDomains(args.map);
  console.log(`[certbot] Dominios detectados: ${domains.join(", ")}`);
  console.log(`[certbot] Modo: ${args.mode} | Execute: ${args.execute ? "SI" : "NO (solo plan)"}`);

  if (args.mode === "issue") {
    for (const domain of domains) {
      const cmdArgs = [
        "certonly",
        "--webroot",
        "-w",
        args.webroot,
        "-d",
        domain,
        "--non-interactive",
        "--agree-tos",
        "-m",
        args.email,
      ];
      if (args.staging) cmdArgs.push("--staging");
      const result = runCommand(cmdArgs, args.execute);
      if (result.status !== 0) {
        process.exit(result.status || 1);
      }
    }
    return;
  }

  const renewArgs = ["renew"];
  if (args.mode === "renew-dry-run") {
    renewArgs.push("--dry-run");
  }
  const result = runCommand(renewArgs, args.execute);
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[certbot] ERROR ${error?.message || error}`);
  usage();
  process.exit(1);
}
