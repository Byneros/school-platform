# Course -> Grade Migration (Finalizado)

## Estado actual

El sistema ya opera en modo `grade-only`.

- `Class` ya no depende de `Course`.
- `Class.courseId` fue eliminado.
- La tabla `Course` fue eliminada.
- API y frontend consumen `gradeLevel`/`gradeName`.

## Migraciones aplicadas

1. `apps/api/prisma/migrations/20260226193000_class_gradelevel_phase1/migration.sql`
2. `apps/api/prisma/migrations/20260226224500_drop_course_phase2/migration.sql`

## Runbook operativo actual

1. Migrar base de datos:
   - `npm --workspace apps/api run prisma:migrate:deploy`
2. Regenerar cliente Prisma:
   - `npm --workspace apps/api run prisma:generate`
3. Backfills de soporte:
   - `npm --workspace apps/api run prisma:backfill`
4. Verificar compilacion:
   - `npm --workspace apps/api run build`
   - `npm --workspace apps/web run build`
5. Verificar regresion API:
   - `TEST_API_URL=http://localhost:4001 npm --workspace apps/api run test:regression`

## Scripts relevantes

- `apps/api/prisma/backfillTeacherSchedules.ts`: asegura horarios base para docentes sin franja.
- `apps/api/prisma/backfillSubjectHoursMode.ts`: normaliza modo de horas por asignatura.
- `apps/api/prisma/backfillClassGradeLevel.ts`: rellena `Class.gradeLevel` nulo en datos legacy.

## Nota de mantenimiento

No reintroducir `Course` ni `courseId` en schema, rutas o contratos de frontend.
