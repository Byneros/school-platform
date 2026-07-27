# Bootstrap de Servidor Nuevo (1 comando)

Este flujo prepara un servidor Ubuntu/Debian para un colegio desde cero:

- instala Docker + Compose plugin
- instala Nginx + Certbot
- instala Node/npm (para scripts operativos)
- despliega el stack del colegio
- configura dominio SSL
- activa renovacion automatica con `systemd`

## Script

`scripts/bootstrap-school-server.sh`

## Requisitos previos

1. Servidor Ubuntu/Debian con acceso `sudo`.
2. DNS `A` del subdominio apuntando al servidor.
3. Repositorio Git accesible desde el servidor.

## Ejecucion

```bash
sudo bash scripts/bootstrap-school-server.sh \
  --college-code colegio-a \
  --domain colegio-a.tudominio.com \
  --email admin@tudominio.com \
  --school-name "Colegio A" \
  --web-port 8081 \
  --repo-url https://github.com/tu-org/school-platform.git
```

## Resultado esperado

1. Colegio desplegado en Docker (`project: school-colegio-a`).
2. SSL emitido para `colegio-a.tudominio.com`.
3. Nginx activo sirviendo el dominio por HTTPS.
4. Renovacion automatica activa:
   - `school-certbot-renew.timer`
   - `school-certbot-renew.service`

## Verificacion

```bash
sudo systemctl status school-certbot-renew.timer --no-pager
sudo systemctl list-timers | grep school-certbot-renew
sudo docker compose -p school-colegio-a --env-file /opt/school-platform/infra/.env.production.colegio-a -f /opt/school-platform/infra/docker-compose.prod.yml ps
```

## Nota

El script genera secretos (`JWT_SECRET`, `POSTGRES_PASSWORD`) automaticamente y crea/actualiza:

- `infra/.env.production.<college-code>`
- `infra/nginx/edge/schools-map.example.json`
