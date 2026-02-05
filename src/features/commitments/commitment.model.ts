import { createSelectSchema } from "drizzle-zod";
import {
  commitments,
  commitmentTypeEnum,
  frequencyEnum,
  durationEnum,
  transactionTypeEnum,
  commitmentSessions,
} from "@/infra/db/schema.ts";

export const CommitmentModel = createSelectSchema(commitments);
export const CommitmentSessionModel = createSelectSchema(commitmentSessions);
export const CommitmentTypeEnum = createSelectSchema(commitmentTypeEnum);
export const FrequencyEnum = createSelectSchema(frequencyEnum);
export const DurationEnum = createSelectSchema(durationEnum);
export const TransactionTypeEnum = createSelectSchema(transactionTypeEnum);
//comment
