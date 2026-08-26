# SKYBET Neon PostgreSQL Migration Runbook

## Current result

SKYBET’s Drizzle schema and database helper layer now use PostgreSQL-compatible primitives and `postgres-js`. The historical MySQL migration chain remains preserved under `drizzle/`; the new Neon migration is isolated under `drizzle-neon-fresh/` so the two dialect histories cannot be mixed accidentally.

A disposable Neon branch named `skybet-schema-staging` was created in project `skybet` and received the reviewed initial migration. The branch contains the expected sixteen SKYBET application tables in `public`, alongside Neon’s own `neon_auth` tables. The Neon production branch was not changed during this staging step.

## Application changes

The runtime now constructs Drizzle with `drizzle-orm/postgres-js`, uses `onConflictDoUpdate` for the user upsert, and uses PostgreSQL `returning()` for generated IDs throughout customer auth, administrator, policy, payment-request, and referral-commission writes. The historical MySQL dependency is no longer imported by the application code.

## Railway cutover

Before directing Railway at Neon, the owner must add the Neon PostgreSQL connection string to the Railway service’s `DATABASE_URL` variable using Railway’s Variables panel. The value should be copied directly from the Neon console or a secure Neon connection-string view and must not be pasted into chat, source files, or GitHub Actions logs. Railway should then deploy the current `main` commit and be checked at `/health` plus `/api/auth/me`.

The current application schema is empty on Neon production, so production cutover must not be treated as a data migration from the old MySQL database. If the existing managed database contains real customer records, a separate export, transformation, reconciliation, and owner-approved import is required before switching Railway. No real customer data was copied by this task.

## Remaining prerequisites

Sentry and Sanity still require owner-selected projects and secure credentials. The Railway source mapping, production variables, CORS allowlist, and rollback path remain console-level checks. Supabase is optional auxiliary infrastructure and is not the runtime host for this Express application.

## Production schema result

The reviewed migration was applied to the explicit Neon production branch `br-calm-scene-ayxt8k1f`. Read-only verification confirms all sixteen SKYBET application tables now exist in the `public` schema. The Neon production branch had no SKYBET tables before this operation, so this was a schema initialization rather than a destructive replacement or customer-data import.

The remaining runtime step is to update Railway’s `DATABASE_URL` to the Neon connection string, redeploy the current GitHub `main` build, and verify the Railway health and first-party authentication endpoints. Until that owner-console variable is changed, Railway continues using its existing database connection.
