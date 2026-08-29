CREATE TABLE IF NOT EXISTS "shared_bet_slips" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" varchar(48) NOT NULL UNIQUE,
  "creatorUserId" integer NOT NULL,
  "source" varchar(16) NOT NULL,
  "selectionsJson" text NOT NULL,
  "odds" numeric(12, 4) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
