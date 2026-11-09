import "dotenv/config";
import process from "node:process";
import jwt from "jsonwebtoken";

type JsonObject = Record<string, any>;

function fail(message: string): never {
  throw new Error(message);
}

async function requestJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: JsonObject = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { res, json, text };
}

async function main() {
  const baseUrl = process.env.TEST_API_URL || `http://127.0.0.1:${process.env.PORT || "4000"}`;

  const health = await requestJson(`${baseUrl}/health`);
  if (!health.res.ok || health.json?.ok !== true) {
    fail(
      `Health check fallo en ${baseUrl}/health. Define TEST_API_URL si tu API corre en otro puerto.`
    );
  }

  const notFound = await requestJson(`${baseUrl}/api/no-existe`);
  if (notFound.res.status !== 404 || notFound.json?.message !== "Endpoint no encontrado") {
    fail("Fallo test 404: se esperaba message='Endpoint no encontrado'.");
  }

  const badJsonRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad-json",
  });
  const badJsonBody = (await badJsonRes.json()) as JsonObject;
  if (badJsonRes.status !== 400 || badJsonBody?.message !== "JSON invalido en la solicitud") {
    fail("Fallo test JSON invalido: se esperaba status 400 y message consistente.");
  }

  const attendanceNoToken = await requestJson(`${baseUrl}/api/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollmentId: "x",
      date: new Date().toISOString(),
      status: "PRESENT",
    }),
  });
  if (attendanceNoToken.res.status !== 401 || attendanceNoToken.json?.error !== "Missing token") {
    fail("Fallo test attendance sin token: se esperaba 401 Missing token.");
  }

  const secret = process.env.JWT_SECRET || "test-secret";
  const adminToken = jwt.sign(
    { role: "ADMIN", userId: "test-admin", schoolId: "test-school" },
    secret,
    { expiresIn: "1h" }
  );
  const attendanceAdmin = await requestJson(`${baseUrl}/api/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      enrollmentId: "x",
      date: new Date().toISOString(),
      status: "PRESENT",
    }),
  });
  if (attendanceAdmin.res.status !== 403 || attendanceAdmin.json?.error !== "Forbidden") {
    fail("Fallo test attendance rol ADMIN: se esperaba 403 Forbidden.");
  }

  const teacherToken = jwt.sign({ role: "TEACHER", userId: "test-teacher" }, secret, {
    expiresIn: "1h",
  });
  const attendanceTeacherInvalid = await requestJson(`${baseUrl}/api/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({}),
  });
  if (
    attendanceTeacherInvalid.res.status !== 400 ||
    attendanceTeacherInvalid.json?.error !== "Validation error" ||
    !Array.isArray(attendanceTeacherInvalid.json?.issues)
  ) {
    fail("Fallo test attendance validacion: se esperaba 400 Validation error con issues.");
  }

  console.log("Smoke API OK: auth, errores y permisos base validados.");
}

main().catch((error) => {
  console.error("Smoke API FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
