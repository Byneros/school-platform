#!/usr/bin/env bash
set -euo pipefail

# Bootstrap completo de servidor Ubuntu/Debian para 1 colegio:
# - instala Docker, Nginx, Certbot, Node/npm
# - despliega stack del colegio
# - actualiza mapping de dominios
# - genera config Nginx multi-colegio
# - emite SSL y activa renovacion automatica + reload nginx
#
# Ejemplo:
# sudo bash scripts/bootstrap-school-server.sh \
#   --college-code colegio-a \
#   --domain colegio-a.tudominio.com \
#   --email admin@tudominio.com \
#   --school-name "Colegio A" \
#   --web-port 8081 \
#   --repo-url https://github.com/tu-org/school-platform.git

COLLEGE_CODE=""
DOMAIN=""
EMAIL=""
SCHOOL_NAME=""
WEB_PORT="8081"
REPO_URL=""
BRANCH="main"
REPO_DIR="/opt/school-platform"
MAP_FILE="infra/nginx/edge/schools-map.example.json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --college-code) COLLEGE_CODE="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --school-name) SCHOOL_NAME="$2"; shift 2 ;;
    --web-port) WEB_PORT="$2"; shift 2 ;;
    --repo-url) REPO_URL="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --repo-dir) REPO_DIR="$2"; shift 2 ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Argumento no reconocido: $1" >&2
      exit 1
      ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Este script debe ejecutarse con sudo/root." >&2
  exit 1
fi

if [[ -z "$COLLEGE_CODE" || -z "$DOMAIN" || -z "$EMAIL" || -z "$SCHOOL_NAME" || -z "$REPO_URL" ]]; then
  echo "Faltan argumentos obligatorios." >&2
  echo "Usa --help para ver el formato." >&2
  exit 1
fi

if ! [[ "$WEB_PORT" =~ ^[0-9]+$ ]] || (( WEB_PORT < 1 || WEB_PORT > 65535 )); then
  echo "WEB_PORT invalido: $WEB_PORT" >&2
  exit 1
fi

log() { echo "[bootstrap] $*"; }

log "Instalando paquetes base..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  ca-certificates curl gnupg lsb-release software-properties-common \
  git jq nginx certbot python3-certbot-nginx \
  docker.io docker-compose-plugin \
  nodejs npm openssl

systemctl enable --now docker
systemctl enable --now nginx

if [[ ! -d "$REPO_DIR/.git" ]]; then
  log "Clonando repositorio en $REPO_DIR..."
  rm -rf "$REPO_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
  log "Repositorio existente en $REPO_DIR. Actualizando..."
  git -C "$REPO_DIR" fetch --all --prune
  git -C "$REPO_DIR" checkout "$BRANCH"
  git -C "$REPO_DIR" pull --ff-only origin "$BRANCH"
fi

cd "$REPO_DIR"

ENV_FILE="infra/.env.production.${COLLEGE_CODE}"
PROJECT_NAME="school-${COLLEGE_CODE}"
POSTGRES_PASSWORD="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"
POSTGRES_DB="school_${COLLEGE_CODE//-/_}"

log "Generando env de produccion: $ENV_FILE"
cat > "$ENV_FILE" <<EOF
SCHOOL_NAME=$SCHOOL_NAME
WEB_PORT=$WEB_PORT
VITE_API_URL=/api
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=8h
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB
EOF

log "Levantando stack docker del colegio..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f infra/docker-compose.prod.yml up -d --build

log "Aplicando migraciones Prisma..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f infra/docker-compose.prod.yml exec -T api npm --workspace apps/api run prisma:migrate:deploy

log "Ejecutando backfills..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f infra/docker-compose.prod.yml exec -T api npm --workspace apps/api run prisma:backfill

log "Reiniciando API..."
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f infra/docker-compose.prod.yml restart api

log "Actualizando mapping de dominios..."
MAP_PATH="$REPO_DIR/$MAP_FILE"
mkdir -p "$(dirname "$MAP_PATH")"
if [[ ! -f "$MAP_PATH" ]]; then
  echo "[]" > "$MAP_PATH"
fi

node - "$MAP_PATH" "$COLLEGE_CODE" "$DOMAIN" "$WEB_PORT" <<'NODE'
const fs = require("fs");
const [mapPath, collegeCode, domain, webPortRaw] = process.argv.slice(2);
const webPort = Number(webPortRaw);
const raw = fs.readFileSync(mapPath, "utf8");
const parsed = JSON.parse(raw || "[]");
const list = Array.isArray(parsed) ? parsed : [parsed];
const next = list.filter((x) => x && x.domain !== domain && x.collegeCode !== collegeCode);
next.push({ collegeCode, domain, webPort });
next.sort((a, b) => String(a.collegeCode).localeCompare(String(b.collegeCode)));
fs.writeFileSync(mapPath, JSON.stringify(next, null, 2) + "\n");
NODE

log "Generando school-multi.conf..."
npm run nginx:generate:multi

log "Publicando config nginx..."
cp infra/nginx/edge/school-multi.conf /etc/nginx/conf.d/school-multi.conf
mkdir -p /var/www/certbot
nginx -t
systemctl reload nginx

log "Emitiendo certificado SSL para $DOMAIN..."
certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL"

nginx -t
systemctl reload nginx

log "Activando renovacion automatica + reload nginx..."
chmod +x scripts/certbot-renew-and-reload.sh
cp infra/systemd/school-certbot-renew.service /etc/systemd/system/
cp infra/systemd/school-certbot-renew.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now school-certbot-renew.timer

log "Despliegue finalizado."
log "App: https://$DOMAIN"
log "Health: https://$DOMAIN/health"
log "Env del colegio: $ENV_FILE"
log "Proyecto docker: $PROJECT_NAME"

