# Checklist de Despliegue a Produccion

## 1. Pre-requisitos

- Node.js LTS.
- PostgreSQL accesible.
- Redis accesible si se usan cache/colas distribuidas.
- Variables de entorno de produccion definidas.
- Backups disponibles y restauracion probada.

## 2. Variables minimas del API

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `REFRESH_TOKEN_PEPPER`
- `CORS_ORIGINS`
- `TRUST_PROXY=true`

Si 2FA/email esta activo:

- `ADMIN_2FA_ENABLED=true`
- `TWO_FACTOR_ROLES`
- `ADMIN_2FA_CODE_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## 3. Respaldo antes de desplegar

```powershell
npm run db:backup
```

## 4. Migraciones y build

```powershell
npm run prisma:migrate:deploy
npm run verify
```

Si `prisma generate` falla por `EPERM` en Windows, detener procesos `node.exe` del proyecto y volver a ejecutar `npm run verify`.

## 5. Datos QA opcionales

Para validar regression tests con datos suficientes:

```powershell
npm run prisma:seed:qa
```

## 6. Verificacion preproduccion

```powershell
npm run preprod:verify
```

Para solo validacion tecnica sin levantar API:

```powershell
npm run preprod:verify -- --skip-live
```

## 7. Arranque de servicios

API:

```powershell
npm run start:api
```

Web:

- Servir `apps/web/dist` con Nginx, Apache, Render Static Site u otro servidor estatico.

## 8. Smoke post-deploy

```powershell
$env:API_HEALTH_URL="https://<api-url>/ready"
npm run ready
$env:TEST_API_URL="https://<api-url>"
npm --workspace apps/api run test
npm --workspace apps/api run test:regression
```

Validar manualmente:

- Login de `ADMIN`, `TEACHER`, `PARENT`.
- Flujo admision -> matricula.
- Importar plantilla Excel.
- Vinculo estudiante/acudiente.
- Asistencia por grado/grupo.
- Exportes PDF/XLSX.

## 9. Auditoria

```powershell
npm audit --omit=dev
```

Pendiente conocido:

- React Router puede reportar GHSA-qwww-vcr4-c8h2. La app usa SPA con `BrowserRouter`, no RSC/SSR actions. Riesgo documentado en `docs/audit/RISK_REGISTER.md`.

## 10. Rollback

```powershell
npm run db:restore -- --file <ruta-backup.sql>
```

Despues del rollback:

- Validar `/ready`.
- Ejecutar smoke/regression.
- Registrar evidencia en release notes.
