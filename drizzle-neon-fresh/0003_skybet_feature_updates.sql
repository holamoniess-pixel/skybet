UPDATE "users" SET "referralCode" = 'SKY' || upper(substr(md5("id"::text), 1, 10)), "updatedAt" = now() WHERE "referralCode" IS NULL OR trim("referralCode") = '';
--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."balance_adjustment_type" AS ENUM('deposited', 'bonus');
--> statement-breakpoint
CREATE TABLE "matches" (
  "id" serial PRIMARY KEY NOT NULL,
  "sport" varchar(48) DEFAULT 'Football' NOT NULL,
  "competition" varchar(160) NOT NULL,
  "homeTeam" varchar(120) NOT NULL,
  "awayTeam" varchar(120) NOT NULL,
  "kickoffAt" timestamp NOT NULL,
  "endAt" timestamp,
  "status" "match_status" DEFAULT 'scheduled' NOT NULL,
  "marketsJson" text NOT NULL,
  "homeScore" integer,
  "awayScore" integer,
  "createdBy" integer NOT NULL,
  "updatedBy" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "matches_status_kickoff_idx" ON "matches" USING btree ("status", "kickoffAt");
--> statement-breakpoint
CREATE TABLE "match_score_updates" (
  "id" serial PRIMARY KEY NOT NULL,
  "matchId" integer NOT NULL,
  "minute" integer NOT NULL,
  "homeScore" integer NOT NULL,
  "awayScore" integer NOT NULL,
  "note" varchar(255),
  "createdBy" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "match_score_updates_match_idx" ON "match_score_updates" USING btree ("matchId", "createdAt");
--> statement-breakpoint
CREATE TABLE "balance_adjustments" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "currency" varchar(3) NOT NULL,
  "balanceType" "balance_adjustment_type" NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "beforeBalance" numeric(12, 2) NOT NULL,
  "afterBalance" numeric(12, 2) NOT NULL,
  "reason" text NOT NULL,
  "idempotencyKey" varchar(128) NOT NULL,
  "actorUserId" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "balance_adjustments_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE INDEX "balance_adjustments_user_created_idx" ON "balance_adjustments" USING btree ("userId", "createdAt");
