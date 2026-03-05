param(
  [Parameter(Mandatory = $true)]
  [string]$CollegeCode,

  [string]$EnvFile = "infra/.env.production",
  [string]$ComposeFile = "infra/docker-compose.prod.yml",
  [string]$ProjectPrefix = "school",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Assert-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Comando no encontrado: $name"
  }
}

Write-Host "==> Validando prerequisitos..."
Assert-Command "docker"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not (Test-Path $EnvFile)) {
  throw "No existe archivo de entorno: $EnvFile"
}
if (-not (Test-Path $ComposeFile)) {
  throw "No existe archivo compose: $ComposeFile"
}

$projectName = "$ProjectPrefix-$CollegeCode".ToLower()
Write-Host "==> Proyecto Docker: $projectName"
Write-Host "==> Env file: $EnvFile"
Write-Host "==> Compose: $ComposeFile"

$upArgs = @("compose", "-p", $projectName, "--env-file", $EnvFile, "-f", $ComposeFile, "up", "-d")
if (-not $SkipBuild) {
  $upArgs += "--build"
}

Write-Host "==> Levantando contenedores..."
docker @upArgs

Write-Host "==> Ejecutando migraciones..."
docker compose -p $projectName --env-file $EnvFile -f $ComposeFile exec -T api npm --workspace apps/api run prisma:migrate:deploy

Write-Host "==> Ejecutando backfills..."
docker compose -p $projectName --env-file $EnvFile -f $ComposeFile exec -T api npm --workspace apps/api run prisma:backfill

Write-Host "==> Reiniciando API para aplicar cambios..."
docker compose -p $projectName --env-file $EnvFile -f $ComposeFile restart api

Write-Host "==> Estado final:"
docker compose -p $projectName --env-file $EnvFile -f $ComposeFile ps

Write-Host ""
Write-Host "Despliegue completado para colegio '$CollegeCode'."
Write-Host "Si WEB_PORT=8080, prueba: http://localhost:8080"
