# Operacion con PM2

## 1. Construir antes de iniciar
- `npm --workspace apps/api run build`
- `npm --workspace apps/web run build`

## 2. Iniciar procesos
- `npm run pm2:start`

Procesos gestionados:
- `school-api` (API Express en puerto `4001` por defecto)
- `school-web` (Vite preview en puerto `4173`)

## 3. Operacion diaria
- Estado: `npm run pm2:status`
- Logs: `npm run pm2:logs`
- Reiniciar: `npm run pm2:restart`
- Detener: `npm run pm2:stop`
- Eliminar procesos: `npm run pm2:delete`

## 4. Persistencia al reinicio del servidor
- Guardar estado actual PM2: `npm run pm2:save`
- Configurar startup: `npm run pm2:startup`

PM2 mostrara un comando adicional que debes ejecutar con permisos de administrador para completar el startup.

## 5. Health check rapido
- `npm run ops:health`

Por defecto valida:
- `http://localhost:4001/health`

Para otra URL:
- PowerShell: `$env:API_HEALTH_URL='http://<host>:<port>/health'; npm run ops:health`

## 6. Flujo recomendado de despliegue
1. `npm run preprod:verify`
2. `npm run pm2:start`
3. `npm run pm2:save`
4. `npm run ops:health`

