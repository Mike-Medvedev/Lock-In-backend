import { createSelectSchema } from "drizzle-zod";
import {
  commitments,
  commitmentType,
  workoutFrequency,
  commitmentDuration,
  sessionGoalType,
  commitmentStatus,
} from "@/infra/db/schema.ts";

export const CommitmentModel = createSelectSchema(commitments);
export const CommitmentTypeEnum = createSelectSchema(commitmentType);
export const WorkoutFrequencyEnum = createSelectSchema(workoutFrequency);
export const CommitmentDurationEnum = createSelectSchema(commitmentDuration);
export const SessionGoalEnum = createSelectSchema(sessionGoalType);
export const CommitmentStatusEnum = createSelectSchema(commitmentStatus);
