# SKYBET External Platform Assessment

## Current state

SKYBET is currently live on the managed project domain and its repository is published at `holamoniess-pixel/skybet`, with `main` as its default branch. The owner reports that Netlify, Railway, Neon, and a newly created Supabase account are connected to this repository. The GitHub-connected Neon integration reports that it created a project-scoped API key and project identifier as repository secrets; their values were neither read nor written to the repository.

The repository currently contains no GitHub Actions workflow files. Its `netlify.toml` builds only the Vite static preview and explicitly states that the Express/tRPC API is not yet packaged as a Netlify Function. The connected Netlify account contains a **skybet-production** site, but the service record available here does not expose its GitHub binding. The Neon MCP account presently exposes no SKYBET project, while the connected Sentry organization has no project and the available Sanity and Supabase projects appear unrelated. These differences may reflect separate accounts or permission scopes; none will be reused automatically.

## Deployment options

| Approach | What runs where | Benefits | Trade-offs |
| --- | --- | --- | --- |
| **A. Netlify frontend + Railway Express API + Neon (recommended)** | Netlify continuously deploys the Vite frontend from GitHub; Railway deploys the existing Node/Express/tRPC API from GitHub; Neon stores transactional application data. | Matches the owner’s reported services, preserves the current Node backend, and allows a push to `main` to update each explicitly linked service. | Requires an explicit client API base URL, CORS allowlist, separate deployment health checks, and coordinated rollback procedures. |
| **B. Netlify + functions + Neon** | The Vite frontend and request-scoped API functions deploy from GitHub to Netlify; Neon stores transactional data. | A single hosting provider for frontend and API. | Requires adapting the current Express/tRPC server to Netlify’s short-lived function model. |
| **C. Netlify frontend + Supabase Edge Functions + Neon** | Netlify hosts the frontend; a rewritten Deno function layer runs on Supabase; Neon remains the system-of-record database. | Uses Supabase compute for limited HTTP endpoints and webhooks. | Requires a second backend migration from Express/Node to Deno-compatible handlers and duplicates operational complexity. It does not directly host the current Express server. |

> **Recommendation:** Use **Approach A**. Railway supports GitHub deployment of Express applications and service-scoped variables, while Netlify supports Git-based continuous frontend deployment. This preserves the existing Node/Express/tRPC backend and avoids an unnecessary Deno rewrite. [1] [2] [3] [9] [10]

## Authentication and administrator boundary

The Clerk migration should use the React SDK in the Vite client and the Express SDK server-side. Clerk’s Express middleware must run before other middleware and protected server procedures must use its request authentication state. The existing password-hash bootstrap record must be retired only after a Clerk administrator has been provisioned and the protected routes have been verified. The previous local password must **not** be copied into code, database fields, or a Clerk migration script. [4] [5] [6]

The owner will need a Clerk application, a publishable key, a server secret key, the production domain allowlist, and a Clerk user for the administrator. Administrator privilege should be assigned in Clerk-managed metadata or role/permission configuration only after the owner confirms the intended Clerk account.

## Data, monitoring, and CMS boundaries

Neon will be the system-of-record PostgreSQL database. The current Drizzle schema uses MySQL-specific definitions and migrations, so migration requires an explicit PostgreSQL schema conversion, a staging branch, reconciliation, and a confirmed cutover. A new Neon project must not be created until the owner confirms the organization and any applicable account costs.

Sentry is appropriate for error and performance monitoring, not product analytics or financial records. Its SDK configuration must scrub payment proof URLs, authorization headers, cookies, wallet destinations, and personal identifiers before sending event data. A new Sentry project must be created or selected before a DSN can be configured.

Sanity is appropriate for editorial content such as banners, responsible-gaming copy, help pages, campaigns, and approved homepage media metadata. It must not store balances, payment proofs, payment requests, withdrawal destinations, customer data, sessions, roles, betting outcomes, or audit records.

Supabase Edge Functions are Deno-compatible TypeScript functions. They can support isolated webhooks or auxiliary services, but they are not a drop-in host for the current Node/Express/tRPC process. Their documented role is therefore optional and supplemental, not the primary runtime in the recommended architecture. [7] [8]

## Remaining verification inputs

| Input | Why it is needed | Secure handling |
| --- | --- | --- |
| Railway service URL and service access | Allows health, CORS, deployment-source, and rollback verification without reading secrets. | Provide the public API URL, or connect the service through an approved integration. |
| Netlify Git binding confirmation | Confirms that the existing `skybet-production` site builds from `holamoniess-pixel/skybet` on `main`. | Verify in Netlify project settings or provide the project URL. |
| Clerk application and production domain | Enables authenticated client and server integration. | Add keys through the secure project-secret form only. |
| Neon project access confirmation | Aligns the Neon MCP account with the GitHub-linked project and permits safe staging-branch inspection. | Confirm the Neon project name or give the connected account access; do not paste connection strings. |
| Sentry project choice | Enables a DSN and release monitoring configuration. | Use a dedicated SKYBET project; store DSN server-side where applicable. |
| Sanity project choice | Prevents accidental use of an unrelated content dataset. | Confirm a new dedicated project or a named existing project. |
| Optional Supabase scope | Determines whether to omit Supabase or limit it to a specific auxiliary function/storage role. | Do not reuse the existing unrelated Supabase project without approval. |

## References

[1]: [Netlify: Create deploys](https://docs.netlify.com/deploy/create-deploys/)

[2]: [Netlify: Functions overview](https://docs.netlify.com/build/functions/overview/)

[3]: [Netlify: Build configuration overview](https://docs.netlify.com/build/configure-builds/overview/)

[4]: [Clerk: React quickstart](https://clerk.com/docs/react/getting-started/quickstart)

[5]: [Clerk: Express SDK overview](https://clerk.com/docs/reference/express/overview)

[6]: [Clerk: clerkMiddleware() reference](https://clerk.com/docs/reference/express/clerk-middleware)

[7]: [Supabase: Edge Functions](https://supabase.com/docs/guides/functions)

[8]: [Supabase: Edge Functions quickstart](https://supabase.com/docs/guides/functions/quickstart)

[9]: [Railway: Deploy an Express app](https://docs.railway.com/guides/express)

[10]: [Railway: Using variables](https://docs.railway.com/variables)

[11]: [Railway: Deployment actions](https://docs.railway.com/deployments/deployment-actions)


## Current owner-connected deployment verification — 27 August 2026

The owner’s private GitHub repository is `holamoniess-pixel/skybet` with `main` as the default branch. A secret-free GitHub Actions workflow now validates the repository with `pnpm check` and `pnpm build` on pushes and pull requests to `main`. The owner-connected Netlify account contains a ready site named `skyybet` with production and main-branch URLs, but the available project record does not confirm that it is linked to the SKYBET GitHub repository. The repository’s `netlify.toml` publishes `dist/public` as a static Vite frontend with an SPA fallback; the current Express/tRPC backend remains a separate Railway service.

The owner-provided Railway domain `https://skybet-production.up.railway.app` returned the expected public health payload `{"ok":true,"service":"skybet-api"}`. Its `/api/auth/me` route currently returned the frontend HTML shell, which indicates that the Railway service has not yet deployed the latest first-party-auth backend build or that the domain is mapped to the frontend service; it must not be treated as an authenticated API endpoint until the deployment source and route mapping are corrected.

A Neon project named `skybet` exists in the owner’s organization with a single ready `production` branch. Read-only table inspection found only Neon’s own `neon_auth` tables and no SKYBET application tables, so the current MySQL/TiDB application database has not been migrated. No migration or production database cutover was performed. The safe next step is a staged PostgreSQL schema port and disposable branch verification before any production-branch application.
