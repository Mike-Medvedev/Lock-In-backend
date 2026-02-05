import { DrizzleQueryError } from "drizzle-orm/errors";
import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { DatabaseError, MissingTokenError, ZodError } from "../errors/errors.ts";
import z from "zod";
import { AuthError } from "@supabase/supabase-js";

const errorHandler: ErrorRequestHandler = function (
  error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof MissingTokenError) {
    req.log.error(error);
    return res.status(401).json({ error: error.message });
  }

  if (error instanceof DrizzleQueryError || error instanceof DatabaseError) {
    const databaseError = error instanceof DatabaseError ? error : new DatabaseError(error);
    req.log.error(databaseError);

    if (databaseError?.code === "23505") {
      return res.sendStatus(409);
    }
    return res.sendStatus(500);
  }

  if (error instanceof AuthError) {
    req.log.error(error);
    return res.status(401).json({ error: error.message });
  }

  if (error instanceof ZodError) {
    req.log.error(error);
    return res.status(422).json({ detail: z.treeifyError(error) });
  }

  req.log.error(error);
  return res.sendStatus(500);
};
export default errorHandler;
