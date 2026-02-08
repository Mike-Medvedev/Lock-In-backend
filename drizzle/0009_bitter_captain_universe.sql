ALTER TABLE "commitments" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "one_commitment_per_user" UNIQUE("user_id");