# First-Party Customer Authentication Deployment Guide

## What SKYBET uses now

SKYBET uses its own email, Ghana phone-number, and password sign-up system. Customer credentials and hashed sessions are stored in Neon through the Railway backend. It **does not** use Manus OAuth, Clerk, Better Auth, NVIDIA, or OpenRouter for customer sign-up or login.

The reported “sign-up succeeds but I am still logged out” symptom was caused by the backend reading only an optional Express cookie field. Behind the Netlify-to-Railway proxy, the customer session cookie is sent in the normal `Cookie` header. The current release reads that header safely, so the signed-in state can be restored after a page refresh.

| Service | What to configure for customer sign-up/login | What not to add for this feature |
| --- | --- | --- |
| **Railway** | `DATABASE_URL` for the Neon production branch and a private `JWT_SECRET` for the separate administrator session. Set `SKYBET_INITIAL_ADMIN_EMAIL` and `SKYBET_INITIAL_ADMIN_PASSWORD` only for the first administrator bootstrap. | `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`, Clerk keys, Better Auth keys, NVIDIA keys, and OpenRouter keys. |
| **Netlify** | No authentication secret is required. It serves the user interface and forwards `/api/*` requests to Railway through `netlify.toml`. | `DATABASE_URL`, `JWT_SECRET`, admin credentials, or any server-only secret. |
| **Neon** | Keep the production connection string private in Railway only. | Any browser-exposed database credential. |

## One step at a time: deploy the fix

1. Open your GitHub repository, select **main**, and confirm the newest commit contains the first-party cookie-session fix.
2. In Railway, open **Project → skybet service → Deployments**. Wait for the deployment created from that GitHub commit to show **Success**.
3. Do not change Netlify variables for this fix. Netlify’s `/api/*` proxy already forwards authentication calls to Railway.
4. Open the Netlify website in a private/incognito browser window. Create one new test account using a unique email address, a valid Ghana phone number, and a password of at least eight characters.
5. After the dialog closes, open the account menu. It should show the signed-in customer state. Refresh the page once; the signed-in state should remain.

If the account remains logged out after refresh, do not paste passwords, database URLs, session cookies, or screenshots containing them. Instead, send a screenshot of the Railway deployment status and the browser’s visible error text only.

## Routine checks

The following responses can be safely checked without an account:

| URL | Expected response |
| --- | --- |
| `https://skyybet.netlify.app/api/auth/me` | JSON with `{"user":null}` when no customer is logged in. |
| `https://skybet-production.up.railway.app/health` | JSON stating that the API service is healthy. |

An invalid login should return JSON `401`, not an HTML page. This confirms the Netlify proxy reaches Railway rather than the static-site fallback. Netlify redirects are evaluated in order, so the `/api/*` proxy must remain before the SPA fallback.[1]

## References

[1]: https://docs.netlify.com/manage/routing/redirects/redirect-options/ "Netlify Redirect Options"
