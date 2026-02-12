import { z } from "zod";
import type {
  GpsSample,
  MotionSample,
  PedometerSample,
} from "@/features/session-samples/session-sample.model";
import type { CommitmentSession } from "@/features/commitment-sessions/commitment-sessions.model";
import type { CommitmentType } from "@/features/commitments/commitment.model";

// ── Verification result (written to the session after verification) ────

export const VerificationResultModel = z.object({
  sessionId: z.uuid(),
  passed: z.boolean(),
  fraudDetected: z.boolean(),
  flaggedForReview: z.boolean(),
  reviewNotes: z.string().nullable(),
  /** Actual value achieved during the session (steps, miles, etc.) */
  actualValue: z.number().nullable(),
  /** Duration of the session in seconds */
  sessionDurationSeconds: z.number(),
});

/** Internal result from the fraud detection pipeline. */
export const FraudCheckResultModel = z.object({
  fraudDetected: z.boolean(),
  flaggedForReview: z.boolean(),
  reviewNotes: z.string().nullable(),
});

// ── Individual check types ─────────────────────────────────────────────

/** Result from a single fraud check function. */
export interface CheckResult {
  passed: boolean;
  flagged: boolean; // suspicious but not conclusive fraud
  note: string | null;
}

/** Input bundle passed to each check function. */
export interface CheckInput {
  session: CommitmentSession;
  commitmentType: CommitmentType;
  gpsSamples: GpsSample[];
  motionSamples: MotionSample[];
  pedometerSamples: PedometerSample[];
  sessionDurationSeconds: number;
  /** Freshly calculated actual value (steps/miles) — not the DB value which may be null. */
  actualValue: number;
}

/** Per-activity thresholds used by fraud checks. */
export interface ActivityThresholds {
  teleportSpeedMph: number;
  maxAvgSpeedMph: number;
  minStepsPerMin: number;
  maxStepsPerMin: number;
  minAccelRms: number;
}

/** Minimum targets a session must hit to count as "real effort". */
export interface GoalTargets {
  /** Minimum step count for a steps-based session. */
  minSteps: number;
  /** Minimum distance (miles) for a miles-based session. */
  minMiles: number;
}

// ── Exported types ─────────────────────────────────────────────────────

export type VerificationResult = z.infer<typeof VerificationResultModel>;
export type FraudCheckResult = z.infer<typeof FraudCheckResultModel>;
