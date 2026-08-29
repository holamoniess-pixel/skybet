ALTER TABLE "wagers" ADD COLUMN IF NOT EXISTS "shareCode" varchar(48);
UPDATE "wagers" SET "shareCode" = "publicReference" WHERE "shareCode" IS NULL;
ALTER TABLE "wagers" ALTER COLUMN "shareCode" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "wagers_share_code_unique" ON "wagers" ("shareCode");
