CREATE TABLE IF NOT EXISTS "shared_bet_slips" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" varchar(48) NOT NULL UNIQUE,
  "creatorUserId" integer NOT NULL,
  "source" varchar(16) NOT NULL,
  "selectionsJson" text NOT NULL,
  "odds" numeric(12, 4) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wagers" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "publicReference" varchar(48) NOT NULL UNIQUE,
  "shareCode" varchar(48) NOT NULL UNIQUE,
  "idempotencyKey" varchar(128) NOT NULL UNIQUE,
  "currency" varchar(3) NOT NULL,
  "stake" numeric(12, 2) NOT NULL,
  "odds" numeric(12, 4) NOT NULL,
  "potentialReturn" numeric(12, 2) NOT NULL,
  "selectionsJson" text NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wagers" ADD COLUMN IF NOT EXISTS "shareCode" varchar(48);
--> statement-breakpoint
UPDATE "wagers" SET "shareCode" = "publicReference" WHERE "shareCode" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wagers_share_code_unique" ON "wagers" ("shareCode");
--> statement-breakpoint
ALTER TABLE "wagers" ALTER COLUMN "shareCode" SET NOT NULL;
