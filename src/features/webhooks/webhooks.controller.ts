import Stripe from "stripe";
import type { Request, Response } from "express";
import stripe from "@/infra/payments/payments.client";
import { config } from "@/infra/config/config";
import { NoValidStripeSignatureError } from "@/shared/errors";
import logger from "@/infra/logger/logger";

const STRIPE_SIGNATURE_HEADER = "stripe-signature";

/**
 * Verifies the Stripe webhook signature and returns the parsed event.
 * @throws {NoValidStripeSignatureError} when signature is missing or verification fails
 */
function verifyStripeWebhook(req: Request): Stripe.Event {
  const signature = req.headers[STRIPE_SIGNATURE_HEADER];

  if (typeof signature !== "string") {
    logger.warn("Webhook received without stripe-signature header");
    throw new NoValidStripeSignatureError("Missing or invalid stripe-signature header");
  }

  try {
    return stripe.webhooks.constructEvent(
      req.body as Buffer | string,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Webhook signature verification failed", { message });
    throw new NoValidStripeSignatureError("Webhook signature verification failed", error as Error);
  }
}

/**
 * Handles a verified Stripe event by type
 */
function handleEventByType(event: Stripe.Event): void {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      logger.info("PaymentIntent succeeded", {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        metadata: paymentIntent.metadata,
      });
      // TODO: insert stake transaction, update pool using paymentIntent.metadata.commitmentId / userId
      break;
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      logger.warn("PaymentIntent failed", {
        paymentIntentId: paymentIntent.id,
        lastPaymentError: paymentIntent.last_payment_error,
      });
      break;
    }
    default:
      logger.debug("Unhandled Stripe event type", { type: event.type });
  }
}

export const WebhookController = {
  async handleStripeEvent(req: Request, res: Response): Promise<void> {
    const event = verifyStripeWebhook(req);
    handleEventByType(event);
    res.sendStatus(200);
  },
};
