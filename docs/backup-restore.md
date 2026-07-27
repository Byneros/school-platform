# Backup y Restore de Base de Datos

Este proyecto incluye scripts para respaldo y recuperacion de PostgreSQL sobre el contenedor `db` del `docker-compose` de `infra/`.

## Requisitos

- Docker corriendo
- Infra levantada: `npm run infra:up`

## Backup manual

```bash
npm run db:backup
```

Genera un archivo SQL en `backups/` con nombre:

- `school-platform-backup-YYYYMMDD-HHMMSS.sql`

Retencion por defecto:

- 14 dias (elimina backups mas antiguos automaticamente)

Opciones:

```bash
npm run db:backup -- --output-dir ./backups --retention-days 14
npm run db:backup -- --db-user postgres --db-name school_platform
npm run db:backup -- --container <container-id>
npm run db:backup -- --dry-run
```

Variables opcionales:

- `BACKUP_RETENTION_DAYS`
- `DB_USER`
- `DB_NAME`
- `DB_CONTAINER`

## Restore (ultimo backup)

```bash
npm run db:restore
```

## Restore (archivo especifico)

```bash
npm run db:restore -- --file ./backups/school-platform-backup-20260225-120000.sql
```

Opciones:

```bash
npm run db:restore -- --backup-dir ./backups
npm run db:restore -- --db-user postgres --db-name school_platform
npm run db:restore -- --container <container-id>
npm run db:restore -- --dry-run
```

## Recomendacion operativa

1. Ejecutar backup diario (task scheduler/cron o pipeline programado).
2. Probar restore al menos 1 vez por semana en entorno de pruebas.
3. Mantener copia externa de backups criticos (almacenamiento fuera de la maquina local).
