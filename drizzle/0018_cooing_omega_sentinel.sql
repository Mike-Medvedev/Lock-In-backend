CREATE TABLE "pedometer_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commitment_session_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"steps" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedometer_samples" ADD CONSTRAINT "pedometer_samples_commitment_session_id_commitment_sessions_id_fk" FOREIGN KEY ("commitment_session_id") REFERENCES "public"."commitment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedometer_session_time_idx" ON "pedometer_samples" USING btree ("commitment_session_id","captured_at");