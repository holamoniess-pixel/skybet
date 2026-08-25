# Skybet

Skybet is a full-stack TypeScript foundation for a mobile-first sports match centre and protected administrator workspace. The public experience is an original interface informed by high-level, public sportsbook navigation patterns; it does not include third-party brands, odds feeds, payment handling, or real-money wagering.

## Current product foundation

| Area | Included now | Not yet enabled |
| --- | --- | --- |
| Customer match centre | Responsive live/upcoming event cards, selection sheet, account sheet, dark theme, and mobile navigation. | Licensed event data, game launch, deposits, bets, payouts, and provider integrations. |
| Administration | Protected `/admin` route, role gate, referral-rule preview, safer-play and operational readiness panels. | Persisted rule changes, per-user overrides, audit records, and staff permissions beyond `admin` and `user`. |
| Quality | Vitest coverage for catalogue filtering, referral validation, customer interactions, and role-aware admin UI. | End-to-end workflows against an authenticated production database. |
| Deployment | A Netlify static-preview configuration and a production setup guide. | A serverless adapter for the Express/tRPC runtime or a compatible full-stack host. |

> **Safety boundary:** Skybet’s current website is a UI and architecture foundation. Do not enable real-money, financial, KYC, gambling, or referral payment flows until jurisdiction, licensing, provider, security, and legal requirements have been independently approved.

## Local development

Use Node.js 22 and pnpm 10.4.1.

```bash
pnpm install
pnpm dev
```

Run the quality checks before opening a pull request:

```bash
pnpm test
pnpm check
pnpm build
```

## Key paths

| Path | Purpose |
| --- | --- |
| `client/src/pages/Home.tsx` | Public Skybet customer match centre. |
| `client/src/pages/Admin.tsx` | Role-aware Skybet administrator workspace foundation. |
| `client/src/components/skybet/` | Reusable Skybet branded interface components. |
| `shared/skybet.ts` | Typed catalogue model and filter helpers. |
| `shared/referrals.ts` | Referral reward validation helper. |
| `server/` | tRPC server, authentication, and unit tests. |
| `drizzle/` | Current Drizzle schema and migrations. |
| `docs/NEON_SETUP.md` | Required PostgreSQL/Neon migration steps. |
| `docs/DEPLOYMENT.md` | Netlify preview, secret, and production setup requirements. |

## Deployment notes

The included `netlify.toml` deploys the built React UI from `dist/public` as an SPA preview. It does **not** host the current Express/tRPC API. Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) before connecting a repository or creating a public deployment.

## Contribution workflow

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before creating the first GitHub repository or making changes. Each pull request must include tests and an explicit statement of any changes that affect account eligibility, referrals, safety controls, or external providers.
