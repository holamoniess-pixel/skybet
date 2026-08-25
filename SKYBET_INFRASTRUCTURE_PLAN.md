# Skybet Infrastructure, Authorization, and Production Setup Plan

**Status:** Planning only. This document defines what will be configured after approval; it does not create a GitHub repository, Netlify site, Neon project, credentials, or production deployment.

## 1. Recommended deployment shape

Skybet will use a **TypeScript React client, serverless TypeScript API, and Neon PostgreSQL database**. The current starter application contains a long-running Express server pattern and a MySQL-oriented Drizzle layer. Before Netlify deployment, the approved implementation must refactor that server into an importable request handler and expose it through Netlify Functions. It must also migrate the database driver and schema definitions from MySQL to PostgreSQL.

This is an intentional adaptation, not a cosmetic configuration change. Netlify supports build, publish, redirect, function, and deploy-context configuration through a repository-root `netlify.toml`; its documentation also notes that file settings take precedence over equivalent dashboard settings.[1] Netlify serverless functions are appropriate for the expected request/response API pattern, but Skybet must avoid a persistent Express listener, in-memory background queues, and in-process timers.

| Layer | Planned service | Responsibility | Production constraint |
| --- | --- | --- | --- |
| Source control and CI | GitHub | Private repository, protected branches, pull requests, checks, releases, and environment approvals. | No secrets in commits, issues, pull requests, logs, or client bundles. |
| Frontend | Netlify deploy | Blue-and-white Skybet web interface and static assets. | Only public configuration may use `VITE_*` names. |
| API | Netlify Functions | Authentication, role checks, referral engine, admin operations, policy enforcement, provider adapters, and webhook validation. | Must be stateless, idempotent, time-bounded, and safe to retry. |
| Database | Neon PostgreSQL | Authoritative relational data, migrations, audit metadata, referral rules, and later ledger/provider records. | TLS-only connections, least-privilege roles, controlled migrations, and environment isolation. |
| Scheduled or event work | Managed scheduled HTTP jobs or verified webhooks | Catalogue refresh, provider reconciliation, and permitted operational processing. | No `setInterval`, `node-cron`, or process-local scheduling. |
| Observability | To be selected during implementation | Error tracking, structured logs, deployment health, audit review, and alert routing. | Never capture secrets, full payment data, or unredacted identity documents in logs. |

> **Hosting note.** Skybet can also use the built-in managed hosting that accompanies its current scaffold and supports custom domains. Netlify remains a valid choice when you prefer GitHub-connected preview deployments, but it requires the API adaptation described here. The eventual choice should be confirmed before implementation so the server architecture is not built twice.

## 2. GitHub repository plan

The repository will be private by default and named **`skybet`** unless a different owner or organisation naming convention is supplied. The first commit will contain the TypeScript application source, build and test configuration, setup documentation, migration files, a secret-free `.env.example`, Netlify configuration, and CI workflow definitions. It will not contain any production database URL, API key, provider credential, identity document, payment data, or generated user data.

| Repository control | Planned standard |
| --- | --- |
| Default branch | `main`, protected from direct pushes. |
| Working branches | `feature/<topic>`, `fix/<topic>`, and `chore/<topic>`. |
| Pull-request rule | At least one review for sensitive areas; automated typecheck, unit tests, linting, and migration validation must pass. |
| CODEOWNERS | Required for authentication, database migrations, provider adapters, payment/KYC, referral policy, infrastructure, and security paths. |
| Release handling | Semantically tagged releases and a change log entry for every production-facing change. |
| Environments | `development`, `staging`, and `production`, with production protected by branch rules and an approval gate. |
| Security checks | Dependency audit, secret scanning, lockfile integrity, and no deployment if required checks fail. |

GitHub supports repository- and environment-level secrets. Environment protection rules can require reviewers, restrict deployment branches, and withhold environment secrets until the relevant rules pass.[2] [3] Skybet will use that separation rather than sharing a single production secret set across all development branches.

### First-commit workflow

| Step | Intended operation | Evidence of completion |
| --- | --- | --- |
| 1 | Create the private `skybet` repository under the approved owner. | Repository URL and named owner are recorded. |
| 2 | Add the application scaffold, documentation, `.gitignore`, `.env.example`, package lockfile, and CI configuration. | Repository has no detected secrets and installs reproducibly. |
| 3 | Run `typecheck`, unit tests, and production build locally and in CI. | Status checks are green. |
| 4 | Configure branch protection and named environments. | Direct push to `main` is blocked; production has an approval rule. |
| 5 | Connect the authorised repository to the Skybet Netlify site. | Preview deployment is created from a pull request. |
| 6 | Add environment secrets in the correct service dashboards. | Secrets are listed by name only and are not present in Git history. |
| 7 | Apply migrations to the controlled Neon branch and run health checks. | Schema version and application health checks agree. |

## 3. Required authorizations

External projects will only be created after the named account holder grants the needed authority. No credentials should be pasted into chat or committed to the Skybet repository.

| Service | Who must authorise | Required permission | What Skybet will configure after approval |
| --- | --- | --- | --- |
| GitHub | Personal owner or organisation owner | Create private repository, install/authorise Netlify integration, manage branch rules and Actions environments. | Private `skybet` repo, environments, protected `main`, CI, and repository metadata. |
| Netlify | Team owner or member with site-creation and repository-linking rights | Create a site, link the GitHub repository, set site variables, manage functions/build settings, and configure domains. | Skybet project, preview deployments, production branch, environment variables, redirects/headers, and deployment controls. |
| Neon | Project owner or member with project/database/role management rights | Create project, database branches, database roles, connection strings, and backups/retention settings. | `skybet` Neon project, separate environment branches, runtime and migration roles, and least-privilege connection strings. |
| Domain registrar | Domain owner | Create or modify DNS records. | Custom domain verification, TLS, and routing only after a deployment is ready. |
| KYC, AML, payment, games, or sports-data supplier | Contracted-account owner | Sandbox/production API access and webhook configuration. | Adapter-specific secrets and verified inbound webhook endpoints, but no provider is selected at this planning stage. |

## 4. Neon PostgreSQL database plan

Neon supports both pooled and direct PostgreSQL connections. Its documentation states that the connection string is created in the Neon Console and includes database role, password, host, and database name; the pooled endpoint is the default option for higher concurrent connections, while direct endpoints remain available where needed.[4] Skybet will use a pooled, TLS-required runtime URL and a separate direct migration URL. The connection string must only be stored in an environment manager, never in `.env.example` with a real value.

| Environment | Neon branch | Runtime role | Migration role | Use |
| --- | --- | --- | --- | --- |
| Development | `development` | `skybet_app_dev` | `skybet_migrator_dev` | Local and shared developer testing. |
| Staging | `staging` | `skybet_app_staging` | `skybet_migrator_staging` | Integration testing and a controlled Netlify preview target. |
| Production | `main` or designated production branch | `skybet_app_prod` | `skybet_migrator_prod` | Production traffic only, with migration access isolated from runtime access. |
| Preview | Short-lived branch per pull request where appropriate | `skybet_app_preview` | Not granted by default | Safe test data and feature validation. |

| Database control | Skybet implementation standard |
| --- | --- |
| ORM and migrations | Drizzle PostgreSQL schema and `drizzle-kit` migrations. Schema changes must be committed, reviewed, applied once, and recorded. |
| Roles | Runtime role receives only necessary DML privileges; migration role receives DDL only through controlled release workflow; analyst role is read-only and restricted. |
| Connections | `DATABASE_URL` uses Neon’s pooled TLS endpoint. `DATABASE_MIGRATION_URL` uses the direct, TLS endpoint with the migration role. |
| Monetary-like data | Referral, wallet, settlement, adjustment, and reconciliation data use append-only event/ledger structures. No `UPDATE balance = ...` pattern is permitted. |
| Backup and recovery | Confirm Neon retention, point-in-time recovery options, export procedure, and restoration drill before a real-money release. |
| Data separation | Production data never appears in development/preview environments; use synthetic fixtures and redacted test records. |

## 5. Netlify deployment configuration plan

The approved codebase will include a version-controlled `netlify.toml` containing only non-secret build/deploy mechanics. Netlify recommends configuring sensitive values in its user interface rather than source-controlled configuration because the interface provides variable scoping and audit capabilities.[1]

| Netlify configuration item | Planned Skybet setting |
| --- | --- |
| Build command | A package script dedicated to the Netlify target, such as `pnpm build:netlify`, after the current Express runtime is split into static client build plus functions bundle. |
| Publish directory | The static Vite client output, verified after the implementation build refactor. |
| Functions directory | `netlify/functions` or an explicitly configured equivalent, containing the importable Skybet API handler and scheduled/webhook endpoints. |
| SPA routing | A controlled fallback redirect for client-side routes, while preserving `/api/*` and function paths. |
| Headers | Strict transport security, content-security policy, clickjacking protection, referrer policy, and permissions policy, tested against required provider embeds. |
| Deploy contexts | Production from protected `main`; deploy previews for pull requests; staging only from an approved staging branch. |
| Rollback | Use Netlify deploy history for application rollback, paired with forward-only database migration remediation plans. |
| Scheduled work | Use managed scheduled function/job infrastructure or verified provider webhooks; never a persistent process or application timer. |

## 6. Secret-management matrix

All secret values are placeholders until the relevant account is authorised. Server-only secrets must never begin with `VITE_`; values with that prefix may be incorporated into the browser build and therefore must be safe for public disclosure.

| Variable | Scope | Stored in | Purpose | Rotation trigger |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Server runtime | Netlify environment variable per environment | Neon pooled PostgreSQL connection for application queries. | Database credential change, exposure suspicion, or scheduled rotation. |
| `DATABASE_MIGRATION_URL` | CI/release only | GitHub protected environment secret or secure release system | Direct Neon migration connection with restricted use. | Every migration-role credential rotation. |
| `SESSION_SECRET` | Server runtime | Netlify environment variable | Cookie/session signing secret. | Suspected exposure or scheduled rotation with session invalidation plan. |
| `KYC_PROVIDER_API_KEY` | Server runtime | Netlify environment variable | Future identity-verification adapter. | Provider key rotation or service change. |
| `KYC_WEBHOOK_SECRET` | Server runtime | Netlify environment variable | Validates inbound KYC webhook signatures. | Any endpoint/service reconfiguration. |
| `PAYMENT_PROVIDER_SECRET_KEY` | Server runtime | Netlify environment variable | Future payment adapter. | Provider rotation or compromise response. |
| `PAYMENT_WEBHOOK_SECRET` | Server runtime | Netlify environment variable | Validates payment callbacks. | Callback endpoint change or exposure. |
| `GAMES_PROVIDER_API_KEY` | Server runtime | Netlify environment variable | Future licensed games-provider sandbox/production adapter. | Provider rotation, contract change, or exposure. |
| `GAMES_PROVIDER_WEBHOOK_SECRET` | Server runtime | Netlify environment variable | Validates provider events. | Provider webhook configuration change. |
| `ODDS_API_KEY` | Server runtime | Netlify environment variable | Optional development-safe sports-data adapter. | Supplier change, quota abuse, or scheduled rotation. |
| `SENTRY_DSN` | Server and optionally public client | Netlify environment variable | Error monitoring, subject to data-redaction review. | Monitoring project change or exposure. |
| `VITE_APP_ENV` | Public build configuration | Netlify environment variable | Displays the non-sensitive active environment. | Deployment context change only. |

Secrets may be set at repository, environment, and organisation scope in GitHub Actions, but Skybet will prefer **environment-scoped** secrets for deployment-related actions.[2] The implementation will additionally ensure workflow output never prints values; GitHub warns that sensitive values passed outside its managed secret mechanisms should be masked and should not be passed through command lines when avoidable.[2]

## 7. Production-readiness checklist

The following is a release gate, not a wish list. A missing critical item blocks a real-money launch.

| Category | Required evidence before production money movement or wagers |
| --- | --- |
| Jurisdiction | Written launch-market decision, appropriate gaming licence/authorisation status, legal review, terms, privacy notices, tax assessment, and approved age/location policy. |
| Providers | Signed contracts and approved production credentials for KYC, AML, payments, games, sports data, and any required geolocation or messaging provider. |
| Security | Independent penetration test, dependency review, secret scan, MFA for internal access, CSP review, hardened headers, incident response runbook, access-review record, and backup restoration test. |
| Financial integrity | Double-entry ledger review, reconciliation process, provider callback signature validation, idempotency tests, settlement/void dispute workflow, and finance-owner sign-off. |
| Safer play | Limits, time-outs, self-exclusion, product blocking, support contacts, customer-interaction workflow, marketing/referral suppression logic, human-review path, and effectiveness measures. |
| Operations | Named incident commander, 24/7 escalation model where required, support procedures, audit export, change management, release rollback plan, monitoring dashboards, and on-call alerts. |
| Data protection | Data map, retention and deletion schedule, processor agreements, privacy review, access logging, redacted support tooling, and verified data-subject rights workflow. |
| Release control | Protected main branch, approved production deployment, migration plan, deployment record, health checks, smoke tests, and post-deploy monitoring window. |

## 8. Implementation order after approval

| Order | Work package | Outcome |
| --- | --- | --- |
| 1 | Repository hygiene and documentation | GitHub-ready codebase, secret-safe documentation, CI scripts, and branch/environment guidance. |
| 2 | Database conversion and Neon adapter | PostgreSQL Drizzle schema, migration workflow, local placeholders, and environment validation. |
| 3 | Netlify adaptation | Stateless serverless API handler, Netlify config, preview deployment test, and production-safe headers. |
| 4 | Identity, roles, audits, and admin shell | Role-based access and append-only operations history. |
| 5 | Referral rules engine | Programme-level settings and audited per-user amount overrides. |
| 6 | Blue-and-white customer experience | Elegant public pages, account centre, referral centre, and safer-play area. |
| 7 | Demonstrator catalogue adapter | Development-safe game/sports catalogue with no money movement. |
| 8 | Licensed integration programme | Only after separate approval and full compliance/provider readiness. |

## References

[1]: https://docs.netlify.com/build/configure-builds/file-based-configuration/ "Netlify — File-based configuration"
[2]: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions "GitHub Docs — Using secrets in GitHub Actions"
[3]: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment "GitHub Docs — Managing environments for deployment"
[4]: https://neon.com/docs/connect/connect-from-any-app "Neon Docs — Connect from any application"
