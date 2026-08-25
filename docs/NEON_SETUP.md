# Neon PostgreSQL Setup and Migration Plan

## Important compatibility note

The current Skybet scaffold uses Drizzle’s MySQL driver and the template-provided `DATABASE_URL`. A Neon connection is **PostgreSQL**. Adding a Neon URL alone will not make the existing database layer compatible. The project must complete the adapter and schema migration below before Neon is connected to live application traffic.

## Required Neon account setup

Create a Neon project and a non-production branch first. Generate a pooled PostgreSQL connection string with TLS enabled, then store it as `NEON_DATABASE_URL` only in the secret manager. Neon recommends connection pooling for serverless deployments and uses standard PostgreSQL connection strings.[1]

| Environment | Required variable | Scope | Rule |
| --- | --- | --- |
| Local development | `NEON_DATABASE_URL` | Local `.env`, never committed | Use a dedicated development branch and synthetic data only. |
| Netlify preview | `NEON_DATABASE_URL` | Functions/runtime only | Use a preview branch or read-only limited user. |
| Production | `NEON_DATABASE_URL` | Functions/runtime only | Use a dedicated production role with least privileges and TLS. |
| All environments | `JWT_SECRET` | Runtime only | Generate a unique high-entropy value for each environment. |

## Skybet database migration sequence

| Step | Required action | Completion evidence |
| --- | --- | --- |
| 1 | Replace `mysql2` and `drizzle-orm/mysql2` usage with the approved PostgreSQL/Neon Drizzle adapter. | The connection helper accepts `NEON_DATABASE_URL` and fails closed when absent. |
| 2 | Translate `mysqlTable`, `mysqlEnum`, and MySQL-specific timestamp/ID assumptions in `drizzle/schema.ts` to PostgreSQL equivalents. | Generated SQL is reviewed and applied to a Neon development branch. |
| 3 | Create tables for referral rule versions, referral overrides, eligibility events, safety restrictions, and immutable administrator audit events. | Migration IDs, foreign keys, indexes, and rollback behaviour are reviewed. |
| 4 | Move referral reward updates into a protected administrator procedure. Validate amount, currency, effective date, scope, reason, and actor. | Unit tests cover authorization and invalid values. |
| 5 | Apply migrations through an approved CI/CD process, not by app startup. | A deployment log links each release to a migration version. |
| 6 | Run a staging verification using a non-production Neon branch. | Admin update, audit readback, and failed-connection behaviour are tested. |

## Referral data model direction

The initial data design should distinguish a programme default from a user-specific exception. Do not overwrite prior values; create a new version and retain the original actor, reason, and effective timestamp.

| Table | Minimum fields | Purpose |
| --- | --- | --- |
| `referral_reward_rules` | `id`, `currency`, `amount`, `status`, `effective_at`, `created_by`, `created_at` | Versioned default programme rule. |
| `referral_reward_overrides` | `id`, `user_id`, `rule_id`, `amount`, `reason`, `effective_at`, `created_by` | Explicit customer-specific exception. |
| `referral_events` | `id`, `referrer_user_id`, `referred_user_id`, `status`, `qualified_at` | Eligibility lifecycle, separate from reward value. |
| `admin_audit_events` | `id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `created_at` | Immutable record of sensitive changes. |

## References

[1]: https://neon.com/docs/connect/connect-from-any-app "Neon Documentation - Connect from any application"
