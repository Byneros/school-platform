import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const out = {
    input: "infra/nginx/edge/schools-map.example.json",
    output: "infra/nginx/edge/school-multi.conf",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") out.input = argv[++i];
    else if (arg === "--output") out.output = argv[++i];
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Argumento no reconocido: ${arg}`);
  }

  return out;
}

function usage() {
  console.log(
    [
      "Uso:",
      "  node scripts/generate-nginx-multi.mjs [--input infra/nginx/edge/schools-map.example.json] [--output infra/nginx/edge/school-multi.conf]",
    ].join("\n"),
  );
}

function loadItems(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (!items.length) throw new Error("El archivo de mapeo no contiene colegios.");
  return items;
}

function validatePort(port, domain) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Puerto invalido para '${domain}': ${port}`);
  }
}

function buildConfig(items) {
  const lines = [
    "# ============================================",
    "# NGINX Edge SSL - Multi colegio por subdominio",
    "# Archivo generado automaticamente por:",
    "#   scripts/generate-nginx-multi.mjs",
    "# NO editar manualmente: regenera desde el mapping JSON.",
    "# ============================================",
    "",
  ];

  for (const it of items) {
    const domain = String(it?.domain || "").trim();
    const collegeCode = String(it?.collegeCode || domain).trim();
    const webPort = Number(it?.webPort);

    if (!domain) throw new Error("Falta 'domain' en un item del mapping.");
    validatePort(webPort, domain);

    lines.push(`# -------- ${collegeCode} (HTTP -> HTTPS + ACME) --------`);
    lines.push("server {");
    lines.push("  listen 80;");
    lines.push(`  server_name ${domain};`);
    lines.push("");
    lines.push("  location /.well-known/acme-challenge/ {");
    lines.push("    root /var/www/certbot;");
    lines.push("  }");
    lines.push("");
    lines.push("  location / {");
    lines.push("    return 301 https://$host$request_uri;");
    lines.push("  }");
    lines.push("}");
    lines.push("");

    lines.push(`# -------- ${collegeCode} (HTTPS) --------`);
    lines.push("server {");
    lines.push("  listen 443 ssl http2;");
    lines.push(`  server_name ${domain};`);
    lines.push("");
    lines.push(`  ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;`);
    lines.push(`  ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;`);
    lines.push("  ssl_protocols TLSv1.2 TLSv1.3;");
    lines.push("  ssl_session_timeout 1d;");
    lines.push("  ssl_session_cache shared:SSL:10m;");
    lines.push("  ssl_prefer_server_ciphers off;");
    lines.push("");
    lines.push("  add_header X-Frame-Options SAMEORIGIN always;");
    lines.push("  add_header X-Content-Type-Options nosniff always;");
    lines.push("  add_header Referrer-Policy strict-origin-when-cross-origin always;");
    lines.push('  add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;');
    lines.push("");
    lines.push("  location / {");
    lines.push(`    proxy_pass http://127.0.0.1:${webPort};`);
    lines.push("    proxy_http_version 1.1;");
    lines.push("    proxy_set_header Host $host;");
    lines.push("    proxy_set_header X-Real-IP $remote_addr;");
    lines.push("    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;");
    lines.push("    proxy_set_header X-Forwarded-Proto $scheme;");
    lines.push("  }");
    lines.push("}");
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const inputPath = resolve(process.cwd(), args.input);
  const outputPath = resolve(process.cwd(), args.output);

  const items = loadItems(inputPath);
  const content = buildConfig(items);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, "utf8");

  console.log(`Archivo generado: ${outputPath}`);
  console.log(`Colegios procesados: ${items.length}`);
}

try {
  main();
} catch (error) {
  console.error(`[nginx:generate] ERROR ${error?.message || error}`);
  usage();
  process.exit(1);
}

