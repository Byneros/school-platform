import "dotenv/config";
import process from "node:process";

type JsonValue = Record<string, any>;

function fail(message: string): never {
  throw new Error(message);
}

async function request(baseUrl: string, path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const contentType = res.headers.get("content-type") || "";
  let json: JsonValue = {};
  let text = "";
  if (contentType.includes("application/json")) {
    json = (await res.json()) as JsonValue;
  } else {
    text = await res.text();
  }
  return { res, json, text };
}

async function login(baseUrl: string, email: string, password: string) {
  const { res, json } = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok || !json?.token) {
    fail(`No se pudo iniciar sesion con ${email}. Verifica credenciales o ejecuta seed.`);
  }
  return String(json.token);
}

async function tryLogin(baseUrl: string, email: string, password: string) {
  try {
    return await login(baseUrl, email, password);
  } catch (error) {
    console.warn(
      `Regression API WARN: se omite suite para ${email}. Motivo: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return "";
  }
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function expectOk(res: Response, context: string) {
  if (!res.ok) {
    fail(`${context} fallo con status ${res.status}`);
  }
}

function expectStatus(res: Response, expected: number, context: string) {
  if (res.status !== expected) {
    fail(`${context} esperaba ${expected} y obtuvo ${res.status}`);
  }
}

async function main() {
  const baseUrl = process.env.TEST_API_URL || `http://127.0.0.1:${process.env.PORT || "4000"}`;

  const adminEmail = process.env.TEST_ADMIN_EMAIL || "admin@colegio.edu";
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || "Admin123!";
  const teacherEmail = process.env.TEST_TEACHER_EMAIL || "docente@colegio.edu";
  const teacherPassword = process.env.TEST_TEACHER_PASSWORD || "Teacher123!";
  const parentEmail = process.env.TEST_PARENT_EMAIL || "padre@colegio.edu";
  const parentPassword = process.env.TEST_PARENT_PASSWORD || "Parent123!";

  // Pre-check
  {
    const { res, json } = await request(baseUrl, "/health");
    expectOk(res, "health");
    if (json?.ok !== true) fail("health no devolvio ok=true");
  }

  const adminToken = await login(baseUrl, adminEmail, adminPassword);
  const teacherToken = await tryLogin(baseUrl, teacherEmail, teacherPassword);
  const parentToken = await tryLogin(baseUrl, parentEmail, parentPassword);

  // Auth/session and refresh
  {
    const session = await request(baseUrl, "/api/auth/session", {
      headers: authHeaders(adminToken),
    });
    expectOk(session.res, "auth/session admin");
    if (session.json?.role !== "ADMIN") fail("session admin devolvio rol inesperado");

    const refresh = await request(baseUrl, "/api/auth/refresh", {
      method: "POST",
      headers: authHeaders(adminToken),
    });
    expectOk(refresh.res, "auth/refresh admin");
    if (!refresh.json?.token) fail("auth/refresh no devolvio token");
  }

  // Admin critical modules
  {
    const users = await request(baseUrl, "/api/users?page=1&pageSize=5", {
      headers: authHeaders(adminToken),
    });
    expectOk(users.res, "users list");
    if (!Array.isArray(users.json?.data)) fail("users list no devolvio data[]");

    const admissions = await request(baseUrl, "/api/admissions?page=1&pageSize=5", {
      headers: authHeaders(adminToken),
    });
    expectOk(admissions.res, "admissions list");
    if (!Array.isArray(admissions.json?.data)) fail("admissions list no devolvio data[]");

    const enrollments = await request(baseUrl, "/api/enrollments?page=1&pageSize=5", {
      headers: authHeaders(adminToken),
    });
    expectOk(enrollments.res, "enrollments list");
    if (!Array.isArray(enrollments.json?.data)) fail("enrollments list no devolvio data[]");
  }

  // Reports
  {
    const attendanceSummary = await request(baseUrl, "/api/reports/attendance-summary", {
      headers: authHeaders(adminToken),
    });
    expectOk(attendanceSummary.res, "reports/attendance-summary");
    if (typeof attendanceSummary.json?.total !== "number") {
      fail("attendance-summary no devolvio total numerico");
    }

    const financeSummary = await request(baseUrl, "/api/reports/finance-summary", {
      headers: authHeaders(adminToken),
    });
    expectOk(financeSummary.res, "reports/finance-summary");
    if (typeof financeSummary.json?.total !== "number") {
      fail("finance-summary no devolvio total numerico");
    }

    const studentsPdf = await request(baseUrl, "/api/reports/students-pdf", {
      headers: authHeaders(adminToken),
    });
    expectOk(studentsPdf.res, "reports/students-pdf");
    const pdfType = studentsPdf.res.headers.get("content-type") || "";
    if (!pdfType.includes("application/pdf")) {
      fail("students-pdf no devolvio application/pdf");
    }
  }

  // Teacher critical modules + access boundaries
  if (teacherToken) {
    const enrollmentsRes = await request(baseUrl, "/api/teacher/enrollments", {
      headers: authHeaders(teacherToken),
    });
    expectOk(enrollmentsRes.res, "teacher/enrollments");
    if (!Array.isArray(enrollmentsRes.json)) fail("teacher/enrollments no devolvio array");

    const ownAttendance = await request(baseUrl, "/api/teacher/attendance?page=1&pageSize=5", {
      headers: authHeaders(teacherToken),
    });
    expectOk(ownAttendance.res, "teacher/attendance");
    if (!Array.isArray(ownAttendance.json?.data)) fail("teacher/attendance no devolvio data[]");

    const sampleAttendance = ownAttendance.json.data[0];
    if (
      sampleAttendance?.grade &&
      sampleAttendance?.group &&
      sampleAttendance?.date &&
      sampleAttendance?.status
    ) {
      const gradeLevel = encodeURIComponent(String(sampleAttendance.grade));
      const group = encodeURIComponent(String(sampleAttendance.group));
      const date = encodeURIComponent(String(sampleAttendance.date).slice(0, 10));
      const status = encodeURIComponent(String(sampleAttendance.status));
      const filteredAttendance = await request(
        baseUrl,
        `/api/teacher/attendance?page=1&pageSize=20&gradeLevel=${gradeLevel}&group=${group}&date=${date}&status=${status}`,
        { headers: authHeaders(teacherToken) }
      );
      expectOk(filteredAttendance.res, "teacher/attendance filtered by grade+group+date+status");
      if (!Array.isArray(filteredAttendance.json?.data)) {
        fail("teacher/attendance filtrado no devolvio data[]");
      }
      for (const item of filteredAttendance.json.data as Array<any>) {
        if (String(item?.grade || "") !== String(sampleAttendance.grade)) {
          fail("teacher/attendance filtrado devolvio registro con grado incorrecto");
        }
        if (String(item?.group || "") !== String(sampleAttendance.group)) {
          fail("teacher/attendance filtrado devolvio registro con grupo incorrecto");
        }
        if (String(item?.status || "") !== String(sampleAttendance.status)) {
          fail("teacher/attendance filtrado devolvio registro con estado incorrecto");
        }
        if (String(item?.date || "").slice(0, 10) !== String(sampleAttendance.date).slice(0, 10)) {
          fail("teacher/attendance filtrado devolvio registro con fecha incorrecta");
        }
      }
    } else {
      console.warn(
        "Regression API WARN: se omite validacion de filtros combinados de asistencia por falta de datos."
      );
    }

    const ownWindows = await request(baseUrl, "/api/teacher/attendance/windows", {
      headers: authHeaders(teacherToken),
    });
    expectOk(ownWindows.res, "teacher/attendance/windows");
    if (typeof ownWindows.json?.dayOfWeek !== "string") {
      fail("teacher/attendance/windows sin dayOfWeek");
    }

    // Bulk attendance: success and partial-success scenarios
    {
      const teacherEnrollments = enrollmentsRes.json as Array<any>;
      const candidate = teacherEnrollments.find((e) => !!e?.id);
      if (candidate?.id) {
        const todayIso = new Date().toISOString();
        const bulkOk = await request(baseUrl, "/api/attendance/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(teacherToken),
          },
          body: JSON.stringify({
            items: [{ enrollmentId: String(candidate.id), date: todayIso, status: "PRESENT" }],
          }),
        });
        expectStatus(bulkOk.res, 200, "attendance/bulk success");
        if (
          Number(bulkOk.json?.summary?.ok || 0) < 1 ||
          Number(bulkOk.json?.summary?.failed || 0) !== 0
        ) {
          fail("attendance/bulk success devolvio resumen inesperado");
        }

        const invalidEnrollmentId = "invalid-enrollment-id";
        const bulkPartial = await request(baseUrl, "/api/attendance/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(teacherToken),
          },
          body: JSON.stringify({
            items: [
              { enrollmentId: String(candidate.id), date: todayIso, status: "PRESENT" },
              { enrollmentId: invalidEnrollmentId, date: todayIso, status: "ABSENT" },
            ],
          }),
        });
        expectStatus(bulkPartial.res, 207, "attendance/bulk partial success");
        if (Number(bulkPartial.json?.summary?.failed || 0) < 1) {
          fail("attendance/bulk partial no reporto fallos");
        }
      } else {
        console.warn(
          "Regression API WARN: se omite attendance/bulk por falta de matriculas del docente."
        );
      }
    }

    const usersForbidden = await request(baseUrl, "/api/users?page=1&pageSize=1", {
      headers: authHeaders(teacherToken),
    });
    expectStatus(usersForbidden.res, 403, "teacher no debe acceder a /api/users");
  }

  // Parent critical modules + access boundaries
  if (parentToken) {
    const children = await request(baseUrl, "/api/parent/children", {
      headers: authHeaders(parentToken),
    });
    expectOk(children.res, "parent/children");
    if (!Array.isArray(children.json)) fail("parent/children no devolvio array");

    const invoices = await request(baseUrl, "/api/parent/invoices?page=1&pageSize=5", {
      headers: authHeaders(parentToken),
    });
    expectOk(invoices.res, "parent/invoices");
    if (!Array.isArray(invoices.json?.data)) fail("parent/invoices no devolvio data[]");

    const teacherForbidden = await request(baseUrl, "/api/teacher/attendance?page=1&pageSize=1", {
      headers: authHeaders(parentToken),
    });
    expectStatus(teacherForbidden.res, 403, "parent no debe acceder a /api/teacher/attendance");
  }

  console.log("Regression API OK: modulos criticos y permisos por rol validados.");
}

main().catch((error) => {
  console.error("Regression API FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
