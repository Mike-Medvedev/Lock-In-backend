import logger from "@/infra/logger/logger";
import { sessionSampleService } from "@/features/session-samples/session-sample.service";
import {
  SessionGoalEnum,
  type CommitmentSession,
} from "@/features/commitment-sessions/commitment-sessions.model";
import type { CommitmentType } from "@/features/commitments/commitment.model";
import type { GpsSample, PedometerSample } from "@/features/session-samples/session-sample.model";
import type {
  CheckInput,
  CheckResult,
  FraudCheckResult,
  VerificationResult,
} from "./verification.model";
import { haversineMeters, metersToMiles, sortByTime } from "./verification.utils";
import { GPS_ACCURACY_FILTER_METERS, GPS_GLITCH_THRESHOLD_METERS } from "./verification.constants";
import {
  checkMinimumData,
  checkGpsTeleportation,
  checkSpeedRange,
  checkMotionEnergy,
  checkPedometerPlausibility,
  checkTimestampIntegrity,
  checkGpsMotionCorrelation,
  checkSessionGoalTarget,
} from "./verification.checks";

/**
 * Anti-fraud verification engine.
 *
 * Pulls GPS, motion, and pedometer samples for a completed session, then runs
 * a pipeline of independent fraud checks. Any single check failure = fraud.
 * Flagged checks are suspicious but not conclusive — logged for manual review.
 */
class VerificationService {
  /** Run the full verification pipeline on a completed session. */
  async verify(
    session: CommitmentSession,
    commitmentType: CommitmentType,
  ): Promise<VerificationResult> {
    logger.info("Verification engine: starting", {
      sessionId: session.id,
      sessionGoal: session.sessionGoal,
      commitmentType,
    });

    // ── Load all sensor data in parallel ──────────────────────────
    const [motionSamples, gpsSamples, pedometerSamples] = await Promise.all([
      sessionSampleService.getMotionSamples(session.id),
      sessionSampleService.getGpsSamples(session.id),
      sessionSampleService.getPedometerSamples(session.id),
    ]);

    logger.info("Verification engine: samples loaded", {
      sessionId: session.id,
      motionCount: motionSamples.length,
      gpsCount: gpsSamples.length,
      pedometerCount: pedometerSamples.length,
    });

    // ── Derive session metrics ────────────────────────────────────
    const sessionDurationSeconds = this.calculateDuration(session, gpsSamples);
    const actualValue = this.calculateActualValue(session, gpsSamples, pedometerSamples);

    // ── Bundle check input ────────────────────────────────────────
    const input: CheckInput = {
      session,
      commitmentType,
      gpsSamples,
      motionSamples,
      pedometerSamples,
      sessionDurationSeconds,
      actualValue,
    };

    // ── Run fraud checks ──────────────────────────────────────────
    const fraudResult = this.runFraudChecks(input);

    const result: VerificationResult = {
      sessionId: session.id,
      passed: !fraudResult.fraudDetected,
      fraudDetected: fraudResult.fraudDetected,
      flaggedForReview: fraudResult.flaggedForReview,
      reviewNotes: fraudResult.reviewNotes,
      actualValue,
      sessionDurationSeconds,
    };

    logger.info("Verification engine: result", {
      sessionId: session.id,
      passed: result.passed,
      fraudDetected: result.fraudDetected,
      flaggedForReview: result.flaggedForReview,
      actualValue: result.actualValue,
      durationSeconds: result.sessionDurationSeconds,
    });

    return result;
  }

  // ── Duration calculation ──────────────────────────────────────────

  /**
   * Session duration from sample timestamps (first -> last GPS sample).
   * Falls back to startDate -> endDate if no GPS data.
   */
  private calculateDuration(session: CommitmentSession, gpsSamples: GpsSample[]): number {
    if (gpsSamples.length >= 2) {
      const sorted = sortByTime(gpsSamples);
      const first = sorted[0]!.capturedAt.getTime();
      const last = sorted[sorted.length - 1]!.capturedAt.getTime();
      return Math.round((last - first) / 1000);
    }
    // Fallback: wall-clock time
    const start = session.startDate.getTime();
    const end = session.endDate?.getTime() ?? Date.now();
    return Math.round((end - start) / 1000);
  }

  // ── Actual value calculation ──────────────────────────────────────

  /**
   * Compute the actual value achieved based on the session goal type.
   * - steps:  total step count from the OS pedometer (most reliable)
   * - miles:  sum of haversine distances from GPS (filtered for accuracy)
   */
  private calculateActualValue(
    session: CommitmentSession,
    gpsSamples: GpsSample[],
    pedometerSamples: PedometerSample[],
  ): number {
    switch (session.sessionGoal) {
      case SessionGoalEnum.enum.steps:
        return this.calculateSteps(pedometerSamples);
      case SessionGoalEnum.enum.miles:
        return this.calculateMiles(gpsSamples);
      case SessionGoalEnum.enum.screen_time:
      case SessionGoalEnum.enum.sleep_time:
        // TODO: implement when sleep/screentime commitments are built out
        return 0;
      default:
        return 0;
    }
  }

  /** Total steps from OS pedometer — last cumulative reading. */
  private calculateSteps(pedometerSamples: PedometerSample[]): number {
    if (pedometerSamples.length === 0) return 0;
    const sorted = sortByTime(pedometerSamples);
    return sorted[sorted.length - 1]!.steps;
  }

  /** Total distance in miles from GPS, filtering out low-accuracy and glitch points. */
  private calculateMiles(gpsSamples: GpsSample[]): number {
    const accurate = sortByTime(gpsSamples).filter(
      (s) => s.horizAcc == null || s.horizAcc <= GPS_ACCURACY_FILTER_METERS,
    );
    if (accurate.length < 2) return 0;

    let totalMeters = 0;
    for (let i = 1; i < accurate.length; i++) {
      const prev = accurate[i - 1]!;
      const curr = accurate[i]!;
      const d = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
      if (d < GPS_GLITCH_THRESHOLD_METERS) totalMeters += d;
    }
    return Math.round(metersToMiles(totalMeters) * 100) / 100;
  }

  // ── Fraud check pipeline ──────────────────────────────────────────

  /**
   * Run every check and aggregate into a single FraudCheckResult.
   * One failed check = fraudDetected. Any flagged check = flaggedForReview.
   */
  private runFraudChecks(input: CheckInput): FraudCheckResult {
    const checks: { name: string; fn: (i: CheckInput) => CheckResult }[] = [
      { name: "minimum_data", fn: checkMinimumData },
      { name: "gps_teleportation", fn: checkGpsTeleportation },
      { name: "speed_range", fn: checkSpeedRange },
      { name: "motion_energy", fn: checkMotionEnergy },
      { name: "pedometer_plausibility", fn: checkPedometerPlausibility },
      { name: "timestamp_integrity", fn: checkTimestampIntegrity },
      { name: "gps_motion_correlation", fn: checkGpsMotionCorrelation },
      { name: "session_goal_target", fn: checkSessionGoalTarget },
    ];

    const notes: string[] = [];
    let fraudDetected = false;
    let flaggedForReview = false;

    for (const { name, fn } of checks) {
      const result = fn(input);

      if (!result.passed) {
        fraudDetected = true;
        logger.warn(`Fraud check FAILED: ${name}`, {
          sessionId: input.session.id,
          note: result.note,
        });
      }

      if (result.flagged) {
        flaggedForReview = true;
        logger.info(`Fraud check FLAGGED: ${name}`, {
          sessionId: input.session.id,
          note: result.note,
        });
      }

      if (result.note) {
        notes.push(`[${name}] ${result.note}`);
      }
    }

    return {
      fraudDetected,
      flaggedForReview,
      reviewNotes: notes.length > 0 ? notes.join(" | ") : null,
    };
  }
}

export const verificationService = new VerificationService();
