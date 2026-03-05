#!/usr/bin/env bash
set -euo pipefail

# Uso:
#   ./scripts/certbot-renew-and-reload.sh /opt/school-platform
# Si no se pasa ruta, usa la carpeta actual.

PROJECT_DIR="${1:-$(pwd)}"

cd "$PROJECT_DIR"

echo "[ssl] Ejecutando renovacion certbot..."
node ./scripts/certbot-multi.mjs --mode renew --execute

echo "[ssl] Validando nginx config..."
nginx -t

echo "[ssl] Recargando nginx..."
systemctl reload nginx

echo "[ssl] Renovacion y recarga completadas."

