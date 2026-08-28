import test from "node:test";
import assert from "node:assert/strict";

import { withServer } from "./helpers/testServer.js";
import { authToken } from "./helpers/auth.js";
import { apiGet, apiPost } from "./helpers/request.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

test("GET /api/users permite ADMIN y bloquea roles no administrativos", async () => {
  await withServer(async (baseUrl) => {
    const adminRes = await apiGet(baseUrl, authToken("ADMIN"), "/api/users");
    assert.equal(adminRes.status, 200);

    const teacherRes = await apiGet(baseUrl, authToken("TEACHER"), "/api/users");
    assert.equal(teacherRes.status, 403);

    const parentRes = await apiGet(baseUrl, authToken("PARENT"), "/api/users");
    assert.equal(parentRes.status, 403);
  });
});

test("POST /api/users crea usuario en el colegio del administrador", async () => {
  await withServer(async (baseUrl) => {
    const schoolId = "test-school-users";
    const token = authToken("ADMIN", "admin-test", schoolId);
    const email = `usuario.${Date.now()}@test.com`;

    const res = await apiPost(baseUrl, token, "/api/users", {
      fullName: "Usuario Test",
      email,
      password: "Password123!",
      role: "TEACHER",
      isActive: true,
      teacherSubjects: [],
    });

    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      email: string;
      role: string;
      fullName: string;
      schoolId: string;
    };

    assert.equal(body.email, email);
    assert.equal(body.role, "TEACHER");
    assert.equal(body.fullName, "Usuario Test");
    assert.equal(body.schoolId, schoolId);
  });
});

test("POST /api/users valida datos obligatorios y correo duplicado", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("ADMIN");
    const invalidRes = await apiPost(baseUrl, token, "/api/users", {});

    assert.equal(invalidRes.status, 400);

    const email = `duplicado.${Date.now()}@test.com`;

    const firstRes = await apiPost(baseUrl, token, "/api/users", {
      fullName: "Usuario Uno",
      email,
      password: "Password123!",
      role: "TEACHER",
      teacherSubjects: [],
    });
    assert.equal(firstRes.status, 200);

    const secondRes = await apiPost(baseUrl, token, "/api/users", {
      fullName: "Usuario Dos",
      email,
      password: "Password123!",
      role: "TEACHER",
      teacherSubjects: [],
    });

    assert.equal(secondRes.status, 409);
  });
});

test("POST /api/users bloquea creacion desde rol TEACHER", async () => {
  await withServer(async (baseUrl) => {
    const res = await apiPost(baseUrl, authToken("TEACHER"), "/api/users", {
      fullName: "Teacher Test",
      email: `teacher.${Date.now()}@test.com`,
      password: "Password123!",
      role: "TEACHER",
    });

    assert.equal(res.status, 403);
  });
});
