import express from "express";
import { TypedRouter } from "meebo";
import { WebhookController } from "./webhooks.controller";

const Webhook = TypedRouter(express.Router(), {
  tag: "Webhook",
  basePath: "/webhook",
});

Webhook.post(
  "/payments",
  {
    summary: "Stripe webhook endpoint for recieving stripe events from stripe",
    skipValidation: true,
  },
  WebhookController.handleStripeEvent,
);

export default Webhook;
