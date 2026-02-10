import type { Request, Response, NextFunction } from "express";
import { cronService } from "./cron.service";
import logger from "@/infra/logger/logger";

export const CronController = {
  async forfeitExpired(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info("Cron: forfeit-expired job started");
      const results = await cronService.forfeitExpiredCommitments();
      res.success({
        forfeitedCount: results.length,
        commitments: results,
      });
    } catch (error) {
      next(error);
    }
  },
};
