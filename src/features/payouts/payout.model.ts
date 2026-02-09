import { z } from "zod";
import { CommitmentStatusEnum } from "@/features/commitments/commitment.model";

export const PayoutResultModel = z.object({
  commitmentId: z.uuid(),
  userId: z.uuid(),
  /** The user's original stake returned (in cents). */
  stakeReturned: z.number(),
  /** Bonus awarded from the pool (in cents). Currently always 0 in v1. */
  bonusAwarded: z.number(),
  /** Total amount paid out (stake + bonus, in cents). */
  totalPayout: z.number(),
  /** Stripe refund/transfer ID. */
  stripeTransactionId: z.string(),
  /** Final commitment status after payout. */
  commitmentStatus: CommitmentStatusEnum,
});

export type PayoutResult = z.infer<typeof PayoutResultModel>;
