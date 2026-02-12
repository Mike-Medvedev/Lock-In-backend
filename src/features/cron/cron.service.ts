import { db, type DB } from "@/infra/db/db.ts";
import { commitments, commitmentSessions } from "@/infra/db/schema.ts";
import { eq, and, sql } from "drizzle-orm";
import { transactionService } from "@/features/transactions/transaction.service";
import { TransactionStatusEnum } from "@/features/transactions/transaction.model";
import { poolService } from "@/features/pool/pool.service";
import { DURATION_WEEKS, FREQUENCY_SESSIONS_PER_WEEK } from "@/shared/constants";
import logger from "@/infra/logger/logger";
import type { ExpiredCommitment, ForfeitResult } from "./cron.model";

class CronService {
  constructor(private readonly _db: DB) {}

  /**
   * Orchestrator: find expired commitments and forfeit those that are incomplete.
   * Called by pg_cron via HTTP at 2am UTC daily.
   */
  async forfeitExpiredCommitments(): Promise<ForfeitResult[]> {
    const expired = await this.findExpiredCommitments();

    if (expired.length === 0) {
      logger.info("Cron: No expired commitments found");
      return [];
    }

    const results: ForfeitResult[] = [];

    for (const commitment of expired) {
      try {
        const result = await this.processCommitment(commitment);
        if (result) results.push(result);
      } catch (error) {
        logger.error("Cron: Failed to process commitment", {
          commitmentId: commitment.id,
          error,
        });
      }
    }

    logger.info(`Cron: Forfeited ${results.length} commitments`, {
      forfeited: results.map((r) => r.commitmentId),
    });

    return results;
  }

  // ── Query helpers ───────────────────────────────────────────────

  /** Find all active commitments past their end date. */
  private async findExpiredCommitments(): Promise<ExpiredCommitment[]> {
    return this._db
      .select({
        id: commitments.id,
        userId: commitments.userId,
        stakeAmount: commitments.stakeAmount,
        frequency: commitments.frequency,
        duration: commitments.duration,
      })
      .from(commitments)
      .where(and(eq(commitments.status, "active"), sql`now() > ${commitments.endDate}`));
  }

  /** Count verified (non-fraud) sessions for a commitment. */
  private async countVerifiedSessions(commitmentId: string): Promise<number> {
    const [row] = await this._db
      .select({ count: sql<number>`count(*)::int` })
      .from(commitmentSessions)
      .where(
        and(
          eq(commitmentSessions.commitmentId, commitmentId),
          eq(commitmentSessions.verificationStatus, "succeeded"),
        ),
      );
    return row?.count ?? 0;
  }

  // ── Calculation helpers ─────────────────────────────────────────

  /** Calculate total required sessions for a commitment (frequency × weeks). */
  private calculateRequiredSessions(frequency: string, duration: string): number {
    const sessionsPerWeek =
      FREQUENCY_SESSIONS_PER_WEEK[frequency as keyof typeof FREQUENCY_SESSIONS_PER_WEEK];
    const weeks = DURATION_WEEKS[duration as keyof typeof DURATION_WEEKS];
    return sessionsPerWeek * weeks;
  }

  // ── Forfeit actions ─────────────────────────────────────────────

  /** Record a forfeit transaction and mark it as succeeded. */
  private async recordForfeitTransaction(
    commitment: ExpiredCommitment,
    stripeCustomerId: string | null,
  ): Promise<void> {
    const forfeitTxId = `forfeit_${commitment.id}`;
    await transactionService.create({
      userId: commitment.userId,
      commitmentId: commitment.id,
      stripeTransactionId: forfeitTxId,
      stripeCustomerId,
      amount: commitment.stakeAmount,
      transactionType: "forfeit",
    });
    await transactionService.updateStatusByStripeId(
      forfeitTxId,
      TransactionStatusEnum.enum.succeeded,
    );
  }

  /** Record a rake transaction and mark it as succeeded. */
  private async recordRakeTransaction(
    commitment: ExpiredCommitment,
    stripeCustomerId: string | null,
    rakeCents: number,
  ): Promise<void> {
    const rakeTxId = `rake_${commitment.id}`;
    await transactionService.create({
      userId: commitment.userId,
      commitmentId: commitment.id,
      stripeTransactionId: rakeTxId,
      stripeCustomerId,
      amount: rakeCents,
      transactionType: "rake",
    });
    await transactionService.updateStatusByStripeId(rakeTxId, TransactionStatusEnum.enum.succeeded);
  }

  /** Mark a commitment as forfeited in the database. */
  private async markForfeited(commitmentId: string): Promise<void> {
    await this._db
      .update(commitments)
      .set({ status: "forfeited" })
      .where(eq(commitments.id, commitmentId));
  }

  // ── Orchestration ───────────────────────────────────────────────

  /**
   * Process a single expired commitment:
   * check if incomplete, validate stake exists, then forfeit.
   * Returns null if commitment was actually fulfilled or has no stake.
   */
  private async processCommitment(commitment: ExpiredCommitment): Promise<ForfeitResult | null> {
    const sessionsRequired = this.calculateRequiredSessions(
      commitment.frequency,
      commitment.duration,
    );
    const sessionsCompleted = await this.countVerifiedSessions(commitment.id);

    if (sessionsCompleted >= sessionsRequired) {
      logger.info("Cron: Expired commitment already fulfilled, skipping", {
        commitmentId: commitment.id,
        sessionsCompleted,
        sessionsRequired,
      });
      return null;
    }

    const stake = await transactionService.findStakeByCommitmentId(commitment.id);

    if (!stake || stake.status !== "succeeded") {
      logger.warn("Cron: No successful stake found, skipping forfeit", {
        commitmentId: commitment.id,
      });
      return null;
    }

    await this.recordForfeitTransaction(commitment, stake.stripeCustomerId);
    const { rakeCents } = await poolService.addForfeit(commitment.stakeAmount);
    await this.recordRakeTransaction(commitment, stake.stripeCustomerId, rakeCents);
    await this.markForfeited(commitment.id);

    logger.info("Cron: Forfeited commitment", {
      commitmentId: commitment.id,
      userId: commitment.userId,
      stakeAmount: commitment.stakeAmount,
      rakeCents,
      sessionsCompleted,
      sessionsRequired,
    });

    return {
      commitmentId: commitment.id,
      userId: commitment.userId,
      stakeAmount: commitment.stakeAmount,
      sessionsCompleted,
      sessionsRequired,
    };
  }
}

export const cronService = new CronService(db);
