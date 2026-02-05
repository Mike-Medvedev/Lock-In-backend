CREATE TYPE "public"."commitment_duration" AS ENUM('one_weeks', 'two_weeks', 'three_weeks', 'four_weeks');--> statement-breakpoint
CREATE TYPE "public"."commitment_status" AS ENUM('pending_grace_period', 'active', 'completed', 'forfeited', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."commitment_type" AS ENUM('walk', 'run', 'sleep', 'screentime');--> statement-breakpoint
CREATE TYPE "public"."session_goal_type" AS ENUM('steps', 'miles', 'screen_time', 'sleep_time');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('not_started', 'in_progress', 'paused', 'completed', 'verification_pending', 'verification_failed', 'verification_succeeded');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('stake', 'payout', 'forfeit', 'rake');--> statement-breakpoint
CREATE TYPE "public"."workout_frequency" AS ENUM('three_times_a_week', 'four_times_a_week', 'five_times_a_week', 'six_times_a_week', 'seven_times_a_week');--> statement-breakpoint
CREATE TABLE "commitment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"commitment_id" integer,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"counting_day" date NOT NULL,
	"session_duration" double precision DEFAULT 0 NOT NULL,
	"session_status" "session_status" DEFAULT 'not_started' NOT NULL,
	"session_goal" "session_goal_type" NOT NULL,
	"actual_value" double precision,
	"flagged_for_review" boolean DEFAULT false NOT NULL,
	"fraud_detected" boolean DEFAULT false NOT NULL,
	"review_notes" text
);
--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commitments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid,
	"type" "commitment_type" NOT NULL,
	"frequency" "workout_frequency" NOT NULL,
	"duration" "commitment_duration" NOT NULL,
	"session_goal" "session_goal_type" NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stake_amount" bigint NOT NULL,
	"locked_bonus_amount" bigint DEFAULT 0 NOT NULL,
	"status" "commitment_status" DEFAULT 'pending_grace_period' NOT NULL,
	"grace_period_ends_at" timestamp with time zone NOT NULL,
	"is_refundable" boolean DEFAULT true NOT NULL,
	CONSTRAINT "stake_amount_check" CHECK ("commitments"."stake_amount" between 50 and 10000)
);
--> statement-breakpoint
CREATE TABLE "gps_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commitment_session_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"speed_mps" double precision,
	"heading_deg" double precision,
	"horiz_acc" double precision
);
--> statement-breakpoint
CREATE TABLE "motion_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commitment_session_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"interval_ms" double precision,
	"accel_x" double precision,
	"accel_y" double precision,
	"accel_z" double precision,
	"accel_gx" double precision,
	"accel_gy" double precision,
	"accel_gz" double precision,
	"rot_alpha" double precision,
	"rot_beta" double precision,
	"rot_gamma" double precision,
	"rot_rate_alpha" double precision,
	"rot_rate_beta" double precision,
	"rot_rate_gamma" double precision,
	"orientation" double precision
);
--> statement-breakpoint
CREATE TABLE "pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"total_rake_collected" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"commitment_id" integer NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_transaction_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_amount_check" CHECK ("transactions"."amount" > 50)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"phone" varchar,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "commitment_sessions" ADD CONSTRAINT "commitment_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment_sessions" ADD CONSTRAINT "commitment_sessions_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."commitments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_samples" ADD CONSTRAINT "gps_samples_commitment_session_id_commitment_sessions_id_fk" FOREIGN KEY ("commitment_session_id") REFERENCES "public"."commitment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motion_samples" ADD CONSTRAINT "motion_samples_commitment_session_id_commitment_sessions_id_fk" FOREIGN KEY ("commitment_session_id") REFERENCES "public"."commitment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."commitments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gps_session_time_idx" ON "gps_samples" USING btree ("commitment_session_id","captured_at");--> statement-breakpoint
CREATE INDEX "motion_session_time_idx" ON "motion_samples" USING btree ("commitment_session_id","captured_at");