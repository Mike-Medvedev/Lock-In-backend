import type { Request, Response, NextFunction } from "express";
import { commitmentSessionService } from "./commitment-sessions.service";
import type { CreateCommitmentSession } from "./commitment-sessions.model";
import { validateIdParams } from "@/shared/validators";

export const CommitmentSessionsController = {
  async getSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const sessions = await commitmentSessionService.getSessions(req.user!.id);
      res.success(sessions);
    } catch (error) {
      next(error);
    }
  },

  async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      const session = await commitmentSessionService.getSession(id, req.user!.id);
      res.success(session);
    } catch (error) {
      next(error);
    }
  },

  async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const body = req.body as CreateCommitmentSession;
      const session = await commitmentSessionService.createSession(userId, body);
      res.success(session, 201);
    } catch (error) {
      next(error);
    }
  },

  async completeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      const session = await commitmentSessionService.completeSession(id, req.user!.id);
      res.success(session);
    } catch (error) {
      next(error);
    }
  },

  async cancelSession(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      const session = await commitmentSessionService.cancelSession(id, req.user!.id);
      res.success(session);
    } catch (error) {
      next(error);
    }
  },

  async pauseSession(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      const session = await commitmentSessionService.pauseSession(id, req.user!.id);
      res.success(session);
    } catch (error) {
      next(error);
    }
  },

  async resumeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      const session = await commitmentSessionService.resumeSession(id, req.user!.id);
      res.success(session);
    } catch (error) {
      next(error);
    }
  },

  async verifySession(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validateIdParams(req.params);
      await commitmentSessionService.verifySession(id, req.user!.id);
      res.success("Submitted Session for Verification", 202);
    } catch (error) {
      next(error);
    }
  },

  async getSessionsByCommitment(req: Request, res: Response, next: NextFunction) {
    try {
      const commitmentId = validateIdParams(req.params);
      const sessions = await commitmentSessionService.getSessionsByCommitmentId(
        commitmentId,
        req.user!.id,
      );
      res.success(sessions);
    } catch (error) {
      next(error);
    }
  },
};
