import { createSelectSchema } from "drizzle-zod";
import { commitmentSessions, sessionGoalType, commitmentStatus } from "@/infra/db/schema.ts";

export const CommitmentSessionModel = createSelectSchema(commitmentSessions);
export const SessionGoalEnum = createSelectSchema(sessionGoalType);
export const CommitmentStatusEnum = createSelectSchema(commitmentStatus);
