import express from "express";
import { TypedRouter } from "meebo";
import { CommitmentController } from "./commitment.controller";
import { validateUser } from "@/middleware/auth.middleware";
import {
  CancelPreviewModel,
  CancelResultModel,
  CommitmentModel,
  CommitmentsArray,
  CreateCommitmentModel,
  UpdateCommitmentModel,
} from "./commitment.model";
import { IdParamsSchema } from "@/shared/validators";
import { ErrorSchema, SuccessSchema } from "@/shared/api-responses";
import z from "zod";

const CommitmentRouter = TypedRouter(express.Router(), {
  tag: "Commitments",
  basePath: "/api/v1/commitments",
});

CommitmentRouter.use(validateUser);

CommitmentRouter.get(
  "/",
  {
    responses: {
      200: SuccessSchema(CommitmentsArray),
      400: ErrorSchema,
      401: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "List all commitments",
  },
  CommitmentController.getCommitments,
);

CommitmentRouter.get(
  "/active",
  {
    response: SuccessSchema(CommitmentsArray),
    summary: "List active commitments",
    description: "Returns all commitments with status 'active' for the authenticated user",
  },
  CommitmentController.getActiveCommitments,
);

CommitmentRouter.get(
  "/:id",
  {
    params: IdParamsSchema,
    responses: {
      200: SuccessSchema(CommitmentModel),
      400: ErrorSchema,
    },
    summary: "Get commitment by ID",
  },
  CommitmentController.getCommitment,
);

CommitmentRouter.post(
  "/",
  {
    request: CreateCommitmentModel,
    response: SuccessSchema(CommitmentModel),
    summary: "Create a new commitment",
  },
  CommitmentController.createCommitment,
);

CommitmentRouter.patch(
  "/:id",
  {
    params: IdParamsSchema,
    request: UpdateCommitmentModel,
    response: SuccessSchema(CommitmentModel),
    summary: "Update a commitment",
  },
  CommitmentController.updateCommitment,
);

CommitmentRouter.get(
  "/:id/cancel",
  {
    params: IdParamsSchema,
    response: SuccessSchema(CancelPreviewModel),
    summary: "Preview commitment cancellation",
    description: "Returns what will happen if the commitment is cancelled (refund or forfeit)",
  },
  CommitmentController.getCancelPreview,
);

CommitmentRouter.post(
  "/:id/cancel",
  {
    params: IdParamsSchema,
    response: SuccessSchema(CancelResultModel),
    summary: "Cancel a commitment",
    description: "Cancels the commitment. Refunds if within grace period, forfeits stake if not.",
  },
  CommitmentController.cancelCommitment,
);

CommitmentRouter.delete(
  "/:id",
  {
    params: IdParamsSchema,
    response: SuccessSchema(z.number()),
    summary: "Delete a commitment",
  },
  CommitmentController.deleteCommitment,
);

export default CommitmentRouter;
