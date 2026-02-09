import { db, type DB } from "@/infra/db/db.ts";
import type { z } from "zod";
import { TransactionModel } from "./transaction.model";
import { DatabaseResourceNotFoundError } from "@/shared/errors";

class TransactionService {
  constructor(private readonly _db: DB) {}

  async list(_userId: string): Promise<z.infer<typeof TransactionModel>[]> {
    return [];
  }

  async getById(_id: string, _userId: string): Promise<z.infer<typeof TransactionModel>> {
    console.log(this._db);
    throw new DatabaseResourceNotFoundError();
  }
}

export const transactionService = new TransactionService(db);
