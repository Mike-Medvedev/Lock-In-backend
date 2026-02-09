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
