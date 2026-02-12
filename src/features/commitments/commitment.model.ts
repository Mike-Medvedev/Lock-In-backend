import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import {
  commitments,
  commitmentType,
  workoutFrequency,
  commitmentDuration,
  sessionGoalType,
  commitmentStatus,
} from "@/infra/db/schema.ts";
import { z } from "zod";
import { DURATION_WEEKS } from "@/shared/constants";
import { addTime } from "@/shared/date";

export const CommitmentTypeEnum = createSelectSchema(commitmentType);
export const WorkoutFrequencyEnum = createSelectSchema(workoutFrequency);
export const CommitmentDurationEnum = createSelectSchema(commitmentDuration);
export const SessionGoalEnum = createSelectSchema(sessionGoalType);
export const CommitmentStatusEnum = createSelectSchema(commitmentStatus);

export const CommitmentModel = createSelectSchema(commitments).pick({
  id: true,
  type: true,
  frequency: true,
  duration: true,
  sessionGoal: true,
  startDate: true,
  endDate: true,
  stakeAmount: true,
  lockedBonusAmount: true,
  status: true,
  gracePeriodEndsAt: true,
});

export const CreateCommitmentModel = createInsertSchema(commitments, {
  startDate: z.coerce.date(),
})
  .pick({
    type: true,
    frequency: true,
    duration: true,
    sessionGoal: true,
    stakeAmount: true,
    lockedBonusAmount: true,
  })
  .strict()
  .transform((data) => {
    const startDate = new Date();
    return {
      ...data,
      startDate,
      endDate: addTime(startDate, DURATION_WEEKS[data.duration], "WEEK"),
      gracePeriodEndsAt: addTime(startDate, 1, "DAY"),
    };
  });

export const UpdateCommitmentModel = createUpdateSchema(commitments)
  .pick({
    status: true,
  })
  .strict();

export const CommitmentsArray = z.array(CommitmentModel);

export const CancelPreviewModel = z.object({
  id: z.uuid(),
  cancellable: z.boolean(),
  message: z.string().optional(),
  refundable: z.boolean(),
  forfeitAmount: z.number(),
  stakeAmount: z.number(),
  gracePeriodEndsAt: z.coerce.date(),
});

export const CancelResultModel = z.object({
  id: z.uuid(),
  refunded: z.boolean(),
  forfeitedAmount: z.number(),
  status: CommitmentStatusEnum,
});

export type Commitment = z.infer<typeof CommitmentModel>;
export type CreateCommitment = z.infer<typeof CreateCommitmentModel>;
export type UpdateCommitment = z.infer<typeof UpdateCommitmentModel>;

export type CancelPreview = z.infer<typeof CancelPreviewModel>;
export type CancelResult = z.infer<typeof CancelResultModel>;

export const CommitmentProgressModel = z.object({
  commitmentId: z.uuid(),
  totalRequired: z.number(),
  completedSessions: z.number(),
  currentWeek: z.number(),
  totalWeeks: z.number(),
  sessionsThisWeek: z.number(),
  requiredPerWeek: z.number(),
});

export type CommitmentProgress = z.infer<typeof CommitmentProgressModel>;
export type CommitmentType = z.infer<typeof CommitmentTypeEnum>;
export type WorkoutFrequency = z.infer<typeof WorkoutFrequencyEnum>;
export type CommitmentDuration = z.infer<typeof CommitmentDurationEnum>;
export type SessionGoalType = z.infer<typeof SessionGoalEnum>;
export type CommitmentStatus = z.infer<typeof CommitmentStatusEnum>;
