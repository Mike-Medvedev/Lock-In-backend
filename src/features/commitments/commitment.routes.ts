import express from "express";
import { TypedRouter } from "meebo";
import { CommitmentController } from "./commitment.controller";
import { validateUser } from "@/middleware/auth.middleware";
import {
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
  basePath: "/commitments",
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

CommitmentRouter.delete(
  "/:id",
  {
    params: IdParamsSchema,
    response: z.number(),
    summary: "Delete a commitment",
  },
  CommitmentController.deleteCommitment,
);

export default CommitmentRouter;
