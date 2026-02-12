import type Stripe from "stripe";
import type { Request } from "express";
import stripe from "@/infra/payments/payments.client";
import { config } from "@/infra/config/config";
import { MissingCommitmentIdError, NoValidStripeSignatureError } from "@/shared/errors";
import logger from "@/infra/logger/logger";
import { db } from "@/infra/db/db";
import { commitments } from "@/infra/db/schema";
import { eq } from "drizzle-orm";
import { CommitmentStatusEnum } from "@/features/commitments/commitment.model";
import { TransactionStatusEnum } from "@/features/transactions/transaction.model";
import { transactionService } from "@/features/transactions/transaction.service";
import { poolService } from "@/features/pool/pool.service";

const STRIPE_SIGNATURE_HEADER = "stripe-signature";

class WebhookService {
  /**
   * Verifies the Stripe webhook signature and returns the parsed event.
   * @throws {NoValidStripeSignatureError} when signature is missing or verification fails
   */
  verifyAndParse(req: Request): Stripe.Event {
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

  async handlePaymentConfirmation(
    paymentIntentId: string,
    paymentIntentAmount: number,
    commitmentId: string,
  ) {
    await transactionService.updateStatusByStripeId(
      paymentIntentId,
      TransactionStatusEnum.enum.succeeded,
    );
    await poolService.addStake(paymentIntentAmount);

    // Activate the commitment now that payment is confirmed

    if (commitmentId) {
      await db
        .update(commitments)
        .set({ status: CommitmentStatusEnum.enum.active })
        .where(eq(commitments.id, commitmentId));
      logger.info("Commitment activated after payment", { commitmentId });
    }
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    logger.info("Stripe webhook event received", { type: event.type, id: event.id });
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info("PaymentIntent succeeded", {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata,
        });
        const { commitmentId } = paymentIntent.metadata;
        if (!commitmentId)
          throw new MissingCommitmentIdError(
            `CommitmentId missing from stripe event with id ${event.id}`,
          );
        this.handlePaymentConfirmation(paymentIntent.id, paymentIntent.amount, commitmentId);

        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.warn("PaymentIntent failed", {
          paymentIntentId: paymentIntent.id,
          lastPaymentError: paymentIntent.last_payment_error,
        });
        await transactionService.updateStatusByStripeId(
          paymentIntent.id,
          TransactionStatusEnum.enum.failed,
        );

        // Revert commitment back to pending_payment so user can retry
        const { commitmentId } = paymentIntent.metadata;
        if (commitmentId) {
          await db
            .update(commitments)
            .set({ status: CommitmentStatusEnum.enum.pending_payment })
            .where(eq(commitments.id, commitmentId));
          logger.info("Commitment reverted to pending_payment after failed payment", {
            commitmentId,
          });
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refunds = charge.refunds?.data ?? [];
        for (const refund of refunds) {
          if (refund.status !== "succeeded") continue;
          await this.processRefund(refund);
        }
        break;
      }
      case "refund.created":
      case "refund.updated": {
        const refund = event.data.object as Stripe.Refund;
        if (refund.status !== "succeeded") break;
        await this.processRefund(refund);
        break;
      }
      default:
        logger.info("Unhandled Stripe event type", { type: event.type });
    }
  }

  private async processRefund(refund: Stripe.Refund): Promise<void> {
    const refundTx = await transactionService.getByStripeTransactionId(refund.id);
    if (!refundTx) {
      logger.warn("No refund transaction found for refund id", { refundId: refund.id });
      return;
    }
    // Skip if already processed
    if (refundTx.status === "succeeded") {
      logger.info("Refund already processed, skipping", { refundId: refund.id });
      return;
    }
    await transactionService.updateStatusByStripeId(
      refund.id,
      TransactionStatusEnum.enum.succeeded,
    );
    await poolService.subtractRefund(refundTx.amount);
    await db
      .update(commitments)
      .set({ status: CommitmentStatusEnum.enum.cancelled_refunded })
      .where(eq(commitments.id, refundTx.commitmentId));
    logger.info("Refund processed", {
      refundId: refund.id,
      commitmentId: refundTx.commitmentId,
      amount: refundTx.amount,
    });
  }
}

export const webhookService = new WebhookService();
