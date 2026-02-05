import { eq, and } from "drizzle-orm";
import { db, type DB } from "@/infra/db/db.ts";
import { commitments } from "@/infra/db/schema.ts";

import {
  CommitmentModel,
  type Commitment,
  type CreateCommitment,
  type UpdateCommitment,
} from "./commitment.model.ts";
import {
  DatabaseResourceNotFoundError,
  UnauthorizedDatabaseRequestError,
} from "@/shared/errors.ts";

class CommitmentService {
  constructor(private readonly _db: DB) {}

  /** Get all commitments for a user */
  async getCommitments(userId: string): Promise<Commitment[]> {
    const results = await this._db.select().from(commitments).where(eq(commitments.userId, userId));
    return results.map((c) => CommitmentModel.parse(c));
  }

  /** Get active commitments for a user */
  async getActiveCommitments(userId: string): Promise<Commitment[]> {
    const results = await this._db
      .select()
      .from(commitments)
      .where(and(eq(commitments.userId, userId), eq(commitments.status, "active")));
    return results.map((c) => CommitmentModel.parse(c));
  }

  /** Get a single commitment by id, verifying user ownership */
  async getCommitment(id: number, userId: string): Promise<Commitment> {
    const [commitment] = await this._db.select().from(commitments).where(eq(commitments.id, id));

    if (!commitment) {
      throw new DatabaseResourceNotFoundError();
    }

    if (commitment.userId !== userId) {
      throw new UnauthorizedDatabaseRequestError();
    }

    return CommitmentModel.parse(commitment);
  }

  /** Create a new commitment */
  async createCommitment(input: CreateCommitment): Promise<Commitment> {
    // Calculate grace period end (1 day from now) if not provided
    const gracePeriodEndsAt = input.gracePeriodEndsAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [commitment] = await this._db
      .insert(commitments)
      .values({
        ...input,
        gracePeriodEndsAt,
      })
      .returning();

    return CommitmentModel.parse(commitment);
  }

  /** Update an existing commitment, verifying user ownership */
  async updateCommitment(id: number, userId: string, input: UpdateCommitment): Promise<Commitment> {
    // First verify the commitment exists and user owns it
    await this.getCommitment(id, userId);

    const [updated] = await this._db
      .update(commitments)
      .set(input)
      .where(eq(commitments.id, id))
      .returning();

    return CommitmentModel.parse(updated);
  }

  /** Delete a commitment, verifying user ownership */
  async deleteCommitment(id: number, userId: string): Promise<void> {
    // First verify the commitment exists and user owns it
    await this.getCommitment(id, userId);

    await this._db.delete(commitments).where(eq(commitments.id, id));
  }
}

export const commitmentService = new CommitmentService(db);
