import express from "express";
import { TypedRouter } from "meebo";
import { CommitmentSessionsController } from "./commitment-sessions.controller";
import { SessionSampleController } from "@/features/session-samples/session-sample.controller";
import { validateUser } from "@/middleware/auth.middleware";
import {
  CommitmentSessionModel,
  CommitmentSessionsArray,
  CreateCommitmentSessionModel,
} from "./commitment-sessions.model";
import {
  BatchSamplesModel,
  BatchSamplesResponseModel,
  GetSamplesResponseModel,
} from "@/features/session-samples/session-sample.model";
import { IdParamsSchema } from "@/shared/validators";
import { ErrorSchema, SuccessSchema } from "@/shared/api-responses";

const CommitmentSessionsRouter = TypedRouter(express.Router(), {
  tag: "Commitment Sessions",
  basePath: "/api/v1/commitment-sessions",
});

CommitmentSessionsRouter.use(validateUser);

CommitmentSessionsRouter.get(
  "/",
  {
    responses: {
      200: SuccessSchema(CommitmentSessionsArray),
      400: ErrorSchema,
      401: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "List all commitment sessions",
  },
  CommitmentSessionsController.getSessions,
);

CommitmentSessionsRouter.get(
  "/:id",
  {
    params: IdParamsSchema,
    responses: {
      200: SuccessSchema(CommitmentSessionModel),
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Get commitment session by ID",
  },
  CommitmentSessionsController.getSession,
);

CommitmentSessionsRouter.post(
  "/",
  {
    request: CreateCommitmentSessionModel,
    response: SuccessSchema(CommitmentSessionModel),
    responses: {
      201: SuccessSchema(CommitmentSessionModel),
      400: ErrorSchema,
      401: ErrorSchema,
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Create a commitment session",
  },
  CommitmentSessionsController.createSession,
);

CommitmentSessionsRouter.post(
  "/:id/complete",
  {
    params: IdParamsSchema,
    response: SuccessSchema(CommitmentSessionModel),
    responses: {
      200: SuccessSchema(CommitmentSessionModel),
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Complete a session: ends recording and marks verification as pending",
  },
  CommitmentSessionsController.completeSession,
);

CommitmentSessionsRouter.post(
  "/:id/cancel",
  {
    params: IdParamsSchema,
    response: SuccessSchema(CommitmentSessionModel),
    responses: {
      200: SuccessSchema(CommitmentSessionModel),
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Cancel a session (from in_progress or paused)",
  },
  CommitmentSessionsController.cancelSession,
);

CommitmentSessionsRouter.post(
  "/:id/pause",
  {
    params: IdParamsSchema,
    response: SuccessSchema(CommitmentSessionModel),
    responses: {
      200: SuccessSchema(CommitmentSessionModel),
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Pause a session (only from in_progress)",
  },
  CommitmentSessionsController.pauseSession,
);

CommitmentSessionsRouter.post(
  "/:id/resume",
  {
    params: IdParamsSchema,
    response: SuccessSchema(CommitmentSessionModel),
    responses: {
      200: SuccessSchema(CommitmentSessionModel),
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Resume a paused session back to in_progress",
  },
  CommitmentSessionsController.resumeSession,
);

CommitmentSessionsRouter.post(
  "/:id/verify",
  {
    params: IdParamsSchema,
    response: SuccessSchema(CommitmentSessionModel),
    responses: {
      200: SuccessSchema(CommitmentSessionModel),
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Verify a completed session: runs fraud checks and updates verification status",
  },
  CommitmentSessionsController.verifySession,
);

// ── Session samples (GPS + motion data) ──────────────────────────────

CommitmentSessionsRouter.post(
  "/:id/samples",
  {
    params: IdParamsSchema,
    request: BatchSamplesModel,
    response: SuccessSchema(BatchSamplesResponseModel),
    responses: {
      201: SuccessSchema(BatchSamplesResponseModel),
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Batch upload GPS + motion sensor samples for a live session",
  },
  SessionSampleController.ingestSamples,
);

CommitmentSessionsRouter.get(
  "/:id/samples",
  {
    params: IdParamsSchema,
    responses: {
      200: SuccessSchema(GetSamplesResponseModel),
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Get all samples for a session",
  },
  SessionSampleController.getSamples,
);

export default CommitmentSessionsRouter;
