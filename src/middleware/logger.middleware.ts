import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import logger from "../infra/logger.ts";

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const requestId = randomUUID();
  const method = req.method;
  const path = req.path;
  req.log = logger.child({ requestId, method, path });
  req.log.info("Request received");

  next();
}
