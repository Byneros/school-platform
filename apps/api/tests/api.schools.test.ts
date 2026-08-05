import test from "node:test";
import assert from "node:assert/strict";

import { withServer } from "./helpers/testServer.js";
import { authToken } from "./helpers/auth.js";
import { apiGet, apiPost, apiPatch } from "./helpers/request.js";
import { createSchoolPayload } from "./helpers/schoolFactory.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

test("GET /api/schools con rol ADMIN responde 403", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("ADMIN");

    const res = await apiGet(baseUrl, token, "/api/schools");

    const body = (await res.json()) as { error?: string };

    assert.equal(res.status, 403);
    assert.equal(body.error, "Forbidden");
  });
});

test("GET /api/schools con rol TEACHER responde 403", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("TEACHER");

    const res = await apiGet(baseUrl, token, "/api/schools");

    const body = (await res.json()) as { error?: string };

    assert.equal(res.status, 403);
    assert.equal(body.error, "Forbidden");
  });
});

test("GET /api/schools con rol PARENT responde 403", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("PARENT");

    const res = await apiGet(baseUrl, token, "/api/schools");

    const body = (await res.json()) as { error?: string };

    assert.equal(res.status, 403);
    assert.equal(body.error, "Forbidden");
  });
});

test("GET /api/schools con rol SUPER_ADMIN responde 200", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const res = await apiGet(baseUrl, token, "/api/schools");

    assert.equal(res.status, 200);

    const body = (await res.json()) as unknown[];

    assert.ok(Array.isArray(body));
  });
});

test("POST /api/schools crea un colegio correctamente", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const payload = createSchoolPayload();

    const res = await apiPost(baseUrl, token, "/api/schools", payload);

    assert.equal(res.status, 201);

    const body = (await res.json()) as {
      school: {
        code: string;
        name: string;
      };
      admin: {
        fullName: string;
        role: string;
      };
    };

    assert.ok(body.school);
    assert.ok(body.admin);

    assert.equal(body.school.code, payload.school.code);
    assert.equal(body.school.name, payload.school.name);

    assert.equal(body.admin.fullName, payload.admin.fullName);
    assert.equal(body.admin.role, "ADMIN");
  });
});

test("POST /api/schools rechaza código duplicado", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const payload = createSchoolPayload();

    // Primera creación
    const first = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    assert.equal(first.status, 201);

    // Segunda creación con el mismo código
    const second = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    assert.equal(second.status, 409);

    const body = (await second.json()) as {
      message: string;
    };

    assert.equal(body.message, "Ya existe un colegio con ese código.");
  });
});

test("POST /api/schools rechaza correo de administrador duplicado", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const payload1 = createSchoolPayload();
    const payload2 = createSchoolPayload();

    // Mantenemos el mismo correo del administrador
    payload2.admin.email = payload1.admin.email;

    // El código del colegio debe ser diferente
    payload2.school.code = `${payload2.school.code}-2`;

    const first = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload1),
    });

    assert.equal(first.status, 201);

    const second = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload2),
    });

    assert.equal(second.status, 409);

    const body = (await second.json()) as {
      message: string;
    };

    assert.equal(body.message, "Ya existe un usuario con ese correo electrónico.");
  });
});

test("PATCH /api/schools actualiza un colegio correctamente", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const payload = createSchoolPayload();

    // Crear colegio
    const created = await apiPost(baseUrl, token, "/api/schools", payload);

    assert.equal(created.status, 201);

    const createdBody = (await created.json()) as {
      school: {
        id: string;
      };
    };

    // Actualizar colegio
    const updated = await apiPatch(baseUrl, token, `/api/schools/${createdBody.school.id}`, {
      name: "Colegio Actualizado",
      website: "https://actualizado.edu",
    });

    assert.equal(updated.status, 200);

    const body = (await updated.json()) as {
      name: string;
      website: string;
    };

    assert.equal(body.name, "Colegio Actualizado");
    assert.equal(body.website, "https://actualizado.edu");
  });
});

test("GET /api/schools/:id devuelve un colegio existente", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const payload = createSchoolPayload();

    const created = await apiPost(baseUrl, token, "/api/schools", payload);

    assert.equal(created.status, 201);

    const createdBody = (await created.json()) as {
      school: {
        id: string;
      };
    };

    const response = await apiGet(baseUrl, token, `/api/schools/${createdBody.school.id}`);

    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      id: string;
      code: string;
      name: string;
    };

    assert.equal(body.id, createdBody.school.id);
    assert.equal(body.code, payload.school.code);
    assert.equal(body.name, payload.school.name);
  });
});

test("GET /api/schools/:id responde 404 cuando el colegio no existe", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const response = await apiGet(baseUrl, token, "/api/schools/cmxxxxxxxxxxxxxxxxxxxxxxxx");

    assert.equal(response.status, 404);

    const body = (await response.json()) as {
      error: string;
    };

    assert.equal(body.error, "School not found");
  });
});

test("PATCH /api/schools/:id responde 404 cuando el colegio no existe", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const response = await apiPatch(baseUrl, token, "/api/schools/cmxxxxxxxxxxxxxxxxxxxxxxxx", {
      name: "Colegio Inexistente",
    });

    assert.equal(response.status, 404);

    const body = (await response.json()) as {
      message?: string;
      error?: string;
    };

    assert.ok(body.message === "School not found" || body.error === "School not found");
  });
});

test("PATCH /api/schools valida los datos enviados", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("SUPER_ADMIN");

    const payload = createSchoolPayload();

    const created = await apiPost(baseUrl, token, "/api/schools", payload);

    assert.equal(created.status, 201);

    const createdBody = (await created.json()) as {
      school: {
        id: string;
      };
    };

    const response = await apiPatch(baseUrl, token, `/api/schools/${createdBody.school.id}`, {
      name: "A",
    });

    assert.equal(response.status, 400);

    const body = (await response.json()) as {
      error?: string;
      issues?: unknown[];
      message?: string;
    };

    assert.ok(body.error === "Validation error" || body.message !== undefined);
  });
});

test("PATCH /api/schools con rol TEACHER responde 403", async () => {
  await withServer(async (baseUrl) => {
    const token = authToken("TEACHER");

    const response = await apiPatch(baseUrl, token, "/api/schools/cmxxxxxxxxxxxxxxxxxxxxxxxx", {
      name: "Nuevo Nombre",
    });

    assert.equal(response.status, 403);

    const body = (await response.json()) as {
      error?: string;
    };

    assert.equal(body.error, "Forbidden");
  });
});
