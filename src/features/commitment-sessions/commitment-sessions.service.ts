import { eq, and, sql, inArray } from "drizzle-orm";
import { db, type DB } from "@/infra/db/db.ts";
import { commitmentSessions, commitments } from "@/infra/db/schema.ts";

import {
  CommitmentSessionModel,
  SessionStatusEnum,
  VerificationStatusEnum,
  type CommitmentSession,
  type CreateCommitmentSession,
} from "./commitment-sessions.model.ts";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  CommitmentNotActiveError,
  DatabaseError,
  DatabaseResourceNotFoundError,
  PG_ERROR_CODES,
  SessionAlreadyActiveError,
  SessionAlreadyCancelledError,
  SessionAlreadyCompletedError,
  SessionAlreadyExistsForDayError,
  SessionAlreadyPausedError,
  SessionAlreadyVerifiedError,
  SessionNotCompletedError,
  SessionNotInProgressError,
  SessionNotPausedError,
  UnauthorizedDatabaseRequestError,
  VerificationJobNotAddedError,
} from "@/shared/errors.ts";
import { getDateInTimezone } from "@/shared/date";
import type { VerificationResult } from "@/features/verification/verification.model";
import { commitmentService } from "@/features/commitments/commitment.service";
import { CommitmentStatusEnum } from "@/features/commitments/commitment.model";
import { DURATION_WEEKS, FREQUENCY_SESSIONS_PER_WEEK, JOB_NAMES } from "@/shared/constants";
import logger from "@/infra/logger/logger";
import { verificationQueue } from "@/infra/queue/queue.ts";

// ── Session state machine ─────────────────────────────────────────────
// not_started → in_progress  (create)
// in_progress → paused       (pause)
// in_progress → completed    (complete — ends recording, sets verification pending)
// in_progress → cancelled    (cancel)
// paused      → in_progress  (resume)
// paused      → cancelled    (cancel)
// completed   → verified     (verify — runs fraud checks, updates verification status)
// completed   → (terminal once verified)
// cancelled   → (terminal)

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

  /**
   * Create a new session for a commitment.
   * Guards: commitment must be active, no in_progress/paused session exists,
   * and no non-cancelled session exists for this commitment+day.
   */
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

    if (commitment.status !== CommitmentStatusEnum.enum.active) {
      throw new CommitmentNotActiveError();
    }

    // Guard: no in_progress or paused session already exists for this commitment
    await this.assertNoActiveSession(input.commitmentId);

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
      const dbError =
        error instanceof DatabaseError
          ? error
          : error instanceof DrizzleQueryError
            ? new DatabaseError(error)
            : null;

      if (dbError?.code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
        throw new SessionAlreadyExistsForDayError();
      }
      throw error;
    }
  }

  /**
   * Complete a session: ends recording and marks verification as pending.
   * Does NOT run verification — call verifySession separately.
   * Only allowed from in_progress (must resume first if paused).
   */
  async completeSession(id: string, userId: string): Promise<CommitmentSession> {
    const session = await this.getSession(id, userId);
    this.validateCanComplete(session);

    const now = new Date();
    const [completed] = await this._db
      .update(commitmentSessions)
      .set({
        sessionStatus: SessionStatusEnum.enum.completed,
        endDate: now,
        completedAt: now,
        verificationStatus: VerificationStatusEnum.enum.pending,
      })
      .where(eq(commitmentSessions.id, id))
      .returning();

    logger.info("Session completed, verification pending", { sessionId: id, userId });

    return CommitmentSessionModel.parse(completed);
  }

  /**
   * Check if sessionStatus=completed AND verificationStatus=pending
   * Enqueue a verify session job that verifies the session of fraud

   */
  async verifySession(id: string, userId: string): Promise<void> {
    const session = await this.getSession(id, userId);
    this.validateCanVerify(session);

    const commitment = await commitmentService.getCommitment(session.commitmentId, userId);
    try {
      logger.info(`Adding Verification Job to queue for commitmentSessionId: ${session.id}`);
      await verificationQueue.add(
        JOB_NAMES.verify_session,
        { session, commitmentType: commitment.type, userId },
        {
          jobId: `verify-${id}`,
          // removeOnComplete: true,
          // removeOnFail: true,
        },
      );
    } catch (error) {
      if (error instanceof Error)
        throw new VerificationJobNotAddedError(JOB_NAMES.verify_session, id, error);
      else throw error;
    }
  }

  /**
   * Cancel a session. Allowed from in_progress or paused.
   * The cancelled session frees the day slot so a new session can be created.
   */
  async cancelSession(id: string, userId: string): Promise<CommitmentSession> {
    const session = await this.getSession(id, userId);
    this.validateCanCancel(session);

    const [updated] = await this._db
      .update(commitmentSessions)
      .set({
        sessionStatus: SessionStatusEnum.enum.cancelled,
        endDate: new Date(),
      })
      .where(eq(commitmentSessions.id, id))
      .returning();

    logger.info("Session cancelled", { sessionId: id, userId });

    return CommitmentSessionModel.parse(updated);
  }

  /** Pause a session. Only allowed from in_progress. */
  async pauseSession(id: string, userId: string): Promise<CommitmentSession> {
    const session = await this.getSession(id, userId);
    this.validateCanPause(session);

    const [updated] = await this._db
      .update(commitmentSessions)
      .set({ sessionStatus: SessionStatusEnum.enum.paused })
      .where(eq(commitmentSessions.id, id))
      .returning();

    logger.info("Session paused", { sessionId: id, userId });

    return CommitmentSessionModel.parse(updated);
  }

  /** Resume a paused session back to in_progress. */
  async resumeSession(id: string, userId: string): Promise<CommitmentSession> {
    const session = await this.getSession(id, userId);
    this.validateCanResume(session);

    const [updated] = await this._db
      .update(commitmentSessions)
      .set({ sessionStatus: SessionStatusEnum.enum.in_progress })
      .where(eq(commitmentSessions.id, id))
      .returning();

    logger.info("Session resumed", { sessionId: id, userId });

    return CommitmentSessionModel.parse(updated);
  }

  /**
   * Validates that a session is in_progress.
   * Exported for the session samples controller (sample uploads require in_progress).
   */
  validateInProgress(session: CommitmentSession): void {
    if (session.sessionStatus !== SessionStatusEnum.enum.in_progress) {
      throw new SessionNotInProgressError();
    }
  }

  // ── State machine validators ──────────────────────────────────────

  /** Complete: only from in_progress. */
  private validateCanComplete(session: CommitmentSession): void {
    switch (session.sessionStatus) {
      case SessionStatusEnum.enum.in_progress:
        return;
      case SessionStatusEnum.enum.completed:
        throw new SessionAlreadyCompletedError();
      case SessionStatusEnum.enum.cancelled:
        throw new SessionAlreadyCancelledError();
      case SessionStatusEnum.enum.paused:
        throw new SessionNotInProgressError();
      default:
        throw new SessionNotInProgressError();
    }
  }

  /** Cancel: from in_progress or paused. */
  private validateCanCancel(session: CommitmentSession): void {
    switch (session.sessionStatus) {
      case SessionStatusEnum.enum.in_progress:
      case SessionStatusEnum.enum.paused:
        return;
      case SessionStatusEnum.enum.completed:
        throw new SessionAlreadyCompletedError();
      case SessionStatusEnum.enum.cancelled:
        throw new SessionAlreadyCancelledError();
      default:
        throw new SessionNotInProgressError();
    }
  }

  /** Pause: only from in_progress. */
  private validateCanPause(session: CommitmentSession): void {
    switch (session.sessionStatus) {
      case SessionStatusEnum.enum.in_progress:
        return;
      case SessionStatusEnum.enum.paused:
        throw new SessionAlreadyPausedError();
      case SessionStatusEnum.enum.completed:
        throw new SessionAlreadyCompletedError();
      case SessionStatusEnum.enum.cancelled:
        throw new SessionAlreadyCancelledError();
      default:
        throw new SessionNotInProgressError();
    }
  }

  /** Verify: only from completed + verification pending. */
  private validateCanVerify(session: CommitmentSession): void {
    if (session.sessionStatus !== SessionStatusEnum.enum.completed) {
      throw new SessionNotCompletedError();
    }
    if (session.verificationStatus !== VerificationStatusEnum.enum.pending) {
      throw new SessionAlreadyVerifiedError();
    }
  }

  /** Resume: only from paused. */
  private validateCanResume(session: CommitmentSession): void {
    switch (session.sessionStatus) {
      case SessionStatusEnum.enum.paused:
        return;
      case SessionStatusEnum.enum.in_progress:
        throw new SessionNotPausedError();
      case SessionStatusEnum.enum.completed:
        throw new SessionAlreadyCompletedError();
      case SessionStatusEnum.enum.cancelled:
        throw new SessionAlreadyCancelledError();
      default:
        throw new SessionNotPausedError();
    }
  }

  // ── Guards ────────────────────────────────────────────────────────

  /** Ensure no in_progress or paused session exists for this commitment. */
  private async assertNoActiveSession(commitmentId: string): Promise<void> {
    const [existing] = await this._db
      .select({ id: commitmentSessions.id })
      .from(commitmentSessions)
      .where(
        and(
          eq(commitmentSessions.commitmentId, commitmentId),
          inArray(commitmentSessions.sessionStatus, [
            SessionStatusEnum.enum.in_progress,
            SessionStatusEnum.enum.paused,
          ]),
        ),
      );

    if (existing) {
      throw new SessionAlreadyActiveError();
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  /** Handle a verification result where fraud was detected. */
  async handleFraudDetected(
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
  async handleVerificationPassed(
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

    await this.checkCommitmentCompletion(commitmentId, userId);

    return CommitmentSessionModel.parse(verified);
  }

  /**
   * Count verified sessions for this commitment.
   * If the total meets the requirement, complete the commitment and trigger payout.
   */
  private async checkCommitmentCompletion(commitmentId: string, userId: string): Promise<void> {
    const commitment = await commitmentService.getCommitment(commitmentId, userId);

    if (commitment.status !== CommitmentStatusEnum.enum.active) return;

    const sessionsPerWeek =
      FREQUENCY_SESSIONS_PER_WEEK[commitment.frequency as keyof typeof FREQUENCY_SESSIONS_PER_WEEK];
    const weeks = DURATION_WEEKS[commitment.duration as keyof typeof DURATION_WEEKS];
    const totalRequired = sessionsPerWeek * weeks;

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
