type AuthUser = {
  token: string;
  role: "ADMIN" | "TEACHER" | "PARENT";
  fullName: string;
};

const STORAGE_KEY = "school.auth";

export function getAuth(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuth(data: AuthUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export type { AuthUser };
