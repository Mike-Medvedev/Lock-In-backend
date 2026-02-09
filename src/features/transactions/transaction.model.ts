import { createSelectSchema } from "drizzle-zod";
import { transactions, transactionType } from "@/infra/db/schema.ts";
import { z } from "zod";

export const TransactionModel = createSelectSchema(transactions);
export const TransactionTypeEnum = createSelectSchema(transactionType);
export const TransactionsArray = z.array(TransactionModel);

export type CreateTransactionParams = {
  userId: string;
  commitmentId: string;
  stripeTransactionId: string;
  stripeCustomerId: string | null;
  amount: number;
  transactionType: "stake" | "payout" | "forfeit" | "rake";
};
