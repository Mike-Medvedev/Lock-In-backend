import express from "express";
import { TypedRouter } from "meebo";
import { PaymentsController } from "./payments.controller";
import { validateUser } from "@/middleware/auth.middleware";
import { ErrorSchema, SuccessSchema } from "@/shared/api-responses";
import {
  ConfirmPaymentRequestSchema,
  ConfirmPaymentResponseSchema,
  CreatePaymentRequestSchema,
  CreatePaymentResponseSchema,
} from "./payments.models";

const PaymentsRouter = TypedRouter(express.Router(), {
  tag: "Payments",
  basePath: "/api/v1/payments",
});

PaymentsRouter.use(validateUser);

PaymentsRouter.post(
  "/",
  {
    request: CreatePaymentRequestSchema,
    response: SuccessSchema(CreatePaymentResponseSchema),
    responses: {
      200: SuccessSchema(CreatePaymentResponseSchema),
      401: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Create a Payment Intent for a user",
    description:
      "Returns the Payment Intent's client secret, the Customer Session's client secret, the Customer's id, and your publishable key.",
  },
  PaymentsController.createPayment,
);
PaymentsRouter.post(
  "/confirm",
  {
    request: ConfirmPaymentRequestSchema,
    response: SuccessSchema(ConfirmPaymentResponseSchema),
    responses: {
      200: SuccessSchema(ConfirmPaymentResponseSchema),
      400: ErrorSchema,
      401: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Confirm a Payment Intent",
    description: "Confirms the Payment Intent with the given id. Returns the intent status.",
  },
  PaymentsController.confirmPayment,
);

export default PaymentsRouter;
