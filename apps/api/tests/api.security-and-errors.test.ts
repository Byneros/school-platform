import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import app from "../src/app.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", (err) => reject(err));
  });
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function authToken(role: "ADMIN" | "TEACHER" | "PARENT", userId = "test-user") {
  return jwt.sign({ role, userId }, process.env.JWT_SECRET as string, { expiresIn: "1h" });
}

test("GET /api/no-existe responde 404 con formato consistente", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/no-existe`);
    const body = (await res.json()) as { message?: string };
    assert.equal(res.status, 404);
    assert.equal(body.message, "Endpoint no encontrado");
  });
});

test("POST /api/auth/login con JSON invalido responde 400 consistente", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json"
    });
    const body = (await res.json()) as { message?: string };
    assert.equal(res.status, 400);
    assert.equal(body.message, "JSON invalido en la solicitud");
  });
});

test("POST /api/attendance sin token responde 401", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: "x",
        date: new Date().toISOString(),
        status: "PRESENT"
      })
    });
    const body = (await res.json()) as { error?: string };
    assert.equal(res.status, 401);
    assert.equal(body.error, "Missing token");
  });
});

test("POST /api/attendance con rol ADMIN responde 403", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("ADMIN");
    const res = await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        enrollmentId: "x",
        date: new Date().toISOString(),
        status: "PRESENT"
      })
    });
    const body = (await res.json()) as { error?: string };
    assert.equal(res.status, 403);
    assert.equal(body.error, "Forbidden");
  });
});

test("POST /api/attendance con rol TEACHER y body invalido responde 400", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("TEACHER");
    const res = await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({})
    });
    const body = (await res.json()) as { error?: string; issues?: unknown[] };
    assert.equal(res.status, 400);
    assert.equal(body.error, "Validation error");
    assert.ok(Array.isArray(body.issues));
    assert.ok(body.issues.length > 0);
  });
});
