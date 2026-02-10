import type { Request, Response, NextFunction } from "express";
import { config } from "@/infra/config/config";
import logger from "@/infra/logger/logger";

/**
 * Validates that the request includes the correct CRON_SECRET.
 * Protects cron endpoints from unauthorized access.
 *
 * The secret is sent via: Authorization: Bearer <secret>
 */
export function validateCronSecret(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

  if (!token || token !== config.CRON_SECRET) {
    logger.warn("Cron: Unauthorized request attempted", {
      ip: req.ip,
      path: req.path,
    });
    res.error(401, new Error("Unauthorized, Missing Token"));
    return;
  }

  next();
}
