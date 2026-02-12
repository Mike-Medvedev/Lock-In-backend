import { db, type DB } from "@/infra/db/db.ts";
import { transactions } from "@/infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { TransactionModel, type CreateTransactionParams } from "./transaction.model";
import { DatabaseResourceNotFoundError } from "@/shared/errors";
import logger from "@/infra/logger/logger";

export type TransactionRow = z.infer<typeof TransactionModel>;

class TransactionService {
  constructor(private readonly _db: DB) {}

  async findStakeByCommitmentId(commitmentId: string): Promise<TransactionRow | null> {
    const [row] = await this._db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.commitmentId, commitmentId), eq(transactions.transactionType, "stake")),
      )
      .limit(1);
    return (row as TransactionRow) ?? null;
  }

  async getByStripeTransactionId(stripeTransactionId: string): Promise<TransactionRow | null> {
    const [row] = await this._db
      .select()
      .from(transactions)
      .where(eq(transactions.stripeTransactionId, stripeTransactionId))
      .limit(1);
    return (row as TransactionRow) ?? null;
  }

  async create(params: CreateTransactionParams): Promise<z.infer<typeof TransactionModel>> {
    const [row] = await this._db
      .insert(transactions)
      .values({
        userId: params.userId,
        commitmentId: params.commitmentId,
        stripeTransactionId: params.stripeTransactionId,
        stripeCustomerId: params.stripeCustomerId,
        amount: params.amount,
        transactionType: params.transactionType,
        status: "pending",
      })
      .returning();
    if (!row) throw new Error("Transaction insert failed");

    logger.info("Transaction created", {
      transactionId: row.id,
      commitmentId: params.commitmentId,
      type: params.transactionType,
      amount: params.amount,
    });

    return row as z.infer<typeof TransactionModel>;
  }

  async updateStatusByStripeId(
    stripeTransactionId: string,
    status: "pending" | "succeeded" | "failed",
  ): Promise<void> {
    await this._db
      .update(transactions)
      .set({ status })
      .where(eq(transactions.stripeTransactionId, stripeTransactionId));

    logger.info("Transaction status updated", { stripeTransactionId, status });
  }

  async list(userId: string): Promise<z.infer<typeof TransactionModel>[]> {
    const rows = await this._db.select().from(transactions).where(eq(transactions.userId, userId));
    return rows as z.infer<typeof TransactionModel>[];
  }

  async getById(id: string, userId: string): Promise<z.infer<typeof TransactionModel>> {
    const [row] = await this._db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

    if (!row) {
      throw new DatabaseResourceNotFoundError();
    }

    return row as z.infer<typeof TransactionModel>;
  }
}

export const transactionService = new TransactionService(db);
