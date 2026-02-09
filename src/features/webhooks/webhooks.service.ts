import type Stripe from "stripe";
import type { Request } from "express";
import stripe from "@/infra/payments/payments.client";
import { config } from "@/infra/config/config";
import { NoValidStripeSignatureError } from "@/shared/errors";
import logger from "@/infra/logger/logger";
import { transactionService } from "@/features/transactions/transaction.service";
import { poolService } from "@/features/pool/pool.service";

const STRIPE_SIGNATURE_HEADER = "stripe-signature";

class WebhookService {
  /**
   * Verifies the Stripe webhook signature and returns the parsed event.
   * @throws {NoValidStripeSignatureError} when signature is missing or verification fails
   */
  private verifyAndParse(req: Request): Stripe.Event {
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
      throw new NoValidStripeSignatureError(
        "Webhook signature verification failed",
        error as Error,
      );
    }
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info("PaymentIntent succeeded", {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata,
        });
        await transactionService.updateStatusByStripeId(paymentIntent.id, "succeeded");
        await poolService.addStake(paymentIntent.amount);
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.warn("PaymentIntent failed", {
          paymentIntentId: paymentIntent.id,
          lastPaymentError: paymentIntent.last_payment_error,
        });
        await transactionService.updateStatusByStripeId(paymentIntent.id, "failed");
        break;
      }
      default:
        logger.debug("Unhandled Stripe event type", { type: event.type });
    }
  }

  async handleWebhook(req: Request): Promise<void> {
    const event = this.verifyAndParse(req);
    await this.handleEvent(event);
  }
}

export const webhookService = new WebhookService();
