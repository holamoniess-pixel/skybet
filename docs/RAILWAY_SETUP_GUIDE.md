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
