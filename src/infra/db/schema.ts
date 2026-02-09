import {
  pgTable,
  pgEnum,
  varchar,
  bigint,
  check,
  boolean,
  timestamp,
  doublePrecision,
  index,
  uniqueIndex,
  uuid,
  text,
  date,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const commitmentType = pgEnum("commitment_type", ["walk", "run", "sleep", "screentime"]);

export const commitmentDuration = pgEnum("commitment_duration", [
  "one_weeks",
  "two_weeks",
  "three_weeks",
  "four_weeks",
]);

export const workoutFrequency = pgEnum("workout_frequency", [
  "three_times_a_week",
  "four_times_a_week",
  "five_times_a_week",
  "six_times_a_week",
  "seven_times_a_week",
]);

export const sessionGoalType = pgEnum("session_goal_type", [
  "steps",
  "miles",
  "screen_time",
  "sleep_time",
]);

export const commitmentStatus = pgEnum("commitment_status", [
  "pending_payment",
  "payment_processing",
  "active",
  "completed",
  "forfeited",
  "cancelled",
  "cancelled_refunded",
  "refund_pending",
]);

export const sessionStatus = pgEnum("session_status", [
  "not_started",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
]);

export const verificationStatus = pgEnum("verification_status", [
  "not_started",
  "pending",
  "failed",
  "succeeded",
]);

export const transactionType = pgEnum("transaction_type", [
  "stake",
  "payout",
  "forfeit",
  "rake",
  "refund",
]);

export const transactionStatus = pgEnum("transaction_status", ["pending", "succeeded", "failed"]);

export const users = pgTable("users", {
  id: uuid().primaryKey(), // UUID from Supabase Auth - no default, you provide it
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone").unique(),
  email: text().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  isPremium: boolean().default(false),
});

export const commitments = pgTable(
  "commitments",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: commitmentType().notNull(),
    frequency: workoutFrequency().notNull(),
    duration: commitmentDuration().notNull(),
    sessionGoal: sessionGoalType("session_goal").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    stakeAmount: bigint("stake_amount", { mode: "number" }).notNull(), // 50-10000 cents
    lockedBonusAmount: bigint("locked_bonus_amount", { mode: "number" }).notNull().default(0),
    status: commitmentStatus().notNull().default("pending_payment"),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true }).notNull(), // createdAt + 1 day
  },
  (table) => [check("stake_amount_check", sql`${table.stakeAmount} between 50 and 10000`)],
);

export const commitmentSessions = pgTable(
  "commitment_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commitmentId: uuid("commitment_id")
      .notNull()
      .references(() => commitments.id, { onDelete: "cascade" }),
    startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("UTC"), // IANA timezone the session was started in (e.g. America/Los_Angeles)
    countingDay: date("counting_day").notNull(), // Derived from startDate in timezone; calendar day only
    sessionDuration: doublePrecision("session_duration").notNull().default(0),
    sessionStatus: sessionStatus("session_status").notNull().default("not_started"),
    verificationStatus: verificationStatus("verification_status").notNull().default("not_started"),
    sessionGoal: sessionGoalType("session_goal").notNull(),
    actualValue: doublePrecision("actual_value"), // Actual steps, miles, etc. achieved
    flaggedForReview: boolean("flagged_for_review").notNull().default(false),
    fraudDetected: boolean("fraud_detected").notNull().default(false),
    reviewNotes: text("review_notes"),
  },
  (table) => [
    uniqueIndex("one_active_session_per_commitment_per_day")
      .on(table.commitmentId, table.countingDay)
      .where(sql`${table.sessionStatus} != 'cancelled'`),
  ],
);

export const motionSamples = pgTable(
  "motion_samples",
  {
    id: uuid().primaryKey().defaultRandom(),
    commitmentSessionId: uuid("commitment_session_id")
      .notNull()
      .references(() => commitmentSessions.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    intervalMs: doublePrecision("interval_ms"),

    // Acceleration (m/s^2) without gravity
    accelX: doublePrecision("accel_x"),
    accelY: doublePrecision("accel_y"),
    accelZ: doublePrecision("accel_z"),

    // Acceleration including gravity
    accelGX: doublePrecision("accel_gx"),
    accelGY: doublePrecision("accel_gy"),
    accelGZ: doublePrecision("accel_gz"),

    // Rotation (degrees)
    rotAlpha: doublePrecision("rot_alpha"),
    rotBeta: doublePrecision("rot_beta"),
    rotGamma: doublePrecision("rot_gamma"),

    // Rotation rate (deg/s)
    rotRateAlpha: doublePrecision("rot_rate_alpha"),
    rotRateBeta: doublePrecision("rot_rate_beta"),
    rotRateGamma: doublePrecision("rot_rate_gamma"),

    orientation: doublePrecision("orientation"),
  },
  (t) => [index("motion_session_time_idx").on(t.commitmentSessionId, t.capturedAt)],
);

export const gpsSamples = pgTable(
  "gps_samples",
  {
    id: uuid().primaryKey().defaultRandom(),
    commitmentSessionId: uuid("commitment_session_id")
      .notNull()
      .references(() => commitmentSessions.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),

    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    speedMps: doublePrecision("speed_mps"),
    headingDeg: doublePrecision("heading_deg"),
    horizAcc: doublePrecision("horiz_acc"), // accuracy in lat/lng readings in meters
  },
  (t) => [index("gps_session_time_idx").on(t.commitmentSessionId, t.capturedAt)],
);

export const pedometerSamples = pgTable(
  "pedometer_samples",
  {
    id: uuid().primaryKey().defaultRandom(),
    commitmentSessionId: uuid("commitment_session_id")
      .notNull()
      .references(() => commitmentSessions.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    steps: integer("steps").notNull(), // cumulative step count from OS pedometer since session start
  },
  (t) => [index("pedometer_session_time_idx").on(t.commitmentSessionId, t.capturedAt)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    commitmentId: uuid("commitment_id")
      .notNull()
      .references(() => commitments.id, { onDelete: "cascade" }),
    transactionType: transactionType("transaction_type").notNull(),
    status: transactionStatus("status").notNull().default("pending"),
    stripeCustomerId: text("stripe_customer_id"), // nullable for guest payments
    stripeTransactionId: text("stripe_transaction_id").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(), // > 50 cents
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("transaction_amount_check", sql`${table.amount} > 50`)],
);

export const pool = pgTable("pool", {
  id: uuid().primaryKey().defaultRandom(),
  /** Stakes we're holding (owed back to users if they complete or get refunded). In dollars. */
  stakesHeld: doublePrecision("stakes_held").notNull().default(0),
  /** Actual pool money from forfeits (and rake); funds completion bonuses. In dollars. */
  balance: doublePrecision("balance").notNull().default(0),
  totalRakeCollected: doublePrecision("total_rake_collected").notNull().default(0), // 20% of all forfeitures
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const frequencyLookup = pgTable("frequency_lookup", {
  frequency: workoutFrequency().notNull().primaryKey(),
  value: integer().notNull(),
});

export const durationLookup = pgTable("duration_lookup", {
  duration: commitmentDuration().notNull().primaryKey(),
  value: integer().notNull(),
});
