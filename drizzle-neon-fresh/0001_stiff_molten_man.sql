CREATE TABLE "proof_retention_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"runAt" timestamp DEFAULT now() NOT NULL,
	"cutoffAt" timestamp NOT NULL,
	"candidateCount" integer NOT NULL,
	"deletedCount" integer NOT NULL,
	"legacyAccessRevokedCount" integer NOT NULL,
	"failedCount" integer NOT NULL,
	"status" varchar(24) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_requests" ADD COLUMN "proofStorageProvider" varchar(32);--> statement-breakpoint
ALTER TABLE "payment_requests" ADD COLUMN "proofExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD COLUMN "proofDeletedAt" timestamp;--> statement-breakpoint
CREATE INDEX "payment_requests_proof_expiry_idx" ON "payment_requests" USING btree ("proofExpiresAt");