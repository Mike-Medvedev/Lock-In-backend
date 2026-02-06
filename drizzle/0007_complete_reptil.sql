CREATE TABLE "duration_lookup" (
	"duration" "commitment_duration" PRIMARY KEY NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frequency_lookup" (
	"frequency" "workout_frequency" PRIMARY KEY NOT NULL,
	"value" integer NOT NULL
);
