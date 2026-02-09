import type { Request, Response, NextFunction } from "express";
import { commitmentSessionService } from "@/features/commitment-sessions/commitment-sessions.service";
import { sessionSampleService } from "./session-sample.service";
import type { BatchSamples } from "./session-sample.model";
import { validateIdParams } from "@/shared/validators";

export const SessionSampleController = {
  /**
   * POST /commitment-sessions/:id/samples
   * Batch upload GPS + motion sensor data for a live session.
   * Only allowed while session is in_progress.
   */
  async ingestSamples(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = validateIdParams(req.params);
      const userId = req.user!.id;

      // Auth check + validate session is still in_progress
      const session = await commitmentSessionService.getSession(sessionId, userId);
      commitmentSessionService.validateInProgress(session);

      const body = req.body as BatchSamples;
      const result = await sessionSampleService.ingestSamples(
        sessionId,
        body.motionSamples,
        body.gpsSamples,
        body.pedometerSamples,
      );
      res.success(result, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /commitment-sessions/:id/samples
   * Retrieve all samples for a session (for debugging / review).
   */
  async getSamples(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = validateIdParams(req.params);
      const userId = req.user!.id;

      // Auth check (any session status is fine for reading)
      await commitmentSessionService.getSession(sessionId, userId);

      const [motionSamples, gpsSamples, pedometerSamples] = await Promise.all([
        sessionSampleService.getMotionSamples(sessionId),
        sessionSampleService.getGpsSamples(sessionId),
        sessionSampleService.getPedometerSamples(sessionId),
      ]);

      res.success({ motionSamples, gpsSamples, pedometerSamples });
    } catch (error) {
      next(error);
    }
  },
};
