import express from "express";
import { TypedRouter } from "meebo";
import { TransactionController } from "./transaction.controller";
import { validateUser } from "@/middleware/auth.middleware";
import { TransactionModel, TransactionsArray } from "./transaction.model";
import { IdParamsSchema } from "@/shared/validators";
import { ErrorSchema, SuccessSchema } from "@/shared/api-responses";

const TransactionRouter = TypedRouter(express.Router(), {
  tag: "Transactions",
  basePath: "/api/v1/transactions",
});

TransactionRouter.use(validateUser);

TransactionRouter.get(
  "/",
  {
    responses: {
      200: SuccessSchema(TransactionsArray),
      401: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "List transactions for the authenticated user",
  },
  TransactionController.list,
);

TransactionRouter.get(
  "/:id",
  {
    params: IdParamsSchema,
    responses: {
      200: SuccessSchema(TransactionModel),
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Get transaction by ID",
  },
  TransactionController.getById,
);

export default TransactionRouter;
