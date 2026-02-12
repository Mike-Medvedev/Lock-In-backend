/**
 * Valid IANA timezone identifiers (e.g. America/Los_Angeles, Europe/London).
 */
export const IANA_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

/**
 * Time constants in milliseconds
 */
export const MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Default durations for commitments
 */
export const COMMITMENT_DEFAULTS = {
  GRACE_PERIOD_DAYS: 1,
} as const;

export const DURATION_WEEKS = {
  one_weeks: 1,
  two_weeks: 2,
  three_weeks: 3,
  four_weeks: 4,
} as const;

/** Maps workout frequency enum to required sessions per week. */
export const FREQUENCY_SESSIONS_PER_WEEK = {
  three_times_a_week: 3,
  four_times_a_week: 4,
  five_times_a_week: 5,
  six_times_a_week: 6,
  seven_times_a_week: 7,
} as const;

/**
 * Pool rake configuration.
 * The rake is the platform's cut of every forfeited stake.
 */
export const RAKE = {
  /** Fraction of each forfeit taken as rake (0.20 = 20%). */
  RATE: 0.2,
} as const;

/** Valid Job Types for enquing jobs */
export enum JOB_NAMES {
  verify_session = "verify_session",
}
