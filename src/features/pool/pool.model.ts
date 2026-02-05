import { createSelectSchema } from "drizzle-zod";
import { pool, transactionType } from "@/infra/db/schema.ts";

export const Pool = createSelectSchema(pool);

export const TransactionTypeEnum = createSelectSchema(transactionType);
