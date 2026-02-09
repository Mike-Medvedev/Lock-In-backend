import type { Request, Response, NextFunction } from "express";
import { poolService } from "./pool.service";

export const PoolController = {
  async get(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await poolService.get();
      res.success(data);
    } catch (error) {
      next(error);
    }
  },
};
