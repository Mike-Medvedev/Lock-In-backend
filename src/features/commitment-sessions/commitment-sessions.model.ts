import { createSelectSchema, createUpdateSchema } from "drizzle-zod";
import {
  commitmentSessions,
  sessionGoalType,
  sessionStatus,
  verificationStatus,
} from "@/infra/db/schema.ts";
import { z } from "zod";

export const SessionStatusEnum = createSelectSchema(sessionStatus);
export const VerificationStatusEnum = createSelectSchema(verificationStatus);
export const SessionGoalEnum = createSelectSchema(sessionGoalType);

export const CommitmentSessionModel = createSelectSchema(commitmentSessions).pick({
  id: true,
  userId: true,
  commitmentId: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  completedAt: true,
  countingDay: true,
  sessionDuration: true,
  sessionStatus: true,
  sessionGoal: true,
  actualValue: true,
  flaggedForReview: true,
  fraudDetected: true,
  reviewNotes: true,
});

export const CreateCommitmentSessionModel = z
  .object({
    commitmentId: z.uuid(),
    countingDay: z.coerce.date(),
  })
  .strict();

export const UpdateCommitmentSessionStatusModel = createUpdateSchema(commitmentSessions)
  .pick({
    sessionStatus: true,
    verificationStatus: true,
    actualValue: true,
    reviewNotes: true,
  })
  .strict();

export const CommitmentSessionsArray = z.array(CommitmentSessionModel);

export type CommitmentSession = z.infer<typeof CommitmentSessionModel>;
export type CreateCommitmentSession = z.infer<typeof CreateCommitmentSessionModel>;
export type UpdateCommitmentSessionStatus = z.infer<typeof UpdateCommitmentSessionStatusModel>;
export type SessionStatus = z.infer<typeof SessionStatusEnum>;
export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;
export type SessionGoalType = z.infer<typeof SessionGoalEnum>;
