param(
  [int]$Port = 5173,
  [string]$ApiTarget = ""
)

$ErrorActionPreference = "Stop"

if (-not $ApiTarget) {
  $apiEnv = Join-Path $PSScriptRoot "..\\apps\\api\\.env"
  $apiPort = 4002

  if (Test-Path $apiEnv) {
    $portLine = Get-Content $apiEnv | Where-Object { $_ -match "^\s*PORT\s*=" } | Select-Object -First 1
    if ($portLine) {
      $value = ($portLine -split "=", 2)[1].Trim().Trim('"')
      $parsed = 0
      if ([int]::TryParse($value, [ref]$parsed)) {
        $apiPort = $parsed
      }
    }
  }

  $ApiTarget = "http://localhost:$apiPort"
}

$env:VITE_DEV_API_PROXY_TARGET = $ApiTarget

function Get-FreePort([int]$startPort) {
  for ($p = $startPort; $p -lt ($startPort + 50); $p++) {
    $inUse = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if (-not $inUse) {
      return $p
    }
  }
  throw "No se encontro puerto libre en el rango $startPort-$($startPort + 49)."
}

$selectedPort = Get-FreePort $Port

Write-Host "==> Frontend LAN dev"
Write-Host "VITE_DEV_API_PROXY_TARGET=$($env:VITE_DEV_API_PROXY_TARGET)"
Write-Host "Port solicitado=$Port"
Write-Host "Port en uso=$selectedPort"

npm --workspace apps/web run dev -- --host=0.0.0.0 --port=$selectedPort
