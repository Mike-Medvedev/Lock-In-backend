import logger from "@/infra/logger/logger";
import { paymentService } from "@/features/payments/payments.service";
import { transactionService } from "@/features/transactions/transaction.service";
import { poolService } from "@/features/pool/pool.service";
import { PayoutError } from "@/shared/errors";
import type { Commitment } from "@/features/commitments/commitment.model";
import type { PayoutResult } from "./payout.model";

/**
 * Handles all payout logic for completed commitments.
 *
 * Separated from CommitmentService because the payout flow orchestrates
 * multiple external systems (Stripe, transaction records, pool accounting)
 * and will grow significantly when bonuses are introduced.
 *
 * ─────────────────────────────────────────────────────────────────────
 * v1 (current): Refund the user's original stake via Stripe Refund.
 * v2 (planned): Return stake + bonus via Stripe Transfer / Connect.
 * ─────────────────────────────────────────────────────────────────────
 */
class PayoutService {
  /**
   * Issue a completion payout for a commitment that has been fulfilled.
   *
   * Steps:
   * 1. Find the original stake transaction
   * 2. Issue a Stripe refund (v1) or Stripe Transfer (v2)
   * 3. Record the payout transaction
   * 4. Update pool accounting
   *
   * @throws {PayoutError} when stake not found or Stripe operation fails
   */
  async issueCompletionPayout(commitment: Commitment, userId: string): Promise<PayoutResult> {
    const stake = await transactionService.findStakeByCommitmentId(commitment.id);

    if (!stake || stake.status !== "succeeded") {
      logger.error("Cannot issue payout — no successful stake found", {
        commitmentId: commitment.id,
      });
      throw new PayoutError("No successful stake found for this commitment");
    }

    // ── Calculate payout amounts ───────────────────────────────────
    const stakeReturned = commitment.stakeAmount;
    const bonusAwarded = this.calculateBonus(commitment);
    const totalPayout = stakeReturned + bonusAwarded;

    // ── Issue the payout via Stripe ────────────────────────────────
    let stripeTransactionId: string;
    try {
      // v1: Simple refund of the original payment.
      // TODO v2: Replace with Stripe Transfer for stake + bonus.
      //   - Use Stripe Connect to transfer to user's connected account
      //   - Or use Stripe payouts if using platform balance
      const refund = await paymentService.createRefund(stake.stripeTransactionId);
      stripeTransactionId = refund.id;
    } catch (error) {
      logger.error("Stripe payout failed", {
        commitmentId: commitment.id,
        userId,
        error,
      });
      throw new PayoutError(
        "Failed to issue payout via Stripe",
        error instanceof Error ? error : undefined,
      );
    }

    // ── Record the payout transaction ──────────────────────────────
    await transactionService.create({
      userId,
      commitmentId: commitment.id,
      stripeTransactionId,
      stripeCustomerId: stake.stripeCustomerId,
      amount: totalPayout,
      transactionType: "payout",
    });

    // ── Update pool accounting ─────────────────────────────────────
    await poolService.subtractPayout(stakeReturned, bonusAwarded);

    logger.info("Completion payout issued", {
      commitmentId: commitment.id,
      userId,
      stakeReturned,
      bonusAwarded,
      totalPayout,
      stripeTransactionId,
    });

    return {
      commitmentId: commitment.id,
      userId,
      stakeReturned,
      bonusAwarded,
      totalPayout,
      stripeTransactionId,
      commitmentStatus: "completed",
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Calculate the bonus amount for a completed commitment.
   *
   * TODO: Implement real bonus calculation based on:
   *   - Pool balance available
   *   - Number of active users / completers
   *   - Commitment stake amount & duration
   *   - Premium vs free tier
   */

  private calculateBonus(_commitment: Commitment): number {
    // v1: No bonus — just return the stake.
    return 0;
  }
}

export const payoutService = new PayoutService();
