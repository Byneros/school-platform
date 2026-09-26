import test from "node:test";
import assert from "node:assert/strict";

import prisma from "../src/utils/prisma.js";
import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import { withServer } from "./helpers/testServer.js";
import { authToken } from "./helpers/auth.js";
import { apiPost } from "./helpers/request.js";

test("teacher cannot grade or register attendance for an enrollment in another school", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const schoolA = await prisma.school.create({
    data: { code: `TENANT-A-${suffix}`, name: "Tenant A" },
  });
  const schoolB = await prisma.school.create({
    data: { code: `TENANT-B-${suffix}`, name: "Tenant B" },
  });
  let enrollmentId = "";

  try {
    const teacherUserA = await prisma.user.create({
      data: {
        email: `tenant-a-${suffix}@example.test`,
        passwordHash: "test",
        fullName: "Tenant A Teacher",
        role: "TEACHER",
        schoolId: schoolA.id,
      },
    });
    await prisma.teacher.create({
      data: { userId: teacherUserA.id, schoolId: schoolA.id },
    });
    const teacherUserB = await prisma.user.create({
      data: {
        email: `tenant-b-${suffix}@example.test`,
        passwordHash: "test",
        fullName: "Tenant B Teacher",
        role: "TEACHER",
        schoolId: schoolB.id,
      },
    });
    const teacherB = await prisma.teacher.create({
      data: { userId: teacherUserB.id, schoolId: schoolB.id },
    });
    const studentB = await prisma.student.create({
      data: { fullName: "Tenant B Student", gradeLevel: "PRIMERO", schoolId: schoolB.id },
    });
    const classB = await prisma.class.create({
      data: {
        teacherId: teacherB.id,
        gradeLevel: "PRIMERO",
        studentGroup: "1",
        academicYear: 2026,
        schoolId: schoolB.id,
      },
    });
    const enrollmentB = await prisma.enrollment.create({
      data: {
        studentId: studentB.id,
        classId: classB.id,
        year: 2026,
        status: "ACTIVE",
        studentGradeLevel: "PRIMERO",
        guardianFullName: "Acudiente",
        guardianDocNumber: "TEST",
        guardianRelation: "Acudiente",
        contactPhone: "0000000000",
        schoolId: schoolB.id,
      },
    });
    enrollmentId = enrollmentB.id;

    await withServer(async (baseUrl) => {
      const token = authToken("TEACHER", teacherUserA.id, schoolA.id);
      const gradeResponse = await apiPost(baseUrl, token, "/api/grades", {
        enrollmentId: enrollmentB.id,
        period: "1",
        name: "Test",
        score: 4,
        maxScore: 5,
      });
      assert.equal(gradeResponse.status, 404);

      const attendanceResponse = await apiPost(baseUrl, token, "/api/attendance", {
        enrollmentId: enrollmentB.id,
        date: "2026-09-25T00:00:00.000Z",
        status: "PRESENT",
      });
      assert.equal(attendanceResponse.status, 404);
    });

    assert.equal(await prisma.grade.count({ where: { enrollmentId: enrollmentB.id } }), 0);
    assert.equal(await prisma.attendance.count({ where: { enrollmentId: enrollmentB.id } }), 0);
  } finally {
    if (enrollmentId) {
      await prisma.grade.deleteMany({ where: { enrollmentId } });
      await prisma.attendance.deleteMany({ where: { enrollmentId } });
      await prisma.enrollment.deleteMany({ where: { id: enrollmentId } });
    }
    await prisma.class.deleteMany({ where: { schoolId: { in: [schoolA.id, schoolB.id] } } });
    await prisma.student.deleteMany({ where: { schoolId: { in: [schoolA.id, schoolB.id] } } });
    await prisma.teacher.deleteMany({ where: { schoolId: { in: [schoolA.id, schoolB.id] } } });
    await prisma.user.deleteMany({ where: { schoolId: { in: [schoolA.id, schoolB.id] } } });
    await prisma.school.deleteMany({ where: { id: { in: [schoolA.id, schoolB.id] } } });
  }
});

test("import requires an explicit school context even for global administrators", async () => {
  await withServer(async (baseUrl) => {
    const response = await apiPost(
      baseUrl,
      authToken("SUPER_ADMIN", "global-admin", null),
      "/api/reports/import-template/import",
      { mode: "validate", fileBase64: "invalid" }
    );
    assert.equal(response.status, 403);
  });
});

test("failed Excel import rolls back earlier writes and returns downloadable error fields", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const school = await prisma.school.create({
    data: { code: `IMPORT-${suffix}`, name: "Import Test" },
  });
  const admin = await prisma.user.create({
    data: {
      email: `import-admin-${suffix}@example.test`,
      passwordHash: "test",
      fullName: "Import Admin",
      role: "ADMIN",
      schoolId: school.id,
    },
  });
  const importedEmail = `rollback-${suffix}@example.test`;

  try {
    const workbook = await writeXlsxFile([
      {
        sheet: "USUARIOS",
        data: [
          ["email", "fullName", "role"],
          [importedEmail, "Must Roll Back", "TEACHER"],
        ] as SheetData,
      },
      {
        sheet: "PAGOS",
        data: [
          ["invoiceId", "amount", "paidAt", "method"],
          ["MISSING-INVOICE", 25, "2026-09-25", "CASH"],
        ] as SheetData,
      },
    ]).toBuffer();
    const fileBase64 = Buffer.from(workbook).toString("base64");

    await withServer(async (baseUrl) => {
      const response = await apiPost(
        baseUrl,
        authToken("ADMIN", admin.id, school.id),
        "/api/reports/import-template/import",
        { mode: "import", fileBase64 }
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        errors: Array<{
          field: string;
          value: string;
          message: string;
          recommendation: string;
        }>;
      };
      assert.equal(body.errors.length, 1);
      assert.ok(body.errors[0].field);
      assert.ok(body.errors[0].message);
      assert.ok(body.errors[0].recommendation);
    });

    assert.equal(await prisma.user.count({ where: { email: importedEmail } }), 0);
  } finally {
    await prisma.importHistory.deleteMany({ where: { createdById: admin.id } });
    await prisma.user.delete({ where: { id: admin.id } });
    await prisma.school.delete({ where: { id: school.id } });
  }
});
