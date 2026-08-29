CREATE TABLE IF NOT EXISTS "notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "recipientUserId" integer NOT NULL,
  "type" varchar(48) NOT NULL,
  "title" varchar(160) NOT NULL,
  "content" text NOT NULL,
  "readAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "notifications_recipient_created_idx" ON "notifications" ("recipientUserId", "createdAt");
