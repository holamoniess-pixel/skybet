# Customer Authentication Route Verification

## Finding

On the connected Netlify site, `GET /api/auth/me` currently returns the SKYBET `index.html` document with an HTML content type instead of a JSON response. This reproduces the sign-up error shown in the customer screenshot: the frontend attempted to parse the Netlify SPA shell as JSON.

## Fix pushed to GitHub

Commit `4c11607` on `main` adds an ordered Netlify redirect for `/api/*` to `https://skybet-production.up.railway.app/api/:splat`, before the SPA fallback. It also makes the customer-auth dialog detect HTML or malformed responses and show a safe temporary-service message. A Vitest regression test covers the HTML-shell response.

## Validation

The local suite passes with 70 tests across 25 files. TypeScript validation and the production build pass. The live Netlify endpoint must be checked again after the GitHub-triggered Netlify deploy completes; until then, the old deployment will continue to return HTML for `/api/auth/me`.

## Safety boundary

No customer credentials were used or created during verification. No payment, withdrawal, ledger, or external secret was accessed.

## Post-deploy result

After the GitHub-triggered Netlify deployment completed, the same live request returned `200 application/json; charset=utf-8` with the body prefix `{"user":null}`. The API proxy is now active on the production Netlify origin.
