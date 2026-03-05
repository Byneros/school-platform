# Aprovisionamiento en Lote (varios colegios)

Este flujo ejecuta `bootstrap-school-server.sh` por cada colegio definido en un JSON.

## Archivos

- Script: `scripts/bootstrap-multi-schools.mjs`
- Config operativa: `infra/bootstrap/schools-batch.json`
- Config ejemplo: `infra/bootstrap/schools-batch.example.json`

## Formato JSON

```json
{
  "defaults": {
    "repoUrl": "https://github.com/tu-org/school-platform.git",
    "branch": "main",
    "repoDir": "/opt/school-platform",
    "webPortStart": 8081
  },
  "schools": [
    {
      "collegeCode": "colegio-a",
      "domain": "colegio-a.tudominio.com",
      "email": "admin@tudominio.com",
      "schoolName": "Colegio A"
    }
  ]
}
```

Campos obligatorios por colegio:

- `collegeCode`
- `domain`
- `email`
- `schoolName`

Opcionales por colegio:

- `webPort` (si no está, usa `webPortStart + indice`)
- `repoUrl`, `branch`, `repoDir` (hereda de `defaults` si existe)

## Ejecución

Plan (sin ejecutar cambios):

```bash
npm run bootstrap:multi:plan
```

Ejecución real:

```bash
npm run bootstrap:multi:run
```

Antes de ejecutar, edita `infra/bootstrap/schools-batch.json` con tus dominios reales.

Con archivo custom:

```bash
node scripts/bootstrap-multi-schools.mjs --config /ruta/mi-batch.json --execute
```

## Comportamiento

1. Valida duplicados (`collegeCode`, `domain`, `webPort`).
2. Ejecuta un colegio a la vez.
3. Por defecto se detiene en el primer error.
4. Opción para continuar en errores:

```bash
node scripts/bootstrap-multi-schools.mjs --config /ruta/mi-batch.json --execute --no-stop-on-error
```

## Requisito operativo

Está diseñado para ejecutarse en Linux con `sudo`, porque internamente llama:

`sudo bash scripts/bootstrap-school-server.sh ...`
