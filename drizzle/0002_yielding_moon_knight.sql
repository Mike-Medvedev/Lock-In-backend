-- Drop foreign key constraints first
ALTER TABLE "commitment_sessions" DROP CONSTRAINT IF EXISTS "commitment_sessions_commitment_id_commitments_id_fk";--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_commitment_id_commitments_id_fk";--> statement-breakpoint

-- Drop the foreign key columns
ALTER TABLE "commitment_sessions" DROP COLUMN "commitment_id";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "commitment_id";--> statement-breakpoint

-- Change commitments.id from integer to uuid
ALTER TABLE "commitments" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "commitments" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid();--> statement-breakpoint

-- Re-add foreign key columns as uuid
ALTER TABLE "commitment_sessions" ADD COLUMN "commitment_id" uuid REFERENCES "commitments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "commitment_id" uuid NOT NULL REFERENCES "commitments"("id") ON DELETE CASCADE;
