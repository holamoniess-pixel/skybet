ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "targetHomeScore" integer;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "targetAwayScore" integer;
