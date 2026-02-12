ALTER TABLE "transactions" DROP CONSTRAINT "transaction_amount_check";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_amount_check" CHECK ("transactions"."amount" > 0);