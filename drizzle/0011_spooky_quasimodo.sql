-- Before running this migration, run once in psql or Supabase SQL editor (ADD VALUE cannot run in a transaction):
--   ALTER TYPE verification_status ADD VALUE 'not_started';
ALTER TABLE "commitment_sessions" ALTER COLUMN "verification_status" SET DEFAULT 'not_started';
