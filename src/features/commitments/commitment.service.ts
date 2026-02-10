import { eq, and, inArray } from "drizzle-orm";
import { db, type DB } from "@/infra/db/db.ts";
import { commitments } from "@/infra/db/schema.ts";

import {
  CommitmentModel,
  CommitmentStatusEnum,
  type CancelPreview,
  type CancelResult,
  type Commitment,
  type CreateCommitment,
  type UpdateCommitment,
} from "./commitment.model.ts";
import {
  CommitmentAlreadyCancelledError,
  CommitmentAlreadyCompletedError,
  CommitmentAlreadyForfeitedError,
  CommitmentAlreadyStakedError,
  CommitmentNotActiveError,
  CommitmentPaymentPendingError,
  CommitmentRefundPendingError,
  DatabaseResourceNotFoundError,
  MultipleActiveCommitmentsError,
  UnauthorizedDatabaseRequestError,
} from "@/shared/errors.ts";
import { paymentService } from "@/features/payments/payments.service";
import { poolService } from "@/features/pool/pool.service";
import { TransactionStatusEnum } from "@/features/transactions/transaction.model";
import { transactionService } from "@/features/transactions/transaction.service";
import { payoutService } from "@/features/payouts/payout.service";
import logger from "@/infra/logger/logger";

class CommitmentService {
  constructor(private readonly _db: DB) {}

  async getCommitments(userId: string): Promise<Commitment[]> {
    const results = await this._db.select().from(commitments).where(eq(commitments.userId, userId));
    return results.map((c) => CommitmentModel.parse(c));
  }
  async getActiveCommitments(userId: string): Promise<Commitment[]> {
    const results = await this._db
      .select()
      .from(commitments)
      .where(and(eq(commitments.userId, userId), eq(commitments.status, "active")));
    return results.map((c) => CommitmentModel.parse(c));
  }

  /** Returns commitments that are in-progress (not terminal). */
  async getOngoingCommitments(userId: string): Promise<Commitment[]> {
    const results = await this._db
      .select()
      .from(commitments)
      .where(
        and(
          eq(commitments.userId, userId),
          inArray(commitments.status, ["pending_payment", "payment_processing", "active"]),
        ),
      );
    return results.map((c) => CommitmentModel.parse(c));
  }

  async getCommitment(id: string, userId: string): Promise<Commitment> {
    const [commitment] = await this._db.select().from(commitments).where(eq(commitments.id, id));

    if (!commitment) {
      throw new DatabaseResourceNotFoundError();
    }

    if (commitment.userId !== userId) {
      throw new UnauthorizedDatabaseRequestError();
    }

    return CommitmentModel.parse(commitment);
  }

  async createCommitment(userId: string, input: CreateCommitment): Promise<Commitment> {
    // user cannot have more than 1 ongoing commitment
    if ((await this.getOngoingCommitments(userId)).length >= 1) {
      throw new MultipleActiveCommitmentsError();
    }

    const [commitment] = await this._db
      .insert(commitments)
      .values({
        ...input,
        userId,
        status: "pending_payment",
      })
      .returning();

    logger.info("Commitment created", { commitmentId: commitment?.id, userId });

    return CommitmentModel.parse(commitment);
  }

  async updateCommitment(
    commitmentId: string,
    userId: string,
    input: UpdateCommitment,
  ): Promise<Commitment> {
    await this.getCommitment(commitmentId, userId);

    const [updated] = await this._db
      .update(commitments)
      .set(input)
      .where(eq(commitments.id, commitmentId))
      .returning();

    logger.info("Commitment updated", { commitmentId, userId });

    return CommitmentModel.parse(updated);
  }

  async getCancelPreview(commitmentId: string, userId: string): Promise<CancelPreview> {
    const commitment = await this.getCommitment(commitmentId, userId);
    this.validateCancellable(commitment);

    // No payment yet — free cancel
    if (commitment.status === CommitmentStatusEnum.enum.pending_payment) {
      return {
        id: commitment.id,
        cancellable: true,
        refundable: false,
        forfeitAmount: 0,
        stakeAmount: commitment.stakeAmount,
        gracePeriodEndsAt: commitment.gracePeriodEndsAt,
      };
    }

    const refundable = this.isRefundable(commitment);

    return {
      id: commitment.id,
      cancellable: true,
      refundable,
      forfeitAmount: refundable ? 0 : commitment.stakeAmount,
      stakeAmount: commitment.stakeAmount,
      gracePeriodEndsAt: commitment.gracePeriodEndsAt,
    };
  }

  async cancelCommitment(commitmentId: string, userId: string): Promise<CancelResult> {
    const commitment = await this.getCommitment(commitmentId, userId);
    this.validateCancellable(commitment);

    // No payment yet — just cancel, nothing to refund or forfeit
    if (commitment.status === CommitmentStatusEnum.enum.pending_payment) {
      await this._db
        .update(commitments)
        .set({ status: CommitmentStatusEnum.enum.cancelled })
        .where(eq(commitments.id, commitmentId));

      logger.info("Commitment cancelled (no payment)", { commitmentId, userId });

      return {
        id: commitment.id,
        refunded: false,
        forfeitedAmount: 0,
        status: CommitmentStatusEnum.enum.cancelled,
      };
    }

    const stake = await transactionService.findStakeByCommitmentId(commitmentId);

    // If no stake or stake never succeeded, nothing to refund/forfeit — just cancel
    if (!stake || stake.status !== "succeeded") {
      await this._db
        .update(commitments)
        .set({ status: CommitmentStatusEnum.enum.cancelled })
        .where(eq(commitments.id, commitmentId));

      logger.info("Commitment cancelled (no successful stake)", { commitmentId, userId });

      return {
        id: commitment.id,
        refunded: false,
        forfeitedAmount: 0,
        status: CommitmentStatusEnum.enum.cancelled,
      };
    }

    const refundable = this.isRefundable(commitment);

    if (refundable) {
      const refund = await paymentService.createRefund(stake.stripeTransactionId);
      await transactionService.create({
        userId,
        commitmentId,
        stripeTransactionId: refund.id,
        stripeCustomerId: stake.stripeCustomerId,
        amount: refund.amount,
        transactionType: "refund",
      });

      await this._db
        .update(commitments)
        .set({ status: CommitmentStatusEnum.enum.refund_pending })
        .where(eq(commitments.id, commitmentId));

      logger.info("Commitment cancelled with refund", {
        commitmentId,
        userId,
        refundId: refund.id,
      });

      return {
        id: commitment.id,
        refunded: true,
        forfeitedAmount: 0,
        status: CommitmentStatusEnum.enum.refund_pending,
      };
    } else {
      const forfeitTxId = `forfeit_${commitmentId}`;
      await transactionService.create({
        userId,
        commitmentId,
        stripeTransactionId: forfeitTxId,
        stripeCustomerId: stake.stripeCustomerId,
        amount: commitment.stakeAmount,
        transactionType: "forfeit",
      });
      await transactionService.updateStatusByStripeId(
        forfeitTxId,
        TransactionStatusEnum.enum.succeeded,
      );
      await poolService.addForfeit(commitment.stakeAmount);
      await this._db
        .update(commitments)
        .set({ status: CommitmentStatusEnum.enum.forfeited })
        .where(eq(commitments.id, commitmentId));

      logger.info("Commitment cancelled with forfeit", {
        commitmentId,
        userId,
        forfeitedAmount: commitment.stakeAmount,
      });

      return {
        id: commitment.id,
        refunded: false,
        forfeitedAmount: commitment.stakeAmount,
        status: CommitmentStatusEnum.enum.forfeited,
      };
    }
  }

  async deleteCommitment(id: string, userId: string): Promise<void> {
    await this.getCommitment(id, userId);

    await this._db.delete(commitments).where(eq(commitments.id, id));

    logger.info("Commitment deleted", { commitmentId: id, userId });
  }

  /**
   * Called when all required sessions for the commitment have been verified.
   * Validates the commitment is completable, delegates payout to PayoutService,
   * and marks the commitment as completed.
   */
  async completeCommitment(commitmentId: string, userId: string): Promise<Commitment> {
    const commitment = await this.getCommitment(commitmentId, userId);
    this.validateCompletable(commitment);

    // ── Delegate payout to dedicated service ─────────────────────
    await payoutService.issueCompletionPayout(commitment, userId);

    // ── Mark commitment as completed ─────────────────────────────
    const [updated] = await this._db
      .update(commitments)
      .set({ status: CommitmentStatusEnum.enum.completed })
      .where(eq(commitments.id, commitmentId))
      .returning();

    logger.info("Commitment completed", { commitmentId, userId });

    return CommitmentModel.parse(updated);
  }

  /** Validates that a commitment can be completed (must be active). */
  private validateCompletable(commitment: Commitment): void {
    switch (commitment.status) {
      case CommitmentStatusEnum.enum.active:
        return; // Only active commitments can be completed
      case CommitmentStatusEnum.enum.completed:
        throw new CommitmentAlreadyCompletedError();
      case CommitmentStatusEnum.enum.cancelled:
      case CommitmentStatusEnum.enum.cancelled_refunded:
        throw new CommitmentAlreadyCancelledError();
      case CommitmentStatusEnum.enum.forfeited:
        throw new CommitmentAlreadyForfeitedError();
      case CommitmentStatusEnum.enum.pending_payment:
      case CommitmentStatusEnum.enum.payment_processing:
        throw new CommitmentNotActiveError();
      case CommitmentStatusEnum.enum.refund_pending:
        throw new CommitmentRefundPendingError();
    }
  }

  /**
   * Validates that a commitment can accept a new stake payment.
   * The commitment must be "pending_payment" and must not already have a pending/succeeded stake.
   */
  async validateStakeable(commitmentId: string, userId: string): Promise<Commitment> {
    const commitment = await this.getCommitment(commitmentId, userId);

    // Only pending_payment commitments can be staked
    switch (commitment.status) {
      case CommitmentStatusEnum.enum.payment_processing:
        throw new CommitmentPaymentPendingError();
      case CommitmentStatusEnum.enum.active:
        throw new CommitmentAlreadyStakedError();
      case CommitmentStatusEnum.enum.cancelled:
      case CommitmentStatusEnum.enum.cancelled_refunded:
        throw new CommitmentAlreadyCancelledError();
      case CommitmentStatusEnum.enum.forfeited:
        throw new CommitmentAlreadyForfeitedError();
      case CommitmentStatusEnum.enum.completed:
        throw new CommitmentAlreadyCompletedError();
      case CommitmentStatusEnum.enum.refund_pending:
        throw new CommitmentRefundPendingError();
    }

    return commitment;
  }

  private isRefundable(commitment: Commitment): boolean {
    return new Date() < commitment.gracePeriodEndsAt;
  }

  private validateCancellable(commitment: Commitment): void {
    switch (commitment.status) {
      case CommitmentStatusEnum.enum.payment_processing:
        throw new CommitmentPaymentPendingError();
      case CommitmentStatusEnum.enum.cancelled:
      case CommitmentStatusEnum.enum.cancelled_refunded:
        throw new CommitmentAlreadyCancelledError();
      case CommitmentStatusEnum.enum.forfeited:
        throw new CommitmentAlreadyForfeitedError();
      case CommitmentStatusEnum.enum.completed:
        throw new CommitmentAlreadyCompletedError();
      case CommitmentStatusEnum.enum.refund_pending:
        throw new CommitmentRefundPendingError();
    }
  }
}

export const commitmentService = new CommitmentService(db);
