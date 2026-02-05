import { createSelectSchema } from "drizzle-zod";
import { transactions } from "@/infra/db/schema.ts";

export const Transaction = createSelectSchema(transactions);
