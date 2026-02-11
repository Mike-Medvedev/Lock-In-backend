import {
  CommitmentSessionModel,
  type CommitmentSession,
} from "@/features/commitment-sessions/commitment-sessions.model";
import { CommitmentTypeEnum } from "@/features/commitments/commitment.model";
import type { JOB_NAMES } from "@/shared/constants";
import type { Job } from "bullmq";
import z from "zod";

/**
 * BullMQ serializes job data to JSON via Redis, so Date objects become ISO strings.
 * This schema extends CommitmentSessionModel with z.coerce.date() for date fields
 * so they get parsed back into Date objects when the worker picks up the job.
 */
const CommitmentSessionFromJSON = CommitmentSessionModel.extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
});

export const VerificationJobDataModel = z.object({
  session: CommitmentSessionFromJSON,
  commitmentType: CommitmentTypeEnum,
  userId: z.uuid(),
});

export type VerificationJobData = z.infer<typeof VerificationJobDataModel>;
export type VerificationJob = Job<VerificationJobData, CommitmentSession, JOB_NAMES>;
