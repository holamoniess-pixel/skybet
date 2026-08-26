CREATE TYPE "public"."account_payment_status" AS ENUM('active', 'held');--> statement-breakpoint
CREATE TYPE "public"."payment_actor_role" AS ENUM('customer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('crypto_trc20', 'aquapay');--> statement-breakpoint
CREATE TYPE "public"."payment_method_status" AS ENUM('enabled', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."payment_request_status" AS ENUM('submitted', 'under_review', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_request_type" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."rule_status" AS ENUM('active', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "account_balance_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"depositedBalance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"bonusBalance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_balance_summaries_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "account_payment_controls" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"status" "account_payment_status" DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"updatedBy" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_payment_controls_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorUserId" integer NOT NULL,
	"entityType" varchar(64) NOT NULL,
	"entityId" integer NOT NULL,
	"action" varchar(64) NOT NULL,
	"beforeJson" text,
	"afterJson" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bonus_policy_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"referralCommissionAmount" numeric(12, 2) NOT NULL,
	"depositBonusAmount" numeric(12, 2) NOT NULL,
	"settlementBonusAmount" numeric(12, 2) NOT NULL,
	"status" "rule_status" DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"effectiveAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bonus_policy_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"currency" varchar(3) NOT NULL,
	"referralCommissionAmount" numeric(12, 2) NOT NULL,
	"depositBonusAmount" numeric(12, 2) NOT NULL,
	"settlementBonusAmount" numeric(12, 2) NOT NULL,
	"status" "rule_status" DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"effectiveAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_credentials_userId_unique" UNIQUE("userId"),
	CONSTRAINT "customer_credentials_email_unique" UNIQUE("email"),
	CONSTRAINT "customer_credentials_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tokenHash" varchar(128) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_sessions_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "local_admin_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "local_admin_credentials_userId_unique" UNIQUE("userId"),
	CONSTRAINT "local_admin_credentials_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "payment_method_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"method" "payment_method" NOT NULL,
	"displayName" varchar(100) NOT NULL,
	"network" varchar(32),
	"destination" varchar(255),
	"status" "payment_method_status" DEFAULT 'disabled' NOT NULL,
	"updatedBy" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_method_configs_method_unique" UNIQUE("method")
);
--> statement-breakpoint
CREATE TABLE "payment_request_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"paymentRequestId" integer NOT NULL,
	"actorUserId" integer NOT NULL,
	"actorRole" "payment_actor_role" NOT NULL,
	"action" varchar(64) NOT NULL,
	"detailsJson" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicReference" varchar(48) NOT NULL,
	"userId" integer NOT NULL,
	"requestType" "payment_request_type" NOT NULL,
	"method" "payment_method" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"customerPaymentReference" varchar(128),
	"payoutDestination" varchar(255),
	"proofStorageKey" varchar(512),
	"proofMimeType" varchar(100),
	"status" "payment_request_status" DEFAULT 'submitted' NOT NULL,
	"reviewReason" text,
	"reviewedBy" integer,
	"reviewedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_requests_publicReference_unique" UNIQUE("publicReference")
);
--> statement-breakpoint
CREATE TABLE "referral_commission_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"status" "rule_status" DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"effectiveAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_commission_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"status" "rule_status" DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"effectiveAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_reward_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"reason" text NOT NULL,
	"status" "rule_status" DEFAULT 'active' NOT NULL,
	"effectiveAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_reward_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "rule_status" DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"effectiveAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_requests_method_reference_unique" ON "payment_requests" USING btree ("method","customerPaymentReference");