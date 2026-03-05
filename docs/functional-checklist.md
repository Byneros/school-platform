# Checklist Funcional (Preproduccion)

## 1) Acceso y sesiones
- Iniciar sesion con `ADMIN`, `TEACHER`, `PARENT`.
- Recargar pagina y verificar que la sesion sigue activa.
- Cerrar sesion y confirmar que no permite volver a modulos protegidos con boton atras.

## 2) Panel Administrador
- Usuarios: crear, editar, desactivar, eliminar (con confirmacion).
- Admisiones: crear admision, aprobar/rechazar, ver aprobadas pendientes de matricula.
- Matriculas: matricular desde admision aprobada, editar todos los campos, eliminar.
- Validar mensaje cuando el estudiante ya esta matriculado.
- Exportar PDF de matriculas ordenado por grado/apellido.

## 3) Asistencia por grado/grupo
- Ver franja valida del dia.
- Consultar por grado y por grupo.
- Registrar asistencia por checkbox.
- Confirmar visibilidad/registro hasta las `11:59 PM` del mismo dia.
- En admin: ver asistencia de todos los docentes.
- En docente: ver solo asistencia propia.

## 4) Calificaciones y boletines
- Docente: crear notas por periodo/aspecto.
- Confirmar calculo de resumen final ponderado.
- Padre: consultar boletines y descargar PDF.

## 5) Finanzas y comunicaciones
- Facturas: crear/consultar estado.
- Pagos: registrar y validar impacto en estado de factura.
- Notificaciones: crear/aprobar/enviar y validar recepcion en panel padre.

## 6) Exportes
- PDF horario docente.
- PDF horario estudiantes por grado.
- PDF de matriculas.
- Validar que el archivo abre y contiene datos coherentes.

## 7) Integridad de datos
- Admisiones aprobadas que se matriculan deben salir de la lista pendiente.
- Matricula debe conservar vinculos con estudiante, docente y grado.
- Eliminar matricula no debe dejar registros huerfanos.

## 8) Comando automatizado
- Ejecutar: `npm run preprod:verify`
- Esperado:
  - migraciones aplicadas,
  - prisma generate OK,
  - build API/web OK,
  - regresion API OK.

