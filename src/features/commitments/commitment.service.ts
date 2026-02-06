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
    const [commitment] = await this._db
      .insert(commitments)
      .values({
        ...input,
        userId,
      })
      .returning();

    return CommitmentModel.parse(commitment);
  }

  async updateCommitment(
    commitmentId: string,
    userId: string,
    input: UpdateCommitment,
  ): Promise<Commitment> {
    // First verify the commitment exists and user owns it
    await this.getCommitment(commitmentId, userId);

    const [updated] = await this._db
      .update(commitments)
      .set(input)
      .where(eq(commitments.id, commitmentId))
      .returning();

    return CommitmentModel.parse(updated);
  }

  async deleteCommitment(id: string, userId: string): Promise<void> {
    // First verify the commitment exists and user owns it
    await this.getCommitment(id, userId);

    await this._db.delete(commitments).where(eq(commitments.id, id));
  }
}

export const commitmentService = new CommitmentService(db);
