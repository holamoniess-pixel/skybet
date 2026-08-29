ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" varchar(32);
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique" ON "users" ("referralCode") WHERE "referralCode" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "referral_attributions" (
  "id" serial PRIMARY KEY NOT NULL,
  "referrerUserId" integer NOT NULL,
  "referredUserId" integer NOT NULL UNIQUE,
  "referralCode" varchar(32) NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referral_reward_credits" (
  "id" serial PRIMARY KEY NOT NULL,
  "attributionId" integer NOT NULL UNIQUE,
  "referrerUserId" integer NOT NULL,
  "referredUserId" integer NOT NULL,
  "paymentRequestId" integer NOT NULL UNIQUE,
  "amount" numeric(12, 2) NOT NULL,
  "currency" varchar(3) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "referral_attributions_referrer_idx" ON "referral_attributions" ("referrerUserId");
CREATE INDEX IF NOT EXISTS "referral_reward_credits_referrer_idx" ON "referral_reward_credits" ("referrerUserId");

CREATE TABLE IF NOT EXISTS "wagers" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "publicReference" varchar(48) NOT NULL UNIQUE,
  "idempotencyKey" varchar(128) NOT NULL UNIQUE,
  "currency" varchar(3) NOT NULL,
  "stake" numeric(12, 2) NOT NULL,
  "odds" numeric(12, 4) NOT NULL,
  "potentialReturn" numeric(12, 2) NOT NULL,
  "selectionsJson" text NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "wagers_user_created_idx" ON "wagers" ("userId", "createdAt");
