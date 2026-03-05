# Diagrama de Clases y Relaciones de Datos

Versión mejorada para lectura rápida: separa dominios funcionales, conserva cardinalidades y agrega enums relevantes.

```mermaid
classDiagram
direction LR

%% =========================
%% SEGURIDAD Y PERFILES
%% =========================
class User {
  +id: String
  +email: String
  +passwordHash: String
  +fullName: String
  +role: RoleName
  +isActive: Boolean
}

class Teacher {
  +id: String
  +userId: String
  +subjects: Json
  +subjectHours: Json
  +subjectHoursMode: Json
  +subjectSchedules: Json
}

class Parent {
  +id: String
  +userId: String
}

%% =========================
%% ACADEMICO
%% =========================
class Student {
  +id: String
  +fullName: String
  +birthDate: DateTime?
  +gradeLevel: GradeLevel
  +isActive: Boolean
}

class Admission {
  +id: String
  +studentName: String
  +gradeLevel: GradeLevel
  +status: AdmissionStatus
  +approvedAt: DateTime?
  +enrollmentDueAt: DateTime?
}

class Class {
  +id: String
  +teacherId: String
  +gradeLevel: GradeLevel
  +schedule: Json?
}

class Enrollment {
  +id: String
  +studentId: String
  +classId: String
  +year: Int
  +status: String
  +admissionId: String?
}

class Attendance {
  +id: String
  +enrollmentId: String
  +date: DateTime
  +status: AttendanceStatus
  +notes: String?
}

class Grade {
  +id: String
  +enrollmentId: String
  +period: String
  +name: String
  +aspect: EvaluationAspect
  +score: Float
  +maxScore: Float
}

class Guardian {
  +id: String
  +parentId: String
  +studentId: String
  +relation: String
}

%% =========================
%% CARTERA
%% =========================
class Invoice {
  +id: String
  +studentId: String
  +amount: Float
  +dueDate: DateTime
  +status: InvoiceStatus
}

class Payment {
  +id: String
  +invoiceId: String
  +amount: Float
  +paidAt: DateTime
  +method: String
}

%% =========================
%% COMUNICACIONES
%% =========================
class Notification {
  +id: String
  +title: String
  +body: String
  +status: NotificationStatus
  +createdById: String
  +approvedById: String?
  +studentId: String?
}

class NotificationRecipient {
  +id: String
  +notificationId: String
  +parentId: String
  +readAt: DateTime?
}

%% =========================
%% ENUMS
%% =========================
class RoleName {
  <<enumeration>>
  ADMIN
  TEACHER
  PARENT
}

class GradeLevel {
  <<enumeration>>
  PRE_JARDIN
  JARDIN
  TRANSICION
  PRIMERO
  ...
  ONCE
}

class AdmissionStatus {
  <<enumeration>>
  PENDING
  APPROVED
  REJECTED
}

class AttendanceStatus {
  <<enumeration>>
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

class EvaluationAspect {
  <<enumeration>>
  COGNITIVE
  PERSONAL
  SOCIAL
}

class InvoiceStatus {
  <<enumeration>>
  PENDING
  PAID
  OVERDUE
}

class NotificationStatus {
  <<enumeration>>
  DRAFT
  PENDING
  APPROVED
  REJECTED
  SENT
}

%% =========================
%% RELACIONES
%% =========================
User "1" o-- "0..1" Teacher : teacherProfile
User "1" o-- "0..1" Parent : parentProfile

Teacher "1" --> "0..*" Class : teaches

Student "1" --> "0..*" Enrollment : enrolls
Class "1" --> "0..*" Enrollment : includes
Admission "0..1" --> "0..1" Enrollment : enrollmentFromAdmission

Enrollment "1" --> "0..*" Attendance : attendanceLog
Enrollment "1" --> "0..*" Grade : gradeLog

Parent "1" --> "0..*" Guardian : links
Student "1" --> "0..*" Guardian : links

Student "1" --> "0..*" Invoice : billing
Invoice "1" --> "0..*" Payment : payments

User "1" --> "0..*" Notification : createdBy
User "0..1" --> "0..*" Notification : approvedBy
Student "0..1" --> "0..*" Notification : target
Notification "1" --> "0..*" NotificationRecipient : recipients
Parent "1" --> "0..*" NotificationRecipient : receives
```

## Flujo principal de integración

1. `Admission` aprobada -> crea/reutiliza `Student` y genera `Enrollment`.
2. `Enrollment` conecta al estudiante con `Class` (grado + docente).
3. Desde `Enrollment` se registra `Attendance` y `Grade`.
4. `Invoice` y `Payment` dependen de `Student`.
5. `Notification` la crea/aprueba `User` y se entrega a `Parent` por `NotificationRecipient`.

## Reglas clave de consistencia

- `Enrollment`: unicidad por `studentId + classId + year`.
- `Enrollment.admissionId`: unicidad (una admisión no se matricula dos veces).
- `Guardian`: unicidad por `parentId + studentId`.
- `NotificationRecipient`: unicidad por `notificationId + parentId`.
