/**
 * Individual fraud-detection checks for the verification engine.
 *
 * Each check is a pure function: takes sensor data + context, returns a CheckResult.
 * The orchestrator in verification.service.ts runs them all and aggregates.
 */

import type { CommitmentType } from "@/features/commitments/commitment.model";
import { SessionGoalEnum } from "@/features/commitment-sessions/commitment-sessions.model";
import type {
  ActivityThresholds,
  CheckInput,
  CheckResult,
  GoalTargets,
} from "./verification.model";
import { haversineMeters, mpsToMph, accelMagnitude, rms, sortByTime } from "./verification.utils";
import {
  MIN_GPS_SAMPLES_PER_MIN,
  MIN_MOTION_SAMPLES_PER_MIN,
  MIN_MOTION_SAMPLES_FOR_CHECK,
  MIN_SESSION_DURATION_SECONDS,
  MAX_GPS_ACCURACY_METERS,
  MIN_GPS_DISPLACEMENT_METERS,
  MIN_CORRELATION_ACCEL_RMS,
  TELEPORTATION_FAIL_RATIO,
  MAX_TIMESTAMP_GAP_SECONDS,
  TIMESTAMP_GAP_FAIL_RATIO,
  ACTIVITY_THRESHOLDS,
  DEFAULT_ACTIVITY_THRESHOLDS,
  SESSION_GOAL_TARGETS,
  DEFAULT_GOAL_TARGETS,
} from "./verification.constants";

// ── Helpers ───────────────────────────────────────────────────────────

/** Resolve thresholds for a commitment type, falling back to the default. */
function getThresholds(commitmentType: CommitmentType): ActivityThresholds {
  return ACTIVITY_THRESHOLDS[commitmentType] ?? DEFAULT_ACTIVITY_THRESHOLDS;
}

/** Resolve goal targets for a commitment type, falling back to the default. */
function getGoalTargets(commitmentType: CommitmentType): GoalTargets {
  return SESSION_GOAL_TARGETS[commitmentType] ?? DEFAULT_GOAL_TARGETS;
}

// ── Check implementations ─────────────────────────────────────────────

/**
 * Enough GPS + motion samples collected relative to session duration.
 * Too few means the app was backgrounded or data was fabricated.
 */
export function checkMinimumData(input: CheckInput): CheckResult {
  const durationSeconds = input.sessionDurationSeconds;

  if (durationSeconds < MIN_SESSION_DURATION_SECONDS) {
    return { passed: false, flagged: false, note: "Session too short (< 1 minute)" };
  }

  const mins = durationSeconds / 60;
  const needGps = Math.round(mins * MIN_GPS_SAMPLES_PER_MIN);
  const needMotion = Math.round(mins * MIN_MOTION_SAMPLES_PER_MIN);

  const hasGps = input.gpsSamples.length >= needGps;
  const hasMotion = input.motionSamples.length >= needMotion;

  if (!hasGps && !hasMotion) {
    return {
      passed: false,
      flagged: false,
      note: `Insufficient data: ${input.gpsSamples.length} GPS (need ${needGps}), ${input.motionSamples.length} motion (need ${needMotion})`,
    };
  }

  if (!hasGps || !hasMotion) {
    return {
      passed: true,
      flagged: true,
      note: `Low data density: ${input.gpsSamples.length} GPS, ${input.motionSamples.length} motion for ${Math.round(mins)} min session`,
    };
  }

  return { passed: true, flagged: false, note: null };
}

/**
 * Detect GPS teleportation — impossible speed between consecutive GPS points.
 * If more than TELEPORTATION_FAIL_RATIO of segments exceed the speed ceiling, flag fraud.
 */
export function checkGpsTeleportation(input: CheckInput): CheckResult {
  const sorted = sortByTime(input.gpsSamples);
  if (sorted.length < 2) {
    return { passed: true, flagged: true, note: "Not enough GPS points to check teleportation" };
  }

  const limit = getThresholds(input.commitmentType).teleportSpeedMph;
  let violations = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const dtSec = (curr.capturedAt.getTime() - prev.capturedAt.getTime()) / 1000;
    if (dtSec <= 0) continue;

    const dist = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
    if (mpsToMph(dist / dtSec) > limit) violations++;
  }

  const segments = sorted.length - 1;
  const ratio = violations / segments;

  if (ratio > TELEPORTATION_FAIL_RATIO) {
    return {
      passed: false,
      flagged: false,
      note: `GPS teleportation: ${violations}/${segments} segments exceed ${limit} mph (${(ratio * 100).toFixed(1)}%)`,
    };
  }

  if (violations > 0) {
    return {
      passed: true,
      flagged: true,
      note: `${violations} GPS segments exceeded speed limit (likely GPS drift)`,
    };
  }

  return { passed: true, flagged: false, note: null };
}

/**
 * Check that average GPS speed is within the plausible range for the activity.
 * Catches people driving or sitting still with a GPS spoofer.
 */
export function checkSpeedRange(input: CheckInput): CheckResult {
  const sorted = sortByTime(input.gpsSamples).filter(
    (s) => s.horizAcc == null || s.horizAcc <= MAX_GPS_ACCURACY_METERS,
  );

  if (sorted.length < 2) {
    return { passed: true, flagged: true, note: "Not enough accurate GPS points for speed check" };
  }

  let totalDist = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    totalDist += haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
  }

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const totalTimeSec = (last.capturedAt.getTime() - first.capturedAt.getTime()) / 1000;

  if (totalTimeSec <= 0) {
    return { passed: true, flagged: true, note: "GPS time span is zero" };
  }

  const avgMph = mpsToMph(totalDist / totalTimeSec);
  const maxMph = getThresholds(input.commitmentType).maxAvgSpeedMph;

  if (avgMph > maxMph) {
    return {
      passed: false,
      flagged: false,
      note: `Average speed ${avgMph.toFixed(1)} mph exceeds max ${maxMph} mph for ${input.commitmentType}`,
    };
  }

  return { passed: true, flagged: false, note: null };
}

/**
 * Verify the accelerometer shows real movement energy.
 * A phone sitting on a desk or in a car has a very different RMS profile than walking/running.
 */
export function checkMotionEnergy(input: CheckInput): CheckResult {
  const samples = input.motionSamples;
  if (samples.length < MIN_MOTION_SAMPLES_FOR_CHECK) {
    return { passed: true, flagged: true, note: "Not enough motion samples for energy check" };
  }

  // Compute magnitude of acceleration-without-gravity for each sample
  const magnitudes = samples
    .filter((s) => s.accelX != null && s.accelY != null && s.accelZ != null)
    .map((s) => accelMagnitude(s.accelX!, s.accelY!, s.accelZ!));

  if (magnitudes.length < MIN_MOTION_SAMPLES_FOR_CHECK) {
    return { passed: true, flagged: true, note: "Insufficient accel data for energy check" };
  }

  const motionRms = rms(magnitudes);
  const minRequired = getThresholds(input.commitmentType).minAccelRms;

  if (motionRms < minRequired) {
    return {
      passed: false,
      flagged: false,
      note: `Motion energy too low: RMS ${motionRms.toFixed(3)} m/s² (need >= ${minRequired})`,
    };
  }

  return { passed: true, flagged: false, note: null };
}

/**
 * Cross-check OS pedometer step count against session duration.
 * The OS pedometer runs on dedicated hardware and is hard to spoof.
 */
export function checkPedometerPlausibility(input: CheckInput): CheckResult {
  const sorted = sortByTime(input.pedometerSamples);
  if (sorted.length === 0) {
    // No pedometer data isn't fraud — some devices don't support it
    return { passed: true, flagged: true, note: "No pedometer data available" };
  }

  const totalSteps = sorted[sorted.length - 1]!.steps;
  const durationMin = input.sessionDurationSeconds / 60;

  if (durationMin < 1) {
    return { passed: true, flagged: false, note: null };
  }

  const stepsPerMin = totalSteps / durationMin;
  const { minStepsPerMin, maxStepsPerMin } = getThresholds(input.commitmentType);

  if (stepsPerMin < minStepsPerMin) {
    return {
      passed: false,
      flagged: false,
      note: `Pedometer: ${stepsPerMin.toFixed(0)} steps/min (need >= ${minStepsPerMin} for ${input.commitmentType})`,
    };
  }

  if (stepsPerMin > maxStepsPerMin) {
    return {
      passed: false,
      flagged: false,
      note: `Pedometer: ${stepsPerMin.toFixed(0)} steps/min exceeds max ${maxStepsPerMin} for ${input.commitmentType}`,
    };
  }

  return { passed: true, flagged: false, note: null };
}

/**
 * Detect large timestamp gaps in GPS data (app was backgrounded or data fabricated).
 * A few gaps are normal (tunnels, buildings), but many means something is off.
 */
export function checkTimestampIntegrity(input: CheckInput): CheckResult {
  const sorted = sortByTime(input.gpsSamples);
  if (sorted.length < 2) {
    return { passed: true, flagged: false, note: null };
  }

  let largeGaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const gapSec = (curr.capturedAt.getTime() - prev.capturedAt.getTime()) / 1000;
    if (gapSec > MAX_TIMESTAMP_GAP_SECONDS) largeGaps++;
  }

  const intervals = sorted.length - 1;
  const ratio = largeGaps / intervals;

  if (ratio > TIMESTAMP_GAP_FAIL_RATIO) {
    return {
      passed: false,
      flagged: false,
      note: `Timestamp gaps: ${largeGaps}/${intervals} intervals exceed ${MAX_TIMESTAMP_GAP_SECONDS}s`,
    };
  }

  if (largeGaps > 0) {
    return {
      passed: true,
      flagged: true,
      note: `${largeGaps} timestamp gap(s) > ${MAX_TIMESTAMP_GAP_SECONDS}s detected`,
    };
  }

  return { passed: true, flagged: false, note: null };
}

/**
 * Cross-check: GPS displacement should correlate with accelerometer activity.
 * If GPS shows distance but accelerometer is flat (or vice versa), one is spoofed.
 */
export function checkGpsMotionCorrelation(input: CheckInput): CheckResult {
  const gpsSorted = sortByTime(input.gpsSamples);
  if (gpsSorted.length < 2 || input.motionSamples.length < MIN_MOTION_SAMPLES_FOR_CHECK) {
    return { passed: true, flagged: false, note: null };
  }

  // Total GPS distance
  let totalDist = 0;
  for (let i = 1; i < gpsSorted.length; i++) {
    const prev = gpsSorted[i - 1]!;
    const curr = gpsSorted[i]!;
    totalDist += haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
  }

  const hasGpsMovement = totalDist > MIN_GPS_DISPLACEMENT_METERS;

  // Accelerometer energy
  const magnitudes = input.motionSamples
    .filter((s) => s.accelX != null && s.accelY != null && s.accelZ != null)
    .map((s) => accelMagnitude(s.accelX!, s.accelY!, s.accelZ!));
  const motionRms = rms(magnitudes);
  const hasMotionEnergy = motionRms > MIN_CORRELATION_ACCEL_RMS;

  // GPS says moving but accelerometer says still -> GPS spoof
  if (hasGpsMovement && !hasMotionEnergy) {
    return {
      passed: false,
      flagged: false,
      note: `GPS shows ${totalDist.toFixed(0)}m displacement but accelerometer RMS is only ${motionRms.toFixed(3)} m/s²`,
    };
  }

  // Accelerometer says moving but GPS says still -> could be treadmill, flag but don't fail
  if (!hasGpsMovement && hasMotionEnergy) {
    return {
      passed: true,
      flagged: true,
      note: `Motion energy detected (RMS ${motionRms.toFixed(3)}) but GPS displacement only ${totalDist.toFixed(0)}m (treadmill?)`,
    };
  }

  return { passed: true, flagged: false, note: null };
}

// ── Session goal target check ─────────────────────────────────────────

/**
 * Verify the session achieved a minimum effort threshold for its goal type.
 * A user who walks 50 steps in 30 minutes technically moved, but didn't
 * put in real effort. This check ensures the session meets a baseline target.
 *
 * Targets are defined per activity type in SESSION_GOAL_TARGETS.
 */
export function checkSessionGoalTarget(input: CheckInput): CheckResult {
  const { session, commitmentType, actualValue } = input;
  const targets = getGoalTargets(commitmentType);
  const actual = actualValue;

  switch (session.sessionGoal) {
    case SessionGoalEnum.enum.steps: {
      if (actual < targets.minSteps) {
        return {
          passed: false,
          flagged: false,
          note: `Steps too low: ${actual} (need >= ${targets.minSteps} for ${commitmentType})`,
        };
      }
      return { passed: true, flagged: false, note: null };
    }

    case SessionGoalEnum.enum.miles: {
      if (actual < targets.minMiles) {
        return {
          passed: false,
          flagged: false,
          note: `Distance too low: ${actual} mi (need >= ${targets.minMiles} mi for ${commitmentType})`,
        };
      }
      return { passed: true, flagged: false, note: null };
    }

    case SessionGoalEnum.enum.screen_time:
    case SessionGoalEnum.enum.sleep_time:
      // Not implemented yet — pass through without checking
      return {
        passed: true,
        flagged: true,
        note: `Goal type "${session.sessionGoal}" has no target threshold yet`,
      };

    default:
      return { passed: true, flagged: true, note: `Unknown goal type: ${session.sessionGoal}` };
  }
}
