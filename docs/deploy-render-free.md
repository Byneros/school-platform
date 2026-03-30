# Despliegue gratuito en Render (API + Web + Postgres)

Este paso a paso usa el plan **Free** de Render. Ten en cuenta sus limitaciones
(sleep automático y base de datos temporal) antes de usarlo en producción.

## 1) Requisitos previos
- Tener el repositorio en GitHub/GitLab/Bitbucket.
- Tener una cuenta en Render.

## 2) Crear los servicios con `render.yaml`
1. Asegúrate de tener el archivo `render.yaml` en la raíz del repo.
2. En Render Dashboard ve a **Blueprints** y crea una nueva instancia.
3. Render creará:
   - Un **Web Service** para el API.
   - Un **Static Site** para el frontend.
   - Una **Postgres Free** para la base de datos.
4. El `render.yaml` incluye **autodeploy** y health check estricto (`/ready`).
5. Si migras a un plan pago, puedes mover las migraciones al `preDeployCommand`.

## 3) Configurar variables obligatorias
En el panel del **API**:
- `CORS_ORIGINS`: pega la URL del frontend (ej. `https://school-web.onrender.com`)
- `JWT_SECRET`: generado automáticamente por Render.
- `DATABASE_URL`: inyectada desde la DB (Render lo hace por `fromDatabase`).

En el panel del **Web**:
- `VITE_API_URL`: URL pública del API + `/api` (ej. `https://school-api.onrender.com/api`)

## 4) Configurar SMTP (para 2FA por correo)
Render Free **no permite** enviar correo por los puertos SMTP 25/465/587.
Usa un proveedor que soporte **puerto 2525** o API SMTP con ese puerto.

Variables a definir en el API:
- `SMTP_HOST`
- `SMTP_PORT` = `2525`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Si no tienes SMTP, puedes desactivar 2FA temporalmente:
- `ADMIN_2FA_ENABLED=false`

## 5) Consideraciones del plan Free
- Los Web Services se “duermen” si no reciben tráfico por ~15 min.
- El Postgres Free expira a los 30 días y no incluye backups.
- El sistema de archivos es efímero (no guardar archivos locales).

## 6) Verificación rápida
1. Abre la URL del frontend.
2. Inicia sesión y comprueba que el API responde.
3. Si 2FA está activo, verifica que el correo llegue.
