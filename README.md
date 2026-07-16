# School Platform

Plataforma web de gestion escolar moderna, segura y escalable. Arquitectura cliente-servidor con API REST, control de acceso por roles y base de datos relacional.

## Stack

- Frontend: React + Vite + TypeScript (responsive, mobile-first)
- Backend: Node.js + Express + TypeScript
- DB: PostgreSQL + Prisma

## Estructura

- `apps/web`: interfaz web por roles
- `apps/api`: API REST y logica de negocio
- `packages/shared`: tipos compartidos
- `infra`: configuraciones de infraestructura (docker, etc.)

## Inicio rapido

1. Crear base de datos PostgreSQL y configurar variables de entorno:
   - `apps/api/.env` basado en `apps/api/.env.example`
   - `apps/web/.env` basado en `apps/web/.env.example`
2. Instalar dependencias:
   - `npm install`
3. Generar cliente Prisma y migrar:
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
   - Produccion/entornos compartidos: `npm run prisma:migrate:full` (aplica migraciones + backfills idempotentes)
4. Semillas demo:
   - `npm run prisma:seed`
5. Ejecutar en desarrollo:
   - `npm run dev:api`
   - `npm run dev:web`
6. Pruebas smoke API (requiere API activa):
   - `npm run test:api`
   - opcional si la API no usa el puerto por defecto: `TEST_API_URL=http://127.0.0.1:4001 npm run test:api`
7. Pruebas de regresion API por modulos criticos (requiere API activa + usuarios demo):
   - `npm run test:api:regression`
   - opcional:
     - `TEST_API_URL=http://127.0.0.1:4001`
     - `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`
     - `TEST_TEACHER_EMAIL`, `TEST_TEACHER_PASSWORD`
     - `TEST_PARENT_EMAIL`, `TEST_PARENT_PASSWORD`

## Roles

- Administrador: control total, gestiona usuarios/roles, autoriza notificaciones.
- Docente: asistencia, calificaciones, tareas y mensajes (sujeto a aprobacion).
- Padre de familia: consulta de notas, asistencia y estado financiero; recibe notificaciones autorizadas.

## Flujo de autorizacion de notificaciones (resumen)

1. Docente crea notificacion `PENDING`.
2. Administrador aprueba (cambia a `APPROVED`).
3. Sistema marca `SENT` y entrega a padres relacionados.

## Validaciones

Se implemento validacion con Zod en endpoints clave (login, estudiantes, asistencia, notas y notificaciones).
Los errores de validacion responden con HTTP 400 y detalle de `issues`.

## Endpoints principales (resumen)

- `POST /api/auth/login`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `GET /api/students`
- `POST /api/attendance`
- `POST /api/grades`
- `POST /api/notifications`
- `GET /api/notifications`
- `POST /api/notifications/:id/approve`
- `GET /api/payments`
- `POST /api/payments`
- `GET /api/invoices`
- `POST /api/invoices`
- `GET /api/admissions`
- `POST /api/admissions`
- `PATCH /api/admissions/:id/status`
- `GET /api/enrollments`
- `POST /api/enrollments`
- `GET /api/classes/simple`
- `GET /api/teacher/students`
- `GET /api/teacher/enrollments`
- `GET /api/teacher/attendance`
- `GET /api/teacher/grades`
- `GET /api/teacher/notifications`
- `GET /api/parent/children`
- `GET /api/parent/boletines`
- `GET /api/parent/invoices`
- `GET /api/parent/notifications`
- Teacher/Parent endpoints now support optional filters: `status`, `period`, `page`, `pageSize`
- `GET /api/reports/grades-summary`
- `GET /api/reports/attendance-summary`
- `GET /api/reports/finance-summary`
- `GET /api/reports/report-card/:studentId`
- `GET /api/reports/finance-csv`
- `GET /api/reports/finance-pdf`

## Notificaciones con cola

Cuando un administrador aprueba una notificacion, se encola un trabajo en Redis/BullMQ para enviar la notificacion y marcarla como `SENT`.
Si la notificacion tiene `studentId`, se envia solo a los padres relacionados con ese estudiante; si no, se envia a todos.

## Observabilidad basica

- `GET /health`: estado basico del proceso API.
- `GET /ready`: disponibilidad de dependencias (`db` y `redis`).
- Logs estructurados JSON por solicitud con `requestId` (tambien en header `X-Request-Id`).

## Seguridad adicional

Los padres solo pueden descargar boletines de estudiantes asociados a su cuenta (guardianes).
Se incluye rate limiting global y especifico para login, CORS por allowlist (`CORS_ORIGINS`) y renovacion de sesion por `POST /api/auth/refresh`.

## Boletines PDF

El endpoint `GET /api/reports/report-card/:studentId` genera un PDF basico con las calificaciones del estudiante.

## Exportacion financiera

Reportes financieros disponibles en CSV y PDF para administradores.

Ver detalles en `apps/api/src/routes`.

## Backup y recuperacion

- Backup DB: `npm run db:backup`
- Restore DB (ultimo backup): `npm run db:restore`
- Restore DB (archivo): `npm run db:restore -- --file <ruta-backup.sql>`
- Guia completa: `docs/backup-restore.md`
