import { z } from "zod";

export const ExpiredCommitmentModel = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  stakeAmount: z.number(),
  frequency: z.string(),
  duration: z.string(),
});

export const ForfeitResultModel = z.object({
  commitmentId: z.uuid(),
  userId: z.uuid(),
  stakeAmount: z.number(),
  sessionsCompleted: z.number(),
  sessionsRequired: z.number(),
});

export const ForfeitExpiredResponseModel = z.object({
  forfeitedCount: z.number(),
  commitments: z.array(ForfeitResultModel),
});

export type ExpiredCommitment = z.infer<typeof ExpiredCommitmentModel>;
export type ForfeitResult = z.infer<typeof ForfeitResultModel>;
