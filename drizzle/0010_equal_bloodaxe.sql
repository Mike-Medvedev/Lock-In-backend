CREATE TYPE "public"."verification_status" AS ENUM('not_started', 'pending', 'failed', 'succeeded');--> statement-breakpoint
ALTER TABLE "commitment_sessions" ALTER COLUMN "session_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "commitment_sessions" ALTER COLUMN "session_status" SET DEFAULT 'not_started'::text;--> statement-breakpoint
DROP TYPE "public"."session_status";--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('not_started', 'in_progress', 'paused', 'completed', 'cancelled');--> statement-breakpoint
ALTER TABLE "commitment_sessions" ALTER COLUMN "session_status" SET DEFAULT 'not_started'::"public"."session_status";--> statement-breakpoint
ALTER TABLE "commitment_sessions" ALTER COLUMN "session_status" SET DATA TYPE "public"."session_status" USING "session_status"::"public"."session_status";--> statement-breakpoint
ALTER TABLE "commitment_sessions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commitment_sessions" ALTER COLUMN "commitment_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commitment_sessions" ADD COLUMN "verification_status" "verification_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "commitment_sessions" ADD CONSTRAINT "one_session_per_commitment_per_day" UNIQUE("commitment_id","counting_day");