# SKYBET Railway Backend Setup Guide

## Purpose

This guide configures the current SKYBET Node/Express backend as a Railway service. It does **not** activate payments, customer deposits, withdrawals, wagers, sports-data ingestion, or model calls. The `/health` route is safe to expose and returns only the service name and an `ok` status.

> **Important:** Do not enter any API key, password, database connection string, payment credential, or Clerk secret in GitHub files, screenshots, chat messages, or client-side environment variables. Add secret values only in Railway’s service **Variables** page.

## What the current deployment log means

Railway successfully detected Node 22, installed the locked dependencies, built the Vite client and bundled Express server, and started the service on the platform-assigned port. The missing `OAUTH_SERVER_URL` message refers to the legacy Manus OAuth integration. It must not be filled with an invented value.

The application now treats that legacy route as disabled when no valid URL is configured. This is a temporary compatibility boundary while Clerk replaces the legacy login flow. Protected account, administrator, payment-review, and balance routes should not be treated as production-ready until the Clerk migration and Neon cutover are complete.

## Step 1 — Generate the Railway public domain

Open Railway and use the following sequence.

1. Open **Project: positive-radiance**.
2. Select the **skybet** service.
3. Open **Settings** and then **Networking**.
4. Select **Generate Domain**.
5. Copy the resulting HTTPS URL from the public-domain field.
6. Open `<your-railway-domain>/health` in a browser.

The expected response is:

```json
{"ok":true,"service":"skybet-api"}
```

If the response is not JSON, open the service’s **Deployments** tab, select the latest deployment, and inspect the logs for a failed startup or an incorrect start command.

## Step 2 — Confirm the GitHub deployment source

1. In the same Railway service, open **Settings**.
2. Find the **Source** or **GitHub repository** section.
3. Confirm it reads `holamoniess-pixel/skybet`.
4. Confirm the production branch is `main`.
5. Confirm the build command is `pnpm run build` and the start command is `pnpm run start`.
6. Leave the root directory unset unless the service is intentionally configured for a subdirectory.

Railway supports GitHub deployment for Express services and uses the configured service variables at build and runtime. [1] [2]

## Step 3 — Add only the current required server variables

Open the service **Variables** page. Add the names below only when you have their real values from the correct provider. Railway applies variable edits as staged changes that must be reviewed and deployed. [2]

| Variable name | Required now | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production`. |
| `JWT_SECRET` | Yes | Generate a strong, private server secret. Do not reuse a password. |
| `DATABASE_URL` | Not until Neon cutover | Use the Neon production connection string only after the PostgreSQL migration is ready. |
| `CLERK_SECRET_KEY` | Not until Clerk migration | Server-only Clerk credential. |
| `CLERK_PUBLISHABLE_KEY` | Not until Clerk migration | Used to validate the intended Clerk integration; do not expose the server secret. |
| `AQUAPAY_API_URL`, `AQUAPAY_API_KEY`, `AQUAPAY_WEBHOOK_SECRET` | No | Leave unset until official Aqùapay documentation and merchant credentials are available. |
| `SKYBET_ESPN_CRON_SECRET` | No | Required only before enabling the ESPN preview refresh endpoint. Generate a long random value in a password manager and keep it in Railway only. |
| `OAUTH_SERVER_URL` | No | Do not set a substitute value. It belongs to the retiring Manus OAuth flow. |

## Step 4 — Add the frontend origin after Netlify is confirmed

When the Netlify production URL is available, record it for the forthcoming backend CORS allowlist. Do not add a wildcard origin. The API must allow only the exact HTTPS production frontend origin and an explicitly approved preview origin, if one is used.

## Step 5 — Know how to recover

If a deployment fails after a future configuration or code change, open **Deployments**, select the most recent known-good deployment, use its three-dot menu, and choose **Rollback**. Railway documents that rollback restores the selected deployment’s image and custom variables, subject to plan retention. [3]

## Next required handoffs

After the health URL is working, send only the public URL in the project conversation. The next safe steps are to verify the Netlify API base URL and CORS boundary, then set up Clerk and migrate the application database to Neon in a staging branch.

## References

[1]: [Railway: Deploy an Express app](https://docs.railway.com/guides/express)

[2]: [Railway: Using variables](https://docs.railway.com/variables)

[3]: [Railway: Deployment actions](https://docs.railway.com/deployments/deployment-actions)

## Latest log verification note

A production deployment log reviewed on 2026-08-26 shows the SKYBET container starting successfully and listening on Railway’s assigned port. The legacy Manus OAuth messages are expected because those routes are intentionally disabled in favor of first-party customer authentication. `Missing session cookie` messages are expected for unauthenticated requests to protected endpoints and do not indicate a deployment failure.

## Owner-console verification

The active Railway deployment menu exposed `View logs`, `Restart`, `Deploy`, and `Remove`. An older successful deployment exposed `View logs`, `Redeploy`, and `Rollback`. The rollback option was observed but not selected, preserving the live deployment.

SKYBET’s frontend uses the Netlify same-origin `/api` proxy to Railway, so browser requests do not require a wildcard Railway CORS policy. The production frontend origin is the approved Netlify site, and no payment or authentication secret is exposed to the browser.

## ESPN preview refresh: owner activation guide

The ESPN route is a **scores-and-fixtures preview only**. It is not an odds, wager, payment, or settlement integration. The deployed `POST /api/scheduled/espn-preview-refresh` endpoint remains disabled until `SKYBET_ESPN_CRON_SECRET` is present in Railway.

1. Wait until Railway has deployed the GitHub commit containing the endpoint, then open the **Variables** tab for the `skybet` service.
2. Create `SKYBET_ESPN_CRON_SECRET` and paste a newly generated, long random value from a password manager. Do not send the value in chat, email, screenshots, source files, Netlify variables, or the browser.
3. Redeploy the Railway service after saving the variable. Confirm that an unauthenticated `POST` to the route returns `403` rather than sports data.
4. If a five-minute update is acceptable, a separate short-lived Railway cron service may call the route and exit. Railway’s native cron facility does not support intervals shorter than five minutes and is not appropriate for the long-running SKYBET web service.[4]
5. If a two-minute update is necessary, use a separate managed HTTP scheduler. Configure it to make a `POST` request to `https://skybet-production.up.railway.app/api/scheduled/espn-preview-refresh` with `Authorization: Bearer <the Railway-only secret>`. Store the same secret in that scheduler’s secret store, not in the job URL or request body.
6. Trigger exactly one manual run first. A success response includes only the source, stale flag, timestamp, and event count. If the source cannot refresh, the route returns a generic `502` and the customer application continues to use its last verified cache where available.

No recurring task is enabled by this guide. Do not use `node-cron`, `setInterval`, or any in-process timer in the web service.

[4]: [Railway: Cron Jobs](https://docs.railway.com/cron-jobs)
