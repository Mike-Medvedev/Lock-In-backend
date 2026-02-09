import type { Request, Response, NextFunction } from "express";
import { transactionService } from "./transaction.service";
import { validateIdParams } from "@/shared/validators";

export const TransactionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await transactionService.list(req.user!.id);
      res.success(data);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      const data = await transactionService.getById(id, req.user!.id);
      res.success(data);
    } catch (error) {
      next(error);
    }
  },
};
