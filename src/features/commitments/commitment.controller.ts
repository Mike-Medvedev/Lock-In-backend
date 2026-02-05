import type { Request, Response, NextFunction } from "express";
import { commitmentService } from "./commitment.service";
import type { CreateCommitment, UpdateCommitment } from "./commitment.model";
import { validateIdParams } from "@/shared/validators";

export const CommitmentController = {
  async getCommitments(req: Request, res: Response, next: NextFunction) {
    try {
      const commitments = await commitmentService.getCommitments(req.user!.id);
      res.success(commitments);
    } catch (error) {
      next(error);
    }
  },

  async getActiveCommitments(req: Request, res: Response, next: NextFunction) {
    try {
      const commitments = await commitmentService.getActiveCommitments(req.user!.id);
      res.success(commitments);
    } catch (error) {
      next(error);
    }
  },

  async getCommitment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      const commitment = await commitmentService.getCommitment(id, req.user!.id);
      res.success(commitment);
    } catch (error) {
      next(error);
    }
  },

  async createCommitment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const body = req.body as CreateCommitment;
      const commitment = await commitmentService.createCommitment(userId, body);
      res.success(commitment, 201);
    } catch (error) {
      next(error);
    }
  },

  async updateCommitment(req: Request, res: Response, next: NextFunction) {
    try {
      const commitmentId = validateIdParams(req.params);
      const body = req.body as UpdateCommitment;
      const commitment = await commitmentService.updateCommitment(commitmentId, req.user!.id, body);
      res.success(commitment);
    } catch (error) {
      next(error);
    }
  },

  async deleteCommitment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      await commitmentService.deleteCommitment(id, req.user!.id);
      res.success(true, 200);
    } catch (error) {
      next(error);
    }
  },
};
