import type { Request } from "express";
import type { JwtPayload } from "./auth";

export interface ValidatedData<TBody = unknown, TParams = unknown, TQuery = unknown> {
  body: TBody;
  params: TParams;
  query: TQuery;
}

export interface ValidatedRequest<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
> extends Request {
  validated: ValidatedData<TBody, TParams, TQuery>;
}

export interface AuthenticatedValidatedRequest<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
> extends ValidatedRequest<TBody, TParams, TQuery> {
  auth: JwtPayload;
}
