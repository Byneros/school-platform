$ErrorActionPreference = "Stop"

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "== School Platform: inicio rapido ==" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $PSScriptRoot
$dockerComposePath = Join-Path $repoRoot "infra/docker-compose.yml"

if (-not (Test-Command "docker")) {
  Write-Host "Docker no esta instalado o no esta en PATH." -ForegroundColor Red
  exit 1
}

if (-not (Test-Command "npm")) {
  Write-Host "npm no esta disponible en PATH." -ForegroundColor Red
  exit 1
}

Write-Host "Levantando infraestructura (Postgres, Redis, Mailpit)..." -ForegroundColor Yellow
docker compose -f $dockerComposePath up -d

$healthUrl = "http://127.0.0.1:4003/health"
$apiReady = $false

Write-Host "Iniciando API (nueva ventana)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev:api"

for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 1
    if ($response.StatusCode -eq 200) {
      $apiReady = $true
      break
    }
  } catch {
    # esperando API
  }
}

if ($apiReady) {
  Write-Host "API lista en http://localhost:4003" -ForegroundColor Green
} else {
  Write-Host "API no respondio a tiempo en http://localhost:4003/health." -ForegroundColor DarkYellow
  Write-Host "Revisa la ventana de API para ver el error." -ForegroundColor DarkYellow
}

Write-Host "Iniciando Web (nueva ventana)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev:web:lan"

Write-Host ""
Write-Host "Listo. Ventanas abiertas:" -ForegroundColor Cyan
Write-Host "1) API"
Write-Host "2) Web"
Write-Host ""
Write-Host "Utiles:"
Write-Host "- Health API: http://localhost:4003/health"
Write-Host "- Mailpit: http://localhost:8025"
Write-Host "- Apagar infra: npm run infra:down"
