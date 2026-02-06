ALTER TABLE "commitments" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "commitments" ALTER COLUMN "status" SET DEFAULT 'active'::text;--> statement-breakpoint
DROP TYPE "public"."commitment_status";--> statement-breakpoint
CREATE TYPE "public"."commitment_status" AS ENUM('active', 'completed', 'forfeited', 'cancelled');--> statement-breakpoint
ALTER TABLE "commitments" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."commitment_status";--> statement-breakpoint
ALTER TABLE "commitments" ALTER COLUMN "status" SET DATA TYPE "public"."commitment_status" USING "status"::"public"."commitment_status";--> statement-breakpoint
ALTER TABLE "commitments" ADD COLUMN "inGracePeriod" boolean DEFAULT true;