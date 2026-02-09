ALTER TYPE "public"."commitment_status" ADD VALUE IF NOT EXISTS 'pending_payment' BEFORE 'active';
ALTER TYPE "public"."commitment_status" ADD VALUE IF NOT EXISTS 'payment_processing' BEFORE 'active';