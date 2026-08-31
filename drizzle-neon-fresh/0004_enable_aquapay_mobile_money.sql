INSERT INTO "payment_method_configs" ("method", "displayName", "network", "destination", "status")
VALUES ('aquapay', 'AquaPay Mobile Money', 'GHS', NULL, 'enabled')
ON CONFLICT ("method") DO UPDATE
SET "displayName" = EXCLUDED."displayName",
    "network" = EXCLUDED."network",
    "destination" = EXCLUDED."destination",
    "status" = 'enabled',
    "updatedAt" = NOW();
