CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "status" "transaction_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;