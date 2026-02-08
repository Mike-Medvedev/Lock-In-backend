import express from "express";
import { TypedRouter } from "meebo";
import { CommitmentSessionsController } from "./commitment-sessions.controller";
import { validateUser } from "@/middleware/auth.middleware";
import {
  CommitmentSessionModel,
  CommitmentSessionsArray,
  CreateCommitmentSessionModel,
  UpdateCommitmentSessionStatusModel,
} from "./commitment-sessions.model";
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

CommitmentSessionsRouter.patch(
  "/:id",
  {
    params: IdParamsSchema,
    request: UpdateCommitmentSessionStatusModel,
    response: SuccessSchema(CommitmentSessionModel),
    responses: {
      200: SuccessSchema(CommitmentSessionModel),
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Update commitment session status",
  },
  CommitmentSessionsController.updateSessionStatus,
);

CommitmentSessionsRouter.post(
  "/:id/complete",
  {
    params: IdParamsSchema,
    response: SuccessSchema(CommitmentSessionModel),
    responses: {
      200: SuccessSchema(CommitmentSessionModel),
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Complete a commitment session",
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
      401: ErrorSchema,
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Cancel a commitment session",
  },
  CommitmentSessionsController.cancelSession,
);

export default CommitmentSessionsRouter;
