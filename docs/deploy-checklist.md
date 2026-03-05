# Checklist de Despliegue a Produccion

## 1. Pre-requisitos
- Servidor con Node.js LTS instalado.
- PostgreSQL disponible y accesible.
- Variables de entorno de produccion definidas.
- Acceso a backups.

## 2. Variables de entorno (minimas)
En `apps/api/.env`:
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET` (fuerte, no por defecto)
- `REDIS_URL` (si aplica cola/notificaciones)

## 3. Respaldo antes de desplegar
Desde la raiz del proyecto:
- `npm run db:backup`

## 4. Actualizacion de base de datos
- `npm run prisma:migrate:deploy`
- `npm run prisma:generate`

Si `prisma:generate` falla por `EPERM` en Windows:
- detener procesos `node.exe` del proyecto,
- volver a ejecutar `npm run prisma:generate`.

## 5. Build de artefactos
- `npm --workspace apps/api run build`
- `npm --workspace apps/web run build`

## 6. Verificacion preproduccion
- `npm run preprod:verify`
- Confirmar salida: `Verificacion completa OK`.

## 7. Arranque de servicios
- API:
  - `npm run start:api`
- Web:
  - servir `apps/web/dist` con servidor web (Nginx/Apache/servicio Node).

## 8. Smoke test post-deploy
- `GET /health` responde `ok=true`.
- Login de `ADMIN`, `TEACHER`, `PARENT`.
- Flujo: admision -> matricula.
- Asistencia por grado/grupo.
- Exportes PDF.

## 9. Plan de rollback
- Restaurar backup:
  - `npm run db:restore -- --file <ruta-backup.sql>`
- Revertir artefactos a version anterior estable.

## 10. Cierre de release
- Crear tag de version (`v1.0.0`).
- Registrar evidencia de pruebas.
- Compartir `docs/release-notes.md`.

