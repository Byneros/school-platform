import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import prisma from "../src/utils/prisma.js";
import { withServer } from "./helpers/testServer.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

function createRegistrationPayload() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    school: {
      code: `REG-${suffix}`.toUpperCase().slice(0, 20),
      name: "Colegio de Registro",
      nit: `NIT-${suffix}`,
      email: `school-${suffix}@example.test`,
    },
    admin: {
      fullName: "Admin de Prueba",
      docType: "CC",
      docNumber: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20),
      email: `admin-${suffix}@example.test`,
      password: "AdminPass123",
      confirmPassword: "AdminPass123",
    },
  };
}

function registerSchool(baseUrl: string, payload: ReturnType<typeof createRegistrationPayload>) {
  return fetch(`${baseUrl}/api/auth/register-school`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function cleanRegistrationData(
  schools: Array<{ code: string }>,
  users: Array<{ email: string }>
) {
  const emails = users.map((user) => user.email);
  if (emails.length > 0) {
    await prisma.refreshSession.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  }
  if (schools.length > 0) {
    await prisma.school.deleteMany({
      where: { code: { in: schools.map((school) => school.code) } },
    });
  }
}

test("school registration creates a scoped admin without exposing credentials", async () => {
  const payload = createRegistrationPayload();
  try {
    await withServer(async (baseUrl) => {
      const response = await registerSchool(baseUrl, payload);
      assert.equal(response.status, 201);

      const body = (await response.json()) as {
        school: { id: string; code: string };
        admin: { id: string; email: string; role: string; schoolId: string };
      };
      assert.equal(body.school.code, payload.school.code);
      assert.equal(body.admin.role, "ADMIN");
      assert.equal(body.admin.schoolId, body.school.id);
      assert.equal(body.admin.email, payload.admin.email);
      assert.equal("passwordHash" in body.admin, false);
      assert.equal("password" in body.admin, false);

      const storedAdmin = await prisma.user.findUniqueOrThrow({
        where: { id: body.admin.id },
      });
      assert.equal(storedAdmin.schoolId, body.school.id);
      assert.notEqual(storedAdmin.passwordHash, payload.admin.password);

      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.admin.email,
          password: payload.admin.password,
        }),
      });
      assert.equal(loginResponse.status, 200);
      const loginBody = (await loginResponse.json()) as {
        token?: string;
        requiresTwoFactor?: boolean;
        twoFactorToken?: string;
        devCode?: string;
      };
      let accessToken = loginBody.token;
      if (loginBody.requiresTwoFactor) {
        assert.ok(loginBody.twoFactorToken);
        assert.ok(loginBody.devCode);
        const verification = await fetch(`${baseUrl}/api/auth/2fa/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: loginBody.twoFactorToken, code: loginBody.devCode }),
        });
        assert.equal(verification.status, 200);
        accessToken = ((await verification.json()) as { token: string }).token;
      }

      assert.ok(accessToken);
      const claims = jwt.verify(accessToken, process.env.JWT_SECRET || "test-secret");
      assert.equal(typeof claims, "object");
      assert.equal((claims as jwt.JwtPayload).schoolId, body.school.id);
    });
  } finally {
    await cleanRegistrationData([payload.school], [payload.admin]);
  }
});

test("concurrent school registrations cannot reuse an NIT or leave an orphan admin", async () => {
  const first = createRegistrationPayload();
  const second = createRegistrationPayload();
  second.school.nit = first.school.nit;
  const payloads = [first, second];

  try {
    await withServer(async (baseUrl) => {
      const responses = await Promise.all(
        payloads.map((payload) => registerSchool(baseUrl, payload))
      );
      assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);

      const schools = await prisma.school.findMany({
        where: { nit: first.school.nit },
        select: { id: true },
      });
      assert.equal(schools.length, 1);
      const admins = await prisma.user.findMany({
        where: { schoolId: { in: schools.map((school) => school.id) } },
        select: { email: true, role: true },
      });
      assert.equal(admins.length, 1);
      assert.equal(admins[0].role, "ADMIN");
    });
  } finally {
    await cleanRegistrationData(
      payloads.map((payload) => payload.school),
      payloads.map((payload) => payload.admin)
    );
  }
});

test("school registration rolls back when the administrator email already exists", async () => {
  const payload = createRegistrationPayload();
  const existingUser = await prisma.user.create({
    data: {
      email: payload.admin.email,
      passwordHash: "test",
      fullName: "Existing User",
      role: "PARENT",
    },
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await registerSchool(baseUrl, payload);
      assert.equal(response.status, 409);

      const school = await prisma.school.findUnique({
        where: { code: payload.school.code },
      });
      assert.equal(school, null);
    });
  } finally {
    await prisma.user.delete({ where: { id: existingUser.id } });
    await cleanRegistrationData([payload.school], []);
  }
});
