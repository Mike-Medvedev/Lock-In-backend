import { DrizzleQueryError } from "drizzle-orm/errors";
import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { DatabaseError, UnknownError, ZodError } from "../errors/errors.ts";
import z from "zod";

const errorHandler: ErrorRequestHandler = function (
  error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof DrizzleQueryError || error instanceof DatabaseError) {
    const databaseError = error instanceof DatabaseError ? error : new DatabaseError(error);
    req.log.error(databaseError);

    if (databaseError?.code === "23505") {
      return res.sendStatus(409);
    }
    return res.sendStatus(500);
  } else if (error instanceof ZodError) {
    req.log.error(error);
    return res.status(422).json({ detail: z.treeifyError(error) });
  } else {
    const unknownError = new UnknownError(error);
    req.log.error(unknownError);
    return res.sendStatus(500);
  }
};
export default errorHandler;
