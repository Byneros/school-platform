const API_URL = "https://school-platform-z8f4.onrender.com/api";
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

export class ApiError extends Error {
  status: number;
  requestId: string | null;
  path: string | null;

  constructor(message: string, status: number, requestId: string | null = null, path: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.path = path;
  }
}

async function toApiError(res: Response, fallback = "Request failed", path: string | null = null) {
  const requestIdHeader = res.headers.get("x-request-id");
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await res.json();
      const message = body?.message || body?.error;
      const requestId = body?.requestId || requestIdHeader || null;
      if (message) return new ApiError(String(message), res.status, requestId, path);
    } else {
      const text = await res.text();
      if (text) return new ApiError(text, res.status, requestIdHeader || null, path);
    }
  } catch {
    // ignore parse issues and use fallback
  }
  return new ApiError(fallback, res.status, requestIdHeader || null, path);
}

function getToken() {
  try {
    const raw = localStorage.getItem("school.auth");
    if (!raw) return "";
    const data = JSON.parse(raw);
    return data.token || "";
  } catch {
    return "";
  }
}

type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

function buildHeaders(withJson: boolean) {
  const token = getToken();
  return {
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(path: string, method: RequestMethod, body?: unknown) {
  const withJson = body !== undefined;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${normalizedPath}`, {
      method,
      headers: buildHeaders(withJson),
      signal: controller.signal,
      credentials: "include",
      ...(withJson ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. Verifica que la API este ejecutandose.",
      0,
      null,
      normalizedPath
    );
  } finally {
    window.clearTimeout(timeout);
  }
  if (!res.ok) throw await toApiError(res, "Request failed", normalizedPath);
  return res;
}

export async function apiGet(path: string) {
  const res = await request(path, "GET");
  if (res.status === 204) return null;
  return res.json();
}

export async function apiPost(path: string, body: any) {
  const res = await request(path, "POST", body);
  return res.json();
}

export async function apiPatch(path: string, body: any) {
  const res = await request(path, "PATCH", body);
  return res.json();
}

export async function apiPut(path: string, body: any) {
  const res = await request(path, "PUT", body);
  return res.json();
}

export async function apiDownload(path: string) {
  const res = await request(path, "GET");
  return res.blob();
}

export async function apiDelete(path: string) {
  const res = await request(path, "DELETE");
  if (res.status === 204) return null;
  return res.json();
}
