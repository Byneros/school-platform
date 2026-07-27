# Release Notes - v1.0.0

Fecha: 2026-02-27

## Resumen

Se estabiliza la plataforma escolar con modelo academico centrado en `grado/grupo`, flujo completo de admision-matricula, asistencia por franja valida, exportes PDF y verificacion preproduccion automatizada.

## Cambios principales

- Migracion completa de `Course` a `Grade`:
  - Eliminado `Course` del dominio activo.
  - Eliminado `Class.courseId`.
  - `Class` opera con `gradeLevel`.
- API alineada a `gradeLevel/gradeName` sin dependencia funcional de `course`.
- Frontend alineado a grado/grupo en consultas y listados.
- Asistencia por grado con filtros por `grado`, `grupo`, `fecha`, `estado`.
- Restricciones por rol:
  - Admin ve asistencia global.
  - Docente ve su propia asistencia.
- Exportes:
  - Horario docente PDF.
  - Horario estudiantes PDF.
  - Matriculas PDF.
- Herramientas operativas:
  - `npm run preprod:verify` para migracion, build y regresion API.
  - `docs/functional-checklist.md` para QA manual final.

## Migraciones aplicadas

- `20260226193000_class_gradelevel_phase1`
- `20260226224500_drop_course_phase2`

## Verificaciones ejecutadas

- Build API: OK
- Build Web: OK
- Regression API: OK
- Seed demo: OK

## Notas operativas

- En Windows puede aparecer bloqueo temporal de `prisma generate` por `query_engine` (`EPERM`) si hay procesos Node activos.
- Mitigacion: cerrar procesos Node del proyecto y reintentar.

## Impacto para usuarios

- No hay cambios de uso negativos en funcionalidades clave.
- Mejora en consistencia de datos y simplificacion del modelo academico.
