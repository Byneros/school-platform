import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const gradeLevels = [
  "PRE_JARDIN",
  "JARDIN",
  "TRANSICION",
  "PRIMERO",
  "SEGUNDO",
  "TERCERO",
  "CUARTO",
  "QUINTO",
  "SEXTO",
  "SEPTIMO",
  "OCTAVO",
  "NOVENO",
  "DECIMO",
  "ONCE",
] as const;

async function main() {
  console.log("Iniciando seed...");

  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const teacherPassword = await bcrypt.hash("Teacher123!", 10);
  const parentPassword = await bcrypt.hash("Parent123!", 10);
  const school = await prisma.school.upsert({
    where: {
      code: "DEMO",
    },
    update: {
      name: "School Platform Demo",
      isActive: true,
    },
    create: {
      code: "DEMO",
      name: "School Platform Demo",
      email: "admin@schoolplatform.com",
      website: "https://schoolplatform.app",
      isActive: true,
    },
  });

  const schoolCartagena = await prisma.school.upsert({
    where: {
      code: "CARTAGENA",
    },
    update: {
      name: "Colegio Cartagena",
      isActive: true,
    },
    create: {
      code: "CARTAGENA",
      name: "Colegio Cartagena",
      email: "admin@colegiocartagena.edu",
      website: "https://colegiocartagena.edu",
      isActive: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@colegio.edu" },
    update: {
      passwordHash: adminPassword,
      fullName: "Administrador Principal",
      role: "SUPER_ADMIN",
      schoolId: school.id,
    },
    create: {
      email: "admin@colegio.edu",
      passwordHash: adminPassword,
      fullName: "Administrador Principal",
      role: "SUPER_ADMIN",
      schoolId: school.id,
    },
  });

  await prisma.user.upsert({
    where: {
      email: "admin.cartagena@colegio.edu",
    },
    update: {
      passwordHash: adminPassword,
      fullName: "Administrador Colegio Cartagena",
      role: "ADMIN",
      isActive: true,
      schoolId: schoolCartagena.id,
    },
    create: {
      email: "admin.cartagena@colegio.edu",
      passwordHash: adminPassword,
      fullName: "Administrador Colegio Cartagena",
      role: "ADMIN",
      isActive: true,
      schoolId: schoolCartagena.id,
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: "docente@colegio.edu" },
    update: {
      passwordHash: teacherPassword,
      fullName: "Docente Demo",
      role: "TEACHER",
      schoolId: school.id,
    },
    create: {
      email: "docente@colegio.edu",
      passwordHash: teacherPassword,
      fullName: "Docente Demo",
      role: "TEACHER",
      schoolId: school.id,
    },
  });

  const parentUser = await prisma.user.upsert({
    where: { email: "padre@colegio.edu" },
    update: {
      passwordHash: parentPassword,
      fullName: "Padre Demo",
      role: "PARENT",
      schoolId: school.id,
    },
    create: {
      email: "padre@colegio.edu",
      passwordHash: parentPassword,
      fullName: "Padre Demo",
      role: "PARENT",
      schoolId: school.id,
    },
  });

  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {
      schoolId: school.id,
      professionalProfile: "Docente de apoyo academico institucional.",
      subjects: ["General"],
      subjectHours: { General: 10 },
      subjectHoursMode: { General: false },
      subjectSchedules: { General: [] },
      cognitiveWeight: 60,
      personalWeight: 20,
      socialWeight: 20,
    },
    create: {
      userId: teacherUser.id,
      schoolId: school.id,
      professionalProfile: "Docente de apoyo academico institucional.",
      subjects: ["General"],
      subjectHours: { General: 10 },
      subjectHoursMode: { General: false },
      subjectSchedules: { General: [] },
      cognitiveWeight: 60,
      personalWeight: 20,
      socialWeight: 20,
    },
  });

  const teacherDemos = [
    {
      email: "ciencias.naturales@colegio.edu",
      fullName: "Docente Ciencias Naturales",
      profile: "Licenciado en Biologia y Educacion Ambiental.",
      subjects: ["Ciencias Naturales", "Educacion Ambiental", "Fisica", "Quimica"],
    },
    {
      email: "ciencias.sociales@colegio.edu",
      fullName: "Docente Ciencias Sociales",
      profile: "Licenciado en Ciencias Sociales con enfasis en historia y geografia.",
      subjects: ["Historia", "Geografia", "Constitucion Politica", "Democracia"],
    },
    {
      email: "educacion.artistica@colegio.edu",
      fullName: "Docente Educacion Artistica",
      profile: "Profesional en Artes Visuales y Educacion Artistica.",
      subjects: ["Educacion Artistica"],
    },
    {
      email: "etica.valores@colegio.edu",
      fullName: "Docente Etica y Valores",
      profile: "Formador en educacion etica y desarrollo humano.",
      subjects: ["Educacion Etica", "Valores Humanos"],
    },
    {
      email: "educacion.fisica@colegio.edu",
      fullName: "Docente Educacion Fisica",
      profile: "Licenciado en Educacion Fisica, Recreacion y Deporte.",
      subjects: ["Educacion Fisica"],
    },
    {
      email: "educacion.religiosa@colegio.edu",
      fullName: "Docente Educacion Religiosa",
      profile: "Docente de Educacion Religiosa Escolar.",
      subjects: ["Educacion Religiosa"],
    },
    {
      email: "humanidades.idiomas@colegio.edu",
      fullName: "Docente Humanidades e Idiomas",
      profile: "Licenciado en Lengua Castellana e Idiomas Extranjeros.",
      subjects: ["Lengua Castellana", "Ingles"],
    },
    {
      email: "matematicas@colegio.edu",
      fullName: "Docente Matematicas",
      profile: "Licenciado en Matematicas y didactica del pensamiento logico.",
      subjects: ["Matematicas", "Geometria"],
    },
    {
      email: "tecnologia.informatica@colegio.edu",
      fullName: "Docente Tecnologia e Informatica",
      profile: "Ingeniero de Sistemas orientado a educacion en tecnologia.",
      subjects: ["Tecnologia", "Informatica"],
    },
  ];

  for (const t of teacherDemos) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {
        passwordHash: teacherPassword,
        fullName: t.fullName,
        role: "TEACHER",
        isActive: true,
        schoolId: school.id,
      },
      create: {
        email: t.email,
        passwordHash: teacherPassword,
        fullName: t.fullName,
        role: "TEACHER",
        isActive: true,
        schoolId: school.id,
      },
    });

    await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {
        schoolId: school.id,
        professionalProfile: t.profile,
        subjects: t.subjects,
        subjectHours: Object.fromEntries(
          t.subjects.map((s) => [s, s.toLowerCase().includes("matematicas") ? 6 : 4])
        ),
        subjectHoursMode: Object.fromEntries(
          t.subjects.map((s) => [s, !s.toLowerCase().includes("matematicas")])
        ),
        subjectSchedules: Object.fromEntries(t.subjects.map((s) => [s, []])),
        cognitiveWeight: 60,
        personalWeight: 20,
        socialWeight: 20,
      },
      create: {
        userId: user.id,
        schoolId: school.id,
        professionalProfile: t.profile,
        subjects: t.subjects,
        subjectHours: Object.fromEntries(
          t.subjects.map((s) => [s, s.toLowerCase().includes("matematicas") ? 6 : 4])
        ),
        subjectHoursMode: Object.fromEntries(
          t.subjects.map((s) => [s, !s.toLowerCase().includes("matematicas")])
        ),
        subjectSchedules: Object.fromEntries(t.subjects.map((s) => [s, []])),
        cognitiveWeight: 60,
        personalWeight: 20,
        socialWeight: 20,
      },
    });
  }

  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {
      schoolId: school.id,
    },
    create: {
      userId: parentUser.id,
      schoolId: school.id,
    },
  });

  // Clases por grado
  const classes: { id: string; gradeLevel: (typeof gradeLevels)[number] }[] = [];
  for (const grade of gradeLevels) {
    const cls = await prisma.class.upsert({
      where: { id: `class-${grade.toLowerCase()}` },
      update: {
        schoolId: school.id,
        gradeLevel: grade,
      },
      create: {
        id: `class-${grade.toLowerCase()}`,
        schoolId: school.id,
        teacherId: teacher.id,
        gradeLevel: grade,
        studentGroup: "A",
        academicYear: new Date().getFullYear(),
      },
    });

    classes.push({ id: cls.id, gradeLevel: grade });
  }

  // Estudiantes por grado
  const students = [] as {
    id: string;
    fullName: string;
    gradeLevel: (typeof gradeLevels)[number];
  }[];
  gradeLevels.forEach((g, i) => {
    students.push({ id: `student-${i + 1}`, fullName: `Estudiante ${i + 1}`, gradeLevel: g });
  });

  for (const s of students) {
    await prisma.student.upsert({
      where: { id: s.id },
      update: {
        schoolId: school.id,
      },
      create: {
        id: s.id,
        schoolId: school.id,
        fullName: s.fullName,
        gradeLevel: s.gradeLevel,
      },
    });
  }

  // Asignar guardian a los primeros 3 estudiantes
  for (const s of students.slice(0, 3)) {
    await prisma.guardian.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId: s.id } },
      update: {},
      create: { parentId: parent.id, studentId: s.id, relation: "Padre" },
    });
  }

  // Matriculas
  for (const s of students) {
    const cls = classes.find((c, idx) => idx === students.indexOf(s)) || classes[0];
    await prisma.enrollment.upsert({
      where: { studentId_classId_year: { studentId: s.id, classId: cls.id, year: 2026 } },
      update: {
        schoolId: school.id,
      },
      create: {
        schoolId: school.id,
        studentId: s.id,
        classId: cls.id,
        year: 2026,
        status: "ACTIVE",
        studentFullName: s.fullName,
        studentBirthDate: new Date("2015-01-15"),
        studentBirthPlaceDept: "Cundinamarca",
        studentBirthPlaceCity: "Bogota",
        studentGender: "MASCULINO",
        studentDocType: "REGISTRO_CIVIL",
        studentDocNumber: `RC-${s.id}`,
        studentGradeLevel: s.gradeLevel,
        studentAddress: "Barrio Centro, Calle 10 # 5-20",
        guardianFullName: "Acudiente Demo",
        guardianDocType: "CEDULA",
        guardianDocNumber: `CC-${s.id}`,
        guardianRelation: "Padre",
        contactPhone: "3001234567",
        contactEmail: `acudiente${s.id}@correo.com`,
        documents: {
          civilRegistry: true,
          guardianId: true,
          residenceProof: false,
          healthCertificate: false,
          vaccinationCard: false,
          previousReport: false,
        },
        documentsNotes: "Documentos en proceso de entrega",
      },
    });
  }

  // Asistencia y calificaciones
  const enrollments = await prisma.enrollment.findMany({ take: 10 });
  for (const e of enrollments) {
    await prisma.attendance.upsert({
      where: { id: `att-${e.id}` },
      update: {},
      create: {
        id: `att-${e.id}`,
        enrollmentId: e.id,
        date: new Date("2026-02-06"),
        status: "PRESENT",
      },
    });

    await prisma.grade.upsert({
      where: { id: `grade-${e.id}` },
      update: {},
      create: {
        id: `grade-${e.id}`,
        enrollmentId: e.id,
        period: "P1",
        name: "Examen 1",
        score: 17,
        maxScore: 20,
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        schoolId: school.id,
        title: "Bienvenidos al ciclo 2026",
        body: "Comunicado de bienvenida para familias y estudiantes.",
        status: "APPROVED",
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
      },
      {
        schoolId: school.id,
        title: "Tarea de ciencias",
        body: "Entregar actividad el viernes.",
        status: "PENDING",
        createdById: teacherUser.id,
        studentId: students[1].id,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.admission.upsert({
    where: { id: "adm-1" },
    update: {},
    create: {
      id: "adm-1",
      schoolId: school.id,
      studentName: "Luis Gomez",
      gradeLevel: "PRE_JARDIN",
      status: "PENDING",
      notes: "Solicitud nueva",
    },
  });

  await prisma.admission.upsert({
    where: { id: "adm-2" },
    update: {},
    create: {
      id: "adm-2",
      schoolId: school.id,
      studentName: "Carla Mendez",
      gradeLevel: "PRIMERO",
      status: "APPROVED",
      notes: "Documentos completos",
    },
  });

  // Facturas y pagos
  for (const s of students.slice(0, 5)) {
    const invoice = await prisma.invoice.upsert({
      where: { id: `inv-${s.id}` },
      update: {},
      create: {
        id: `inv-${s.id}`,
        studentId: s.id,
        amount: 260,
        dueDate: new Date("2026-02-20"),
        status: "PENDING",
      },
    });

    await prisma.payment.upsert({
      where: { id: `pay-${s.id}` },
      update: {},
      create: {
        id: `pay-${s.id}`,
        invoiceId: invoice.id,
        amount: 260,
        paidAt: new Date("2026-02-05"),
        method: "Efectivo",
        reference: `P-${s.id}`,
      },
    });
  }

  console.log("Seed ejecutado correctamente");
}

main()
  .catch((e) => {
    console.error("Error en el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
