# Checklist de Despliegue (1 o varios colegios)

## 1. Preparacion del servidor
1. Instalar Docker y Docker Compose plugin.
2. Abrir puertos requeridos (80/443 y el `WEB_PORT` si aplica).
3. Clonar el repositorio en ruta estable, por ejemplo: `/opt/school-platform`.
4. Si quieres aprovisionamiento automatico del servidor, usa `docs/BOOTSTRAP_SERVER.md`.
5. Si quieres aprovisionar varios colegios en lote, usa `docs/BOOTSTRAP_MULTI_SCHOOLS.md`.

## 2. Variables de entorno por colegio
1. Copiar `infra/.env.production.example` a un archivo real:
   - `infra/.env.production.colegio-a`
2. Ajustar como minimo:
   - `SCHOOL_NAME`
   - `WEB_PORT`
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`
3. Repetir para cada colegio con puertos y secretos diferentes.

## 3. Despliegue por colegio
Comando base (Windows PowerShell):

```powershell
.\scripts\deploy-prod.ps1 -CollegeCode colegio-a -EnvFile infra/.env.production.colegio-a
```

Comando para desplegar sin rebuild:

```powershell
.\scripts\deploy-prod.ps1 -CollegeCode colegio-a -EnvFile infra/.env.production.colegio-a -SkipBuild
```

## 4. Verificacion inmediata
1. `docker compose -p school-colegio-a --env-file infra/.env.production.colegio-a -f infra/docker-compose.prod.yml ps`
2. Abrir `http://<ip-servidor>:<WEB_PORT>`.
3. Probar login admin y endpoint health:
   - `http://<ip-servidor>:<WEB_PORT>/health`

## 5. SSL y dominio (recomendado)
1. Publicar cada colegio en subdominio:
   - `colegio-a.tudominio.com`
   - `colegio-b.tudominio.com`
2. Poner un reverse proxy de borde (Nginx/Caddy/Traefik) con HTTPS.
3. Redirigir 80 -> 443.
4. Usa la guia y plantilla en `docs/NGINX_EDGE_SSL.md`.
5. Genera el conf multi-colegio desde mapping:

```powershell
npm run nginx:generate:multi
```
6. Emite certificados SSL desde el mismo mapping:

```bash
node ./scripts/certbot-multi.mjs --mode issue --email admin@tudominio.com --execute
```
7. Activa renovacion automatica + recarga de Nginx con `systemd` (plantillas en `infra/systemd/`).

## 6. Backups y recuperacion
1. Programar backup diario de BD:
   - `npm run db:backup`
2. Guardar backups fuera del servidor (S3/NAS).
3. Probar restauracion al menos 1 vez por semana:
   - `npm run db:restore`

## 7. Operacion continua
1. Monitorear contenedores (`docker stats`, `docker compose ps`).
2. Revisar logs:
   - `docker compose ... logs -f api`
   - `docker compose ... logs -f web`
3. Definir ventana de mantenimiento para upgrades.

## 8. Multi-servidor (escalado)
1. Repetir despliegue en servidores adicionales.
2. Balancear trafico con LB externo (Nginx/HAProxy/Cloud LB).
3. Mantener datos por colegio aislados (BD por proyecto Docker).

## 9. Nota tecnica importante
Actualmente algunas configuraciones se guardan en `apps/api/.runtime` (volumen `api_runtime`).
En despliegues multi-servidor reales conviene mover esa configuracion a base de datos o storage central para consistencia entre nodos.
