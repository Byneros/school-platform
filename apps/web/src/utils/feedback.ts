export type FeedbackTone = "success" | "error" | "info" | "warning";

export const feedbackTitles = {
  academicClosure: {
    success: "Cierre academico",
    error: "Error en cierre academico",
  },
  admissions: {
    statusSuccess: "Estado de admision actualizado",
    statusError: "Error al cambiar estado",
    deleteEnrollmentSuccess: "Matricula eliminada",
    deleteEnrollmentError: "Error al eliminar matricula",
    createSuccess: "Admision creada",
    loadEnrollmentsError: "Error al cargar matriculas",
    updateEnrollmentSuccess: "Matricula actualizada",
    updateEnrollmentError: "Error al editar matricula",
    loadAdmissionsError: "Error al cargar admisiones",
    updateAdmissionSuccess: "Admision actualizada",
    updateAdmissionError: "Error al editar admision",
  },
  alerts: {
    center: "Centro de alertas",
  },
  branding: {
    error: "Error de personalizacion",
    success: "Personalizacion guardada",
  },
  cache: {
    error: "Error de cache",
  },
  certificates: {
    requestsError: "Error en solicitudes",
    issuedError: "Error en certificados",
  },
  dashboard: {
    studentEditError: "Error al editar estudiante",
  },
  developer: {
    accessError: "Acceso developer",
  },
  feedback: {
    error: "Error en feedback",
    success: "Feedback registrado",
  },
  login: {
    accessError: "Error de acceso",
    verificationError: "Error de verificacion",
  },
  notifications: {
    createSuccess: "Notificacion creada",
    createError: "Error al crear notificacion",
    statusSuccess: "Estado de notificacion actualizado",
    statusError: "Error al cambiar estado de notificacion",
    updateSuccess: "Notificacion actualizada",
    updateError: "Error al editar notificacion",
  },
  sessions: {
    success: "Sesiones",
    error: "Error de sesiones",
  },
  studentFollowup: {
    association: "Asociacion de acudiente",
    certificates: "Certificados y observador",
    verifyError: "Error de verificacion",
    observation: "Registro de observacion",
    followUps: "Seguimientos",
  },
  teacherAttendance: {
    success: "Asistencia actualizada",
    error: "Error en asistencia",
  },
  teacherDashboard: {
    profile: "Perfil docente",
    communications: "Comunicaciones",
  },
  teacherHours: {
    success: "Horas docentes",
    error: "Error al cargar horas",
  },
  teacherTasks: {
    taskError: "Error en tareas",
    taskSuccess: "Accion completada",
    updateError: "Error al editar tarea",
    updateSuccess: "Tarea actualizada",
    gradesError: "Error en calificaciones",
    gradesSuccess: "Calificaciones actualizadas",
  },
  finance: {
    invoiceEditError: "Error al editar factura",
  },
  users: {
    createSuccess: "Usuario creado",
    createError: "Error al crear usuario",
    deleteSuccess: "Usuario eliminado",
    deleteError: "Error al eliminar usuario",
    toggleSuccess: "Estado de usuario actualizado",
    toggleError: "Error al cambiar estado de usuario",
    importError: "Error de importacion",
    loadError: "Error al cargar usuarios",
    updateSuccess: "Usuario actualizado",
    updateError: "Error al editar usuario",
  },
} as const;

const errorPatterns = [
  "no se pudo",
  "error",
  "inval",
  "incorrect",
  "fall",
  "bloquead",
  "requer",
  "selecciona",
  "ingresa",
  "describe",
  "escribe",
];

const warningPatterns = ["pendiente", "atencion", "advertencia", "ya existe", "ya esta", "ya está"];

const successPatterns = [
  "guardad",
  "actualizad",
  "eliminad",
  "registrad",
  "cread",
  "aprob",
  "enviad",
  "cerrad",
  "copiad",
];

export function inferFeedbackTone(message: string): FeedbackTone {
  const normalized = String(message || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "info";
  if (errorPatterns.some((pattern) => normalized.includes(pattern))) return "error";
  if (warningPatterns.some((pattern) => normalized.includes(pattern))) return "warning";
  if (successPatterns.some((pattern) => normalized.includes(pattern))) return "success";
  return "info";
}
