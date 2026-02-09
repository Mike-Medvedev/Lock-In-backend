/**
 * Named constants for the verification engine.
 * All thresholds and magic numbers live here — nothing inline.
 */

import { CommitmentTypeEnum } from "@/features/commitments/commitment.model";
import type { CommitmentType } from "@/features/commitments/commitment.model";
import type { ActivityThresholds } from "./verification.model";

// ── Data density (minimum samples per minute of session) ──────────────

/** Minimum GPS readings per minute (expecting ~12/min at 5 s intervals). */
export const MIN_GPS_SAMPLES_PER_MIN = 3;

/** Minimum motion readings per minute (expecting ~600/min at 10 Hz). */
export const MIN_MOTION_SAMPLES_PER_MIN = 30;

/** Minimum motion samples required before running energy / correlation checks. */
export const MIN_MOTION_SAMPLES_FOR_CHECK = 10;

/** Sessions shorter than this (seconds) are auto-failed. */
export const MIN_SESSION_DURATION_SECONDS = 60;

// ── GPS quality ───────────────────────────────────────────────────────

/** GPS samples with horizontal accuracy worse than this (meters) are discarded. */
export const MAX_GPS_ACCURACY_METERS = 50;

/** Stricter accuracy filter used when calculating actual distance (meters). */
export const GPS_ACCURACY_FILTER_METERS = 30;

/** Single GPS jumps larger than this (meters) are treated as glitches and ignored. */
export const GPS_GLITCH_THRESHOLD_METERS = 100;

/** Minimum total GPS displacement (meters) to count as "real movement". */
export const MIN_GPS_DISPLACEMENT_METERS = 50;

// ── Teleportation detection ───────────────────────────────────────────

/** Ratio of GPS segments exceeding the speed ceiling before flagging fraud. */
export const TELEPORTATION_FAIL_RATIO = 0.15;

// ── Timestamp integrity ───────────────────────────────────────────────

/** Gap between consecutive GPS samples (seconds) that counts as a "large gap". */
export const MAX_TIMESTAMP_GAP_SECONDS = 120;

/** Ratio of large-gap intervals to total intervals before failing. */
export const TIMESTAMP_GAP_FAIL_RATIO = 0.25;

// ── GPS ↔ motion correlation ──────────────────────────────────────────

/** Minimum accelerometer RMS (m/s²) to consider the phone "in motion" for correlation. */
export const MIN_CORRELATION_ACCEL_RMS = 0.2;

// ── Per-activity thresholds ───────────────────────────────────────────

export const ACTIVITY_THRESHOLDS: Partial<Record<CommitmentType, ActivityThresholds>> = {
  [CommitmentTypeEnum.enum.walk]: {
    teleportSpeedMph: 15,
    maxAvgSpeedMph: 7,
    minStepsPerMin: 30,
    maxStepsPerMin: 180,
    minAccelRms: 0.3,
  },
  [CommitmentTypeEnum.enum.run]: {
    teleportSpeedMph: 30,
    maxAvgSpeedMph: 20,
    minStepsPerMin: 80,
    maxStepsPerMin: 260,
    minAccelRms: 0.5,
  },
};

/** Default thresholds when the commitment type has no specific config (e.g. sleep). */
export const DEFAULT_ACTIVITY_THRESHOLDS: ActivityThresholds =
  ACTIVITY_THRESHOLDS[CommitmentTypeEnum.enum.run]!;
