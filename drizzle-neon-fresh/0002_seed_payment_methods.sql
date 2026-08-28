INSERT INTO "payment_method_configs" ("method", "displayName", "network", "destination", "status")
VALUES
  ('crypto_trc20', 'Crypto deposit', 'TRC20', 'TQCHL828z5VyKGRkw3jUThrURnG9tpsS6G', 'enabled'),
  ('aquapay', 'Aquapay local GHS', NULL, NULL, 'disabled')
ON CONFLICT ("method") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "network" = EXCLUDED."network",
  "destination" = EXCLUDED."destination",
  "status" = EXCLUDED."status";
