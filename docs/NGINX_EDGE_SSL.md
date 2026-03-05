# Nginx de Borde con SSL (subdominios por colegio)

Este documento permite publicar varios colegios en un mismo servidor con HTTPS:

- `colegio-a.tudominio.com` -> `localhost:8081`
- `colegio-b.tudominio.com` -> `localhost:8082`

## 1. Prerrequisitos
1. DNS apuntando al servidor:
   - `A colegio-a.tudominio.com -> <IP_PUBLICA>`
   - `A colegio-b.tudominio.com -> <IP_PUBLICA>`
2. Nginx instalado en el host (no dentro de docker).
3. Certbot instalado en el host.
4. Cada colegio desplegado con puerto distinto (`WEB_PORT`) usando `deploy-prod.ps1`.

## 2. Copiar configuracion base
1. Copia `infra/nginx/edge/nginx.conf` a `/etc/nginx/nginx.conf` (si deseas reemplazar base).
2. Define tu mapeo dominio/puerto en `infra/nginx/edge/schools-map.example.json`.
3. Genera el archivo final:

```bash
npm run nginx:generate:multi
```

4. Copia `infra/nginx/edge/school-multi.conf` a `/etc/nginx/conf.d/school-multi.conf`.

## 3. Obtener certificados SSL
Automatizado desde el mapping:

```bash
sudo mkdir -p /var/www/certbot

# 1) Ver plan (sin ejecutar)
npm run certbot:multi:plan

# 2) Emitir certificados (ejecuta certbot por cada dominio del mapping)
# Cambia el email por uno real:
node ./scripts/certbot-multi.mjs --mode issue --email admin@tudominio.com --execute
```

Luego verifica rutas:
- `/etc/letsencrypt/live/colegio-a.tudominio.com/fullchain.pem`
- `/etc/letsencrypt/live/colegio-a.tudominio.com/privkey.pem`

## 4. Validar y recargar Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Renovacion automatica
Prueba de renovacion:

```bash
npm run certbot:multi:renew:dryrun
```

Renovacion real manual:

```bash
npm run certbot:multi:renew
```

Automatizacion con systemd (recomendada):

```bash
sudo chmod +x /opt/school-platform/scripts/certbot-renew-and-reload.sh
sudo cp /opt/school-platform/infra/systemd/school-certbot-renew.service /etc/systemd/system/
sudo cp /opt/school-platform/infra/systemd/school-certbot-renew.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now school-certbot-renew.timer
sudo systemctl list-timers | grep school-certbot-renew
```

Ejecucion inmediata de prueba del servicio:

```bash
sudo systemctl start school-certbot-renew.service
sudo journalctl -u school-certbot-renew.service -n 100 --no-pager
```

## 6. Prueba final por colegio
1. `https://colegio-a.tudominio.com/`
2. `https://colegio-b.tudominio.com/`
3. Revisar `https://colegio-a.tudominio.com/health` (debe responder health de API).

## 7. Recomendaciones de operacion
1. Mantener una tabla de mapeo:
   - subdominio
   - `WEB_PORT`
   - archivo `.env.production.<colegio>`
2. Mantener en Git el archivo `infra/nginx/edge/schools-map.example.json` como fuente de verdad y regenerar `school-multi.conf` en cada cambio.
3. Reservar rangos de puertos por servidor (ej. 8081-8099).
4. Si escalas a varios servidores, coloca un balanceador delante y replica este esquema.
