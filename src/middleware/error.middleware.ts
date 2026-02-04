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
  if (error instanceof DrizzleQueryError) {
    const databaseError = new DatabaseError(error);
    if (databaseError?.code === "23505") {
      req.log.error({ message: databaseError.message, err: databaseError });
      return res.sendStatus(409);
    }
    if (databaseError?.code === "ECONNREFUSED") {
      req.log.error({
        message: "database refused to connect, retry not setup",
        err: databaseError,
      });
      return res.sendStatus(500);
    } else {
      req.log.error({ message: "database error", err: databaseError });
      return res.sendStatus(500);
    }
  } else if (error instanceof ZodError) {
    req.log.error({
      message: "Zod validation error see trace for details",
      err: { stack: error.stack },
    });

    return res.status(422).json({ detail: z.treeifyError(error) });
  } else {
    const unknownError = new UnknownError(error);
    req.log.error({ message: unknownError.message, err: unknownError });
  }
  return res.sendStatus(500);
};
export default errorHandler;
