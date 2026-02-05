import { createSelectSchema } from "drizzle-zod";
import { transactions, transactionType } from "@/infra/db/schema.ts";

export const Transaction = createSelectSchema(transactions);

export const TransactionTypeEnum = createSelectSchema(transactionType);
