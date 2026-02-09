import { eq, and, sql } from "drizzle-orm";
import { db, type DB } from "@/infra/db/db.ts";
import { commitmentSessions, commitments } from "@/infra/db/schema.ts";

import {
  CommitmentSessionModel,
  SessionStatusEnum,
  VerificationStatusEnum,
  type CommitmentSession,
  type CreateCommitmentSession,
  type UpdateCommitmentSessionStatus,
} from "./commitment-sessions.model.ts";
import {
  CommitmentNotActiveError,
  DatabaseError,
  DatabaseResourceNotFoundError,
  PG_ERROR_CODES,
  SessionAlreadyExistsForDayError,
  SessionNotInProgressError,
  UnauthorizedDatabaseRequestError,
} from "@/shared/errors.ts";
import { getDateInTimezone } from "@/shared/date";
import { verificationService } from "@/features/verification/verification.service";
import type { VerificationResult } from "@/features/verification/verification.model";
import { commitmentService } from "@/features/commitments/commitment.service";
import { DURATION_WEEKS, FREQUENCY_SESSIONS_PER_WEEK } from "@/shared/constants";
import logger from "@/infra/logger/logger";

class CommitmentSessionService {
  constructor(private readonly _db: DB) {}

  // ── Queries ────────────────────────────────────────────────────────

  async getSessions(userId: string): Promise<CommitmentSession[]> {
    const results = await this._db
      .select()
      .from(commitmentSessions)
      .where(eq(commitmentSessions.userId, userId));
    return results.map((row) => CommitmentSessionModel.parse(row));
  }

  async getSession(id: string, userId: string): Promise<CommitmentSession> {
    const [session] = await this._db
      .select()
      .from(commitmentSessions)
      .where(eq(commitmentSessions.id, id));

    if (!session) {
      throw new DatabaseResourceNotFoundError();
    }

    if (session.userId !== userId) {
      throw new UnauthorizedDatabaseRequestError();
    }

    return CommitmentSessionModel.parse(session);
  }

  // ── Commands ───────────────────────────────────────────────────────

  async createSession(userId: string, input: CreateCommitmentSession): Promise<CommitmentSession> {
    const [commitment] = await this._db
      .select()
      .from(commitments)
      .where(eq(commitments.id, input.commitmentId));

    if (!commitment) {
      throw new DatabaseResourceNotFoundError();
    }

    if (commitment.userId !== userId) {
      throw new UnauthorizedDatabaseRequestError();
    }

    if (commitment.status !== "active") {
      throw new CommitmentNotActiveError();
    }

    const startDate = new Date();
    const countingDay = getDateInTimezone(startDate, input.timezone);

    try {
      const [session] = await this._db
        .insert(commitmentSessions)
        .values({
          userId,
          commitmentId: input.commitmentId,
          timezone: input.timezone,
          countingDay,
          startDate,
          sessionGoal: commitment.sessionGoal,
          sessionStatus: SessionStatusEnum.enum.in_progress,
        })
        .returning();

      return CommitmentSessionModel.parse(session);
    } catch (error) {
      if (error instanceof DatabaseError && error.code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
        throw new SessionAlreadyExistsForDayError();
      }
      throw error;
    }
  }

  async updateSessionStatus(
    id: string,
    userId: string,
    input: UpdateCommitmentSessionStatus,
  ): Promise<CommitmentSession> {
    await this.getSession(id, userId);

    const setPayload: Record<string, unknown> = {};
    if (input.sessionStatus !== undefined) setPayload.sessionStatus = input.sessionStatus;
    if (input.verificationStatus !== undefined)
      setPayload.verificationStatus = input.verificationStatus;
    if (input.actualValue !== undefined) setPayload.actualValue = input.actualValue;
    if (input.reviewNotes !== undefined) setPayload.reviewNotes = input.reviewNotes;
    if (input.verificationStatus === VerificationStatusEnum.enum.succeeded) {
      setPayload.completedAt = new Date();
    }

    const [updated] = await this._db
      .update(commitmentSessions)
      .set(setPayload)
      .where(eq(commitmentSessions.id, id))
      .returning();

    return CommitmentSessionModel.parse(updated);
  }

  /**
   * Complete a session: end recording, run verification, and check commitment progress.
   *
   * Flow:
   * 1. Validate session is in_progress
   * 2. Mark session as completed + verification pending
   * 3. Run verification engine on the collected GPS + motion samples
   * 4. If fraud detected → flag session, don't count it
   * 5. If verified → mark as succeeded, count toward commitment
   * 6. If all required sessions are done → complete the commitment (payout)
   */
  async completeSession(id: string, userId: string): Promise<CommitmentSession> {
    const session = await this.getSession(id, userId);
    this.validateInProgress(session);

    // Fetch commitment to get its type for the verification engine
    const commitment = await commitmentService.getCommitment(session.commitmentId, userId);

    // ── Step 1: Mark session recording as completed ──────────────
    const now = new Date();
    const [completedSession] = await this._db
      .update(commitmentSessions)
      .set({
        sessionStatus: SessionStatusEnum.enum.completed,
        endDate: now,
        completedAt: now,
        verificationStatus: VerificationStatusEnum.enum.pending,
      })
      .where(eq(commitmentSessions.id, id))
      .returning();

    const parsed = CommitmentSessionModel.parse(completedSession);

    // ── Step 2: Run verification engine ──────────────────────────
    const verificationResult = await verificationService.verify(parsed, commitment.type);

    if (verificationResult.fraudDetected) {
      return this.handleFraudDetected(id, userId, session.commitmentId, verificationResult);
    }

    return this.handleVerificationPassed(id, userId, session.commitmentId, verificationResult);
  }

  async cancelSession(id: string, userId: string): Promise<CommitmentSession> {
    const session = await this.getSession(id, userId);
    this.validateInProgress(session);

    const [updated] = await this._db
      .update(commitmentSessions)
      .set({ sessionStatus: SessionStatusEnum.enum.cancelled })
      .where(eq(commitmentSessions.id, id))
      .returning();

    return CommitmentSessionModel.parse(updated);
  }

  /**
   * Validates that a session is in_progress (required for completing, cancelling, or uploading samples).
   * Exported for use by the session samples controller.
   */
  validateInProgress(session: CommitmentSession): void {
    if (session.sessionStatus !== SessionStatusEnum.enum.in_progress) {
      throw new SessionNotInProgressError();
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  /** Handle a verification result where fraud was detected. */
  private async handleFraudDetected(
    sessionId: string,
    userId: string,
    commitmentId: string,
    verificationResult: VerificationResult,
  ): Promise<CommitmentSession> {
    const [flagged] = await this._db
      .update(commitmentSessions)
      .set({
        verificationStatus: VerificationStatusEnum.enum.failed,
        fraudDetected: true,
        flaggedForReview: verificationResult.flaggedForReview,
        reviewNotes: verificationResult.reviewNotes,
        actualValue: verificationResult.actualValue,
        sessionDuration: verificationResult.sessionDurationSeconds,
      })
      .where(eq(commitmentSessions.id, sessionId))
      .returning();

    logger.warn("Session flagged as fraudulent", {
      sessionId,
      userId,
      commitmentId,
    });

    return CommitmentSessionModel.parse(flagged);
  }

  /** Handle a verification result that passed. */
  private async handleVerificationPassed(
    sessionId: string,
    userId: string,
    commitmentId: string,
    verificationResult: VerificationResult,
  ): Promise<CommitmentSession> {
    const [verified] = await this._db
      .update(commitmentSessions)
      .set({
        verificationStatus: VerificationStatusEnum.enum.succeeded,
        actualValue: verificationResult.actualValue,
        sessionDuration: verificationResult.sessionDurationSeconds,
        flaggedForReview: verificationResult.flaggedForReview,
        reviewNotes: verificationResult.reviewNotes,
      })
      .where(eq(commitmentSessions.id, sessionId))
      .returning();

    logger.info("Session verified successfully", {
      sessionId,
      userId,
      commitmentId,
    });

    // Check if the commitment is now fulfilled
    await this.checkCommitmentCompletion(commitmentId, userId);

    return CommitmentSessionModel.parse(verified);
  }

  /**
   * Count how many sessions for this commitment have been verified.
   * If total verified sessions meets the requirement → complete the commitment.
   *
   * Total required = frequency (sessions per week) × duration (weeks)
   * e.g. "five_times_a_week" for "two_weeks" = 5 × 2 = 10 total sessions.
   */
  private async checkCommitmentCompletion(commitmentId: string, userId: string): Promise<void> {
    // Use the commitment service for consistent auth + model parsing
    const commitment = await commitmentService.getCommitment(commitmentId, userId);

    if (commitment.status !== "active") return;

    const sessionsPerWeek =
      FREQUENCY_SESSIONS_PER_WEEK[commitment.frequency as keyof typeof FREQUENCY_SESSIONS_PER_WEEK];
    const weeks = DURATION_WEEKS[commitment.duration as keyof typeof DURATION_WEEKS];
    const totalRequired = sessionsPerWeek * weeks;

    // Count verified sessions for this commitment
    const rows = await this._db
      .select({ count: sql<number>`count(*)::int` })
      .from(commitmentSessions)
      .where(
        and(
          eq(commitmentSessions.commitmentId, commitmentId),
          eq(commitmentSessions.verificationStatus, VerificationStatusEnum.enum.succeeded),
        ),
      );
    const verifiedCount = rows[0]?.count ?? 0;

    logger.info("Commitment progress check", {
      commitmentId,
      verifiedSessions: verifiedCount,
      totalRequired,
    });

    if (verifiedCount >= totalRequired) {
      logger.info("Commitment fulfilled — triggering completion", { commitmentId, userId });
      await commitmentService.completeCommitment(commitmentId, userId);
    }
  }
}

export const commitmentSessionService = new CommitmentSessionService(db);
