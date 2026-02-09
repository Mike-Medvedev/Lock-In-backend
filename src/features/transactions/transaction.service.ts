import { db, type DB } from "@/infra/db/db.ts";
import { transactions } from "@/infra/db/schema";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { TransactionModel, type CreateTransactionParams } from "./transaction.model";
import { DatabaseResourceNotFoundError } from "@/shared/errors";

class TransactionService {
  constructor(private readonly _db: DB) {}

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
  }

  async list(_userId: string): Promise<z.infer<typeof TransactionModel>[]> {
    return [];
  }

  async getById(_id: string, _userId: string): Promise<z.infer<typeof TransactionModel>> {
    console.log(this._db);
    throw new DatabaseResourceNotFoundError();
  }
}

export const transactionService = new TransactionService(db);
