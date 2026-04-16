export const APP_ROLES = ["ADMIN", "TEACHER", "PARENT", "DEVELOPER"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return APP_ROLES.includes(String(value || "").toUpperCase() as AppRole);
}

export function isDeveloperRole(role: unknown): role is "DEVELOPER" {
  return String(role || "").toUpperCase() === "DEVELOPER";
}

export function hasRequiredRole(role: unknown, allowedRoles: AppRole[]) {
  if (!isAppRole(role)) return false;
  if (isDeveloperRole(role) && !allowedRoles.includes("DEVELOPER")) {
    return true;
  }
  return allowedRoles.includes(role);
}

export function canManageDeveloperUsers(role: unknown) {
  return isDeveloperRole(role);
}

export function canViewDeveloperUsers(role: unknown) {
  return isDeveloperRole(role);
}
