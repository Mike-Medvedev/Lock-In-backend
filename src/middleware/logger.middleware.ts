import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import logger from "../logger/logger.ts";

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const requestId = randomUUID();
  const method = req.method;
  const path = req.path;
  req.log = logger.child({ requestId, method, path });
  const user = { 1: 1, 2: 2 };
  req.log.info("Request received", user);

  next(new Error("poop"));
}
