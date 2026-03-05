param(
  [string]$InputFile = "infra/nginx/edge/schools-map.example.json",
  [string]$OutputFile = "infra/nginx/edge/school-multi.conf"
)

$ErrorActionPreference = "Stop"

function Resolve-ProjectPath([string]$path) {
  if ([System.IO.Path]::IsPathRooted($path)) {
    return $path
  }
  $root = Resolve-Path (Join-Path $PSScriptRoot "..")
  return (Join-Path $root $path)
}

$inputPath = Resolve-ProjectPath $InputFile
$outputPath = Resolve-ProjectPath $OutputFile

if (-not (Test-Path $inputPath)) {
  throw "No existe el archivo de mapeo: $inputPath"
}

$raw = Get-Content -Raw -Path $inputPath
$items = $raw | ConvertFrom-Json
$items = @($items)

if ($null -eq $items -or $items.Count -eq 0) {
  throw "El archivo de mapeo no contiene colegios."
}

$header = @(
  "# ============================================",
  "# NGINX Edge SSL - Multi colegio por subdominio",
  "# Archivo generado automaticamente por:",
  "#   scripts/generate-nginx-multi.ps1",
  "# NO editar manualmente: regenera desde el mapping JSON.",
  "# ============================================",
  ""
)

$blocks = New-Object System.Collections.Generic.List[string]

foreach ($it in $items) {
  if (-not $it.domain) { throw "Falta 'domain' en un item del mapping." }
  if (-not $it.webPort) { throw "Falta 'webPort' en item '$($it.domain)'." }

  $domain = [string]$it.domain
  $webPort = [int]$it.webPort
  if ($webPort -lt 1 -or $webPort -gt 65535) {
    throw "Puerto invalido para '$domain': $webPort"
  }

  $label = if ($it.collegeCode) { [string]$it.collegeCode } else { $domain }

  $httpBlock = @"
# -------- $label (HTTP -> HTTPS + ACME) --------
server {
  listen 80;
  server_name $domain;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://`$host`$request_uri;
  }
}
"@

  $httpsBlock = @"
# -------- $label (HTTPS) --------
server {
  listen 443 ssl http2;
  server_name $domain;

  ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_session_timeout 1d;
  ssl_session_cache shared:SSL:10m;
  ssl_prefer_server_ciphers off;

  add_header X-Frame-Options SAMEORIGIN always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;

  location / {
    proxy_pass http://127.0.0.1:$webPort;
    proxy_http_version 1.1;
    proxy_set_header Host `$host;
    proxy_set_header X-Real-IP `$remote_addr;
    proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto `$scheme;
  }
}
"@

  $blocks.Add($httpBlock.Trim())
  $blocks.Add("")
  $blocks.Add($httpsBlock.Trim())
  $blocks.Add("")
}

$content = ($header + $blocks) -join [Environment]::NewLine

$outDir = Split-Path -Parent $outputPath
if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Set-Content -Path $outputPath -Value $content -Encoding UTF8

Write-Host "Archivo generado: $outputPath"
Write-Host "Colegios procesados: $($items.Count)"
