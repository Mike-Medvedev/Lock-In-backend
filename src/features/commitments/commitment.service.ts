import { eq, and } from "drizzle-orm";
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
  DatabaseResourceNotFoundError,
  MultipleActiveCommitmentsError,
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
    // check if user has an active commitment already

    if ((await this.getActiveCommitments(userId)).length > 1) {
      throw new MultipleActiveCommitmentsError();
    }

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
    await this.getCommitment(commitmentId, userId);

    const [updated] = await this._db
      .update(commitments)
      .set(input)
      .where(eq(commitments.id, commitmentId))
      .returning();

    return CommitmentModel.parse(updated);
  }

  async getCancelPreview(commitmentId: string, userId: string): Promise<CancelPreview> {
    const commitment = await this.getCommitment(commitmentId, userId);
    this.validateCancellable(commitment);
    const refundable = this.isRefundable(commitment);

    return {
      id: commitment.id,
      refundable,
      forfeitAmount: refundable ? 0 : commitment.stakeAmount,
      stakeAmount: commitment.stakeAmount,
      gracePeriodEndsAt: commitment.gracePeriodEndsAt,
    };
  }

  async cancelCommitment(commitmentId: string, userId: string): Promise<CancelResult> {
    const commitment = await this.getCommitment(commitmentId, userId);
    this.validateCancellable(commitment);
    const refundable = this.isRefundable(commitment);

    if (refundable) {
      await this._db
        .update(commitments)
        .set({ status: CommitmentStatusEnum.enum.cancelled })
        .where(eq(commitments.id, commitmentId));

      // TODO: Process refund via Stripe
      return {
        id: commitment.id,
        refunded: true,
        forfeitedAmount: 0,
        status: CommitmentStatusEnum.enum.cancelled,
      };
    } else {
      await this._db
        .update(commitments)
        .set({ status: CommitmentStatusEnum.enum.forfeited })
        .where(eq(commitments.id, commitmentId));

      // TODO: Add forfeited amount to pool
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
  }

  private isRefundable(commitment: Commitment): boolean {
    return new Date() < commitment.gracePeriodEndsAt;
  }

  private validateCancellable(commitment: Commitment): void {
    switch (commitment.status) {
      case CommitmentStatusEnum.enum.cancelled:
        throw new CommitmentAlreadyCancelledError();
      case CommitmentStatusEnum.enum.forfeited:
        throw new CommitmentAlreadyForfeitedError();
      case CommitmentStatusEnum.enum.completed:
        throw new CommitmentAlreadyCompletedError();
    }
  }
}

export const commitmentService = new CommitmentService(db);
