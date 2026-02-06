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
import { DURATION_WEEKS, MS } from "@/shared/constants";
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
  inGracePeriod: true,
});

export const CreateCommitmentModel = createInsertSchema(commitments, {
  startDate: z.coerce.date(),
})
  .pick({
    type: true,
    frequency: true,
    duration: true,
    sessionGoal: true,
    startDate: true,
    stakeAmount: true,
    lockedBonusAmount: true,
  })
  .strict()
  .transform((data) => ({
    ...data,
    endDate: addTime(data.startDate, DURATION_WEEKS[data.duration], "WEEK"),
    gracePeriodEndsAt: new Date(data.startDate.getTime() + MS.DAY),
  }));

export const UpdateCommitmentModel = createUpdateSchema(commitments)
  .pick({
    status: true,
  })
  .strict();

export const CommitmentsArray = z.array(CommitmentModel);

export type Commitment = z.infer<typeof CommitmentModel>;
export type CreateCommitment = z.infer<typeof CreateCommitmentModel>;
export type UpdateCommitment = z.infer<typeof UpdateCommitmentModel>;

export type CommitmentType = z.infer<typeof CommitmentTypeEnum>;
export type WorkoutFrequency = z.infer<typeof WorkoutFrequencyEnum>;
export type CommitmentDuration = z.infer<typeof CommitmentDurationEnum>;
export type SessionGoalType = z.infer<typeof SessionGoalEnum>;
export type CommitmentStatus = z.infer<typeof CommitmentStatusEnum>;
