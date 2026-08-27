# Sprint 1

## Epic 1

Eliminar any Backend

Estado:

---

## Epic 2

Corregir React Hooks

Estado:

---

## Epic 3

Corregir Security

Estado:

---

## Epic 4

Logger Enterprise

Estado:

---

## Epic 5

Importador Excel

Estado:

---

## Epic 6

React Doctor

Estado:

---

# Sprint - Registro y onboarding institucional

Bloque funcional independiente del roadmap. Este sprint afecta autenticacion, creacion de
colegios, usuarios, multi-tenant, onboarding y seguridad.

## Epica

Registro y configuracion inicial del colegio - Multiinstitucion

## Objetivo

Permitir que una institucion se registre desde la pantalla de inicio, crear automaticamente su
administrador principal y dejar preparado el aislamiento de datos por `schoolId`.

## Alcance funcional

### Historia 1 - Registrar administrador y crear colegio

Implementar en Login una opcion visible:

- Registrar administrador / Crear colegio

El formulario debe recoger:

- Datos de la institucion:
  - nombre del colegio
  - codigo
  - NIT
  - correo institucional
  - telefono
  - direccion
  - sitio web opcional
- Datos del administrador:
  - nombre completo
  - tipo de documento
  - numero de documento
  - correo
  - telefono opcional
  - contrasena
  - confirmacion de contrasena

Flujo esperado:

```text
Administrador
  |
  v
Colegio
  |
  v
User.schoolId = School.id
  |
  v
ADMIN
```

## Backend

- Crear endpoint publico de onboarding institucional, por ejemplo:
  - `POST /api/auth/register-school`
- Mantener compatible el flujo actual de `schoolService.ts`.
- Reutilizar `createSchool()` o extraer una funcion transaccional comun para:
  - crear colegio
  - crear administrador
  - asignar rol `ADMIN`
  - asociar `User.schoolId = School.id`
- Validar:
  - correo unico
  - NIT unico
  - codigo de colegio unico
  - tipo y numero de documento segun reglas establecidas
  - contrasena fuerte
  - confirmacion de contrasena
- Garantizar transaccion Prisma:
  - si falla usuario, no queda colegio incompleto
  - si falla colegio, no queda usuario incompleto
- Devolver una respuesta segura:
  - no exponer `passwordHash`
  - no devolver contrasena en claro
  - opcionalmente iniciar sesion tras registro o exigir login normal

## Frontend

- En `LoginPage`, agregar flujo:
  - Registrar administrador / Crear colegio
- Crear formulario con dos secciones:
  - Institucion
  - Administrador
- Mostrar validaciones inmediatas:
  - contrasenas no coinciden
  - correo invalido
  - documento incompleto
  - NIT requerido
- Al finalizar:
  - mostrar mensaje de exito
  - redirigir a login o dashboard admin segun decision de seguridad

## Seguridad y multi-tenant

- Aplicar rate limiting al endpoint publico.
- No permitir crear usuarios sin `schoolId` desde este flujo.
- Asegurar que el administrador creado solo administre su propio colegio.
- Mantener `schoolId` en JWT y en `req.auth`.
- Validar que endpoints administrativos usen scope por `schoolId`.
- Registrar evento de auditoria de creacion institucional cuando exista modulo de auditoria.

## Criterios de aceptacion

- El correo no puede estar registrado.
- El documento debe validarse segun las reglas establecidas.
- El NIT debe ser unico.
- La contrasena y la confirmacion deben coincidir.
- El administrador se crea con rol `ADMIN`.
- El administrador queda asociado exclusivamente al colegio creado.
- La operacion es transaccional.
- El flujo actual de creacion de colegios mediante `schoolService.ts` sigue funcionando.
- El login posterior entrega token con `schoolId`.
- Los datos creados quedan aislados por colegio.

## Dependencias tecnicas

- Revisar si `School.nit` debe tener indice unico en Prisma o mantenerse como validacion de servicio.
- Definir reglas oficiales de documento por `DocumentType`.
- Confirmar politica de inicio de sesion tras registro:
  - login manual
  - auto-login
  - verificacion por correo / 2FA
- Confirmar SMTP real para envio de credenciales o bienvenida.

## Estado

Pendiente. Preparado para ejecutarse despues de cerrar la estabilidad de Sprint 1/importacion y
validar el despliegue de Sprint 2 en Render.
