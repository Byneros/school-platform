# Despliegue gratuito en Render (API + Web + Postgres)

Este proyecto puede desplegarse en Render Free con un Blueprint desde `render.yaml`.
Ten presente que Render Free duerme servicios sin trafico y la base Postgres Free tiene limites de retencion.

## 1. Preflight local

Desde la raiz del proyecto:

```powershell
npm run verify
$env:TEST_API_URL="http://127.0.0.1:4003"
npm --workspace apps/api run test
npm --workspace apps/api run test:regression
```

Si regression necesita datos QA:

```powershell
npm --workspace apps/api run prisma:seed:qa
```

## 2. Crear Blueprint

1. Sube el repositorio a GitHub/GitLab/Bitbucket.
2. En Render Dashboard abre **Blueprints**.
3. Selecciona el repositorio con `render.yaml`.
4. Render creara:
   - `school-api` como Web Service Node.
   - `school-web` como Static Site.
   - `school-db` como PostgreSQL.

## 3. Comandos configurados

API:

- Build: `npm ci && npm run render:api:build`
- Start: `npm run render:api:start`
- Health check: `/ready`

Web:

- Build: `npm ci && npm run render:web:build`
- Publish path: `apps/web/dist`

En plan Free, Render no ofrece `preDeployCommand`; por eso `render:api:start` ejecuta `prisma:migrate:deploy` antes de iniciar la API.

## 4. Variables obligatorias del API

Render inyecta:

- `DATABASE_URL` desde `school-db`.
- `JWT_SECRET` con `generateValue`.

Revisar y completar manualmente:

- `CORS_ORIGINS`: URL publica del frontend.
- `REFRESH_TOKEN_PEPPER`: secreto fuerte.
- `REDIS_URL`: URL Redis si se usan colas/cache distribuidos.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: necesarios si 2FA/email esta activo.
- `CACHE_METRICS_TOKEN`, `RATE_LIMIT_METRICS_TOKEN`: secretos para endpoints operativos.

Si no hay SMTP listo, usar temporalmente:

```text
ADMIN_2FA_ENABLED=false
EMAIL_WORKER_ENABLED=false
NOTIFICATION_WORKER_ENABLED=false
```

## 5. Variables del Web

- `VITE_API_URL`: URL publica del API con `/api`.

Ejemplo:

```text
https://school-api.onrender.com/api
```

## 6. Verificacion post-deploy

API:

```powershell
$env:API_HEALTH_URL="https://<api-render-url>/ready"
npm run ready
```

Web:

1. Abrir la URL publica del static site.
2. Iniciar sesion con usuario admin sembrado o creado.
3. Probar:
   - Login.
   - Usuarios.
   - Matriculas.
   - Importar plantilla Excel.
   - Reportes PDF/XLSX.
   - Asistencia docente.

## 7. Smoke/regression contra Render

```powershell
$env:TEST_API_URL="https://<api-render-url>"
npm --workspace apps/api run test
npm --workspace apps/api run test:regression
```

## 8. Auditoria de dependencias

`xlsx` fue retirado y reemplazado por `read-excel-file` / `write-excel-file`.

Pendiente conocido:

- `npm audit --omit=dev` puede reportar `react-router` por GHSA-qwww-vcr4-c8h2.
- La app actual usa SPA con `BrowserRouter`, no RSC/SSR actions.
- El riesgo esta registrado en `docs/audit/RISK_REGISTER.md`.
- Revalidar cuando exista una version instalable fuera del rango vulnerable.

## 9. Rollback

1. Revertir commit/tag en Render.
2. Si hubo migraciones destructivas, restaurar backup de BD.
3. Validar `/ready` y smoke tests.
