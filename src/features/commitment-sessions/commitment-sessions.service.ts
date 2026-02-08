import { eq } from "drizzle-orm";
import { db, type DB } from "@/infra/db/db.ts";
import { commitmentSessions, commitments } from "@/infra/db/schema.ts";

import {
  CommitmentSessionModel,
  SessionStatusEnum,
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
  UnauthorizedDatabaseRequestError,
} from "@/shared/errors.ts";
import { getDateInTimezone } from "@/shared/date";

class CommitmentSessionService {
  constructor(private readonly _db: DB) {}

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
    if (input.verificationStatus === "succeeded") {
      setPayload.completedAt = new Date();
    }

    const [updated] = await this._db
      .update(commitmentSessions)
      .set(setPayload)
      .where(eq(commitmentSessions.id, id))
      .returning();

    return CommitmentSessionModel.parse(updated);
  }

  async completeSession(id: string, userId: string): Promise<CommitmentSession> {
    await this.getSession(id, userId);

    const [updated] = await this._db
      .update(commitmentSessions)
      .set({
        sessionStatus: SessionStatusEnum.enum.completed,
        completedAt: new Date(),
      })
      .where(eq(commitmentSessions.id, id))
      .returning();

    return CommitmentSessionModel.parse(updated);
  }

  async cancelSession(id: string, userId: string): Promise<CommitmentSession> {
    await this.getSession(id, userId);

    const [updated] = await this._db
      .update(commitmentSessions)
      .set({ sessionStatus: SessionStatusEnum.enum.cancelled })
      .where(eq(commitmentSessions.id, id))
      .returning();

    return CommitmentSessionModel.parse(updated);
  }
}

export const commitmentSessionService = new CommitmentSessionService(db);
