ALTER TYPE "public"."commitment_status" ADD VALUE 'refund_pending';--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'refund';--> statement-breakpoint
ALTER TABLE "pool" ADD COLUMN "stakes_held" double precision DEFAULT 0 NOT NULL;