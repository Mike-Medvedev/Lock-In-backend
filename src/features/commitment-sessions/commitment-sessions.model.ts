import { createSelectSchema } from "drizzle-zod";
import {
  commitmentSessions,
  sessionGoalType,
  sessionStatus,
  verificationStatus,
} from "@/infra/db/schema.ts";
import { IANA_TIMEZONES } from "@/shared/constants.ts";
import { z } from "zod";

/**
 * Validates a non-empty string that must be a valid IANA timezone.
 *
 */
export const ianaTimezoneSchema = z
  .string()
  .min(1)
  .refine((tz) => IANA_TIMEZONES.has(tz), {
    message: "Must be a valid IANA timezone (e.g. America/Los_Angeles)",
  });

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
  timezone: true,
  countingDay: true,
  sessionDuration: true,
  sessionStatus: true,
  verificationStatus: true,
  sessionGoal: true,
  actualValue: true,
  flaggedForReview: true,
  fraudDetected: true,
  reviewNotes: true,
});

export const CreateCommitmentSessionModel = z
  .object({
    commitmentId: z.uuid(),
    timezone: ianaTimezoneSchema,
  })
  .strict();

export const CommitmentSessionsArray = z.array(CommitmentSessionModel);

export type CommitmentSession = z.infer<typeof CommitmentSessionModel>;
export type CreateCommitmentSession = z.infer<typeof CreateCommitmentSessionModel>;
export type SessionStatus = z.infer<typeof SessionStatusEnum>;
export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;
export type SessionGoalType = z.infer<typeof SessionGoalEnum>;
