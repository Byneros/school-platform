import type { Request } from "express";
import type { AppRole } from "../utils/rbac.js";

export type UserRole = AppRole;

export interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  auth: JwtPayload;
}

export interface SessionUser {
  userId: string;
  role: UserRole;
}

export interface TokenResponse {
  token: string;
  expiresAt: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  role: UserRole;
  fullName: string;
  expiresAt: string | null;
}
