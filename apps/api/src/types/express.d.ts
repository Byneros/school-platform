import type { JwtPayload } from "./auth";

declare global {
  namespace Express {
    interface Request {
      auth: JwtPayload;
      userId: string;
      role: JwtPayload["role"];
      schoolId: string | null;
      validated: unknown;
    }
  }
}

export {};
