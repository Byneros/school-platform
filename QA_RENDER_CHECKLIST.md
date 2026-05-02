# Deploy y QA

## 1. Deploy

### Frontend
1. Sube el último commit a tu repositorio.
2. En Render, abre el servicio web.
3. Pulsa `Manual Deploy`.
4. Pulsa `Deploy latest commit`.
5. Espera a que termine y confirma que el deploy quede en `Live`.

### Backend
1. En Render, abre el servicio API.
2. Pulsa `Manual Deploy`.
3. Pulsa `Deploy latest commit`.
4. Espera a que termine y confirma que el deploy quede en `Live`.

## 2. QA rápido

### Login
1. Entra al login.
2. Intenta un login inválido.
3. Verifica que aparezca el banner de error.
4. Inicia sesión con un usuario válido.
5. Si aplica 2FA, verifica que el error también salga como banner si el código es incorrecto.

### Admin - Usuarios
1. Crea un usuario con datos válidos.
2. Verifica banner de éxito.
3. Intenta crear un usuario inválido o repetido.
4. Verifica banner de error.
5. Edita un usuario.
6. Activa/desactiva un usuario.
7. Elimina un usuario.

### Admin - Admisiones
1. Crea una admisión.
2. Verifica scroll al banner.
3. Aprueba o rechaza una admisión.
4. Edita una admisión.
5. Matricula una admisión aprobada.
6. Edita una matrícula.
7. Elimina una matrícula.

### Admin - Notificaciones
1. Crea una notificación.
2. Aprueba o rechaza una notificación.
3. Edita una notificación.

### Admin - Branding
1. Cambia un valor simple.
2. Guarda.
3. Verifica banner de éxito.

### Admin - Certificados
1. Fuerza un caso de error o acción inválida.
2. Verifica banner de error en solicitudes.
3. Verifica banner de error en libro de certificados si falla una carga.

### Teacher
1. Actualiza perfil docente.
2. Envía una comunicación.
3. Crea una tarea.
4. Edita una tarea.
5. Guarda calificaciones.
6. Registra asistencia.

### Parent / Feedback
1. Registra un comentario.
2. Verifica banner de éxito.
3. Fuerza un error simple si puedes.
4. Verifica banner de error.

### Developer
1. Entra a `/dev` con usuario `DEVELOPER`.
2. Verifica token.
3. Si el token o IP no coincide, confirma que salga banner de error.

## 3. Accesibilidad básica
1. Confirma que los banners aparezcan arriba del flujo afectado.
2. Confirma que el scroll automático funcione.
3. Confirma que el banner desaparezca solo después de unos segundos.
4. Confirma que el texto del banner sea claro y no esté duplicado.

## 4. Criterio de salida

El cambio está listo si:
- no hay errores de build
- los banners aparecen en flujos principales
- los banners de error y éxito usan estilos consistentes
- el comportamiento de scroll y auto-ocultado funciona
- login, usuarios, admisiones, notificaciones, tareas y asistencia no rompen navegación
