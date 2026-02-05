import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { verifyUser } from "@/infra/auth/auth.ts";
import { MissingTokenError } from "@/shared/errors.ts";

export function validatePayload<T extends z.ZodType>(schema: T) {
  return function (req: Request, _res: Response, next: NextFunction) {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      next(parsed.error);
    }

    req.validated = parsed.data as z.infer<T>;
    return next();
  };
}

export async function validateUser(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new MissingTokenError("Missing or invalid Authorization header"));
  }

  const jwt = authHeader.split(" ")[1];
  if (!jwt) {
    return next(new MissingTokenError("Token missing from Authorization header"));
  }

  const user = await verifyUser(jwt);
  req.user = user;
  next();
}
