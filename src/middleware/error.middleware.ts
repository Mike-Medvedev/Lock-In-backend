import { DrizzleQueryError } from "drizzle-orm/errors";
import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import {
  DatabaseError,
  DatabaseResourceNotFoundError,
  MissingTokenError,
  PG_ERROR_CODES,
  UnauthorizedDatabaseRequestError,
  ZodError,
} from "@/shared/errors.ts";
import z from "zod";
import { AuthError } from "@supabase/supabase-js";
import { ErrorApiResponse } from "@/shared/api-responses";

const errorHandler: ErrorRequestHandler = function (
  error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof MissingTokenError) {
    req.log.error(error);
    return res.status(401).json(ErrorApiResponse(401, error));
  }

  if (error instanceof DrizzleQueryError || error instanceof DatabaseError) {
    const databaseError = error instanceof DatabaseError ? error : new DatabaseError(error);
    req.log.error(databaseError);

    switch (databaseError?.code) {
      case PG_ERROR_CODES.UNIQUE_VIOLATION:
        return res.error(409, new Error("Resource already exists"));
      case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:
        return res.error(400, new Error("Referenced resource does not exist"));
      case PG_ERROR_CODES.CHECK_VIOLATION:
        return res.error(400, new Error("Invalid input data"));
      case PG_ERROR_CODES.NOT_NULL_VIOLATION:
        return res.error(400, new Error("Required field is missing"));
      case PG_ERROR_CODES.INTEGRITY_CONSTRAINT_VIOLATION:
        return res.error(400, new Error("Data integrity error"));
      default:
        return res.error(500, new Error("Database error"));
    }
  }

  if (error instanceof AuthError) {
    req.log.error(error);
    return res.error(401, error);
  }

  if (error instanceof ZodError) {
    req.log.error(error);
    return res.error(422, error, z.treeifyError(error));
  }
  if (error instanceof DatabaseResourceNotFoundError) {
    req.log.error(error);
    return res.error(404, error);
  }
  if (error instanceof UnauthorizedDatabaseRequestError) {
    req.log.error(error);
    return res.error(403, error);
  }

  req.log.error(error);
  return res.error(500, error);
};
export default errorHandler;
