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

export const CommitmentTypeEnum = createSelectSchema(commitmentType);
export const WorkoutFrequencyEnum = createSelectSchema(workoutFrequency);
export const CommitmentDurationEnum = createSelectSchema(commitmentDuration);
export const SessionGoalEnum = createSelectSchema(sessionGoalType);
export const CommitmentStatusEnum = createSelectSchema(commitmentStatus);

export const CommitmentModel = createSelectSchema(commitments);

export const CreateCommitmentModel = createInsertSchema(commitments, {
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  createdAt: z.coerce.date(),
  gracePeriodEndsAt: z.coerce.date(),
})
  .omit({ userId: true })
  .strict();

export const UpdateCommitmentModel = createUpdateSchema(commitments).strict();

export const CommitmentsArray = z.array(CommitmentModel);

export type Commitment = z.infer<typeof CommitmentModel>;
export type CreateCommitment = z.infer<typeof CreateCommitmentModel>;
export type UpdateCommitment = z.infer<typeof UpdateCommitmentModel>;

export type CommitmentType = z.infer<typeof CommitmentTypeEnum>;
export type WorkoutFrequency = z.infer<typeof WorkoutFrequencyEnum>;
export type CommitmentDuration = z.infer<typeof CommitmentDurationEnum>;
export type SessionGoalType = z.infer<typeof SessionGoalEnum>;
export type CommitmentStatus = z.infer<typeof CommitmentStatusEnum>;
