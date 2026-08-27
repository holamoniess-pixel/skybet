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

## Administrator sign-in recovery

The administration page uses a separate first-party local administrator session. Railway must retain `SKYBET_INITIAL_ADMIN_EMAIL`, `SKYBET_INITIAL_ADMIN_PASSWORD`, `DATABASE_URL`, and `JWT_SECRET` for the initial administrator sign-in. The administrator session uses its own SKYBET cookie and JWT scope; it does not rely on a Manus app identifier, OAuth redirect, or Manus session verifier. If the database contains an older administrator password hash but the protected Railway bootstrap credentials are correct, the current backend safely refreshes that stored hash on administrator sign-in. This prevents an old bootstrap hash from locking out the configured administrator.

Do not enter the administrator email or password in Netlify, GitHub, Manus OAuth settings, browser address bars, or chat. If sign-in still returns “Invalid administrator email or password” after the new Railway deployment succeeds, the Railway values themselves need to be re-entered privately in **Railway → skybet → Variables**, then deployed again.

## Owner-only administrator management

The initial Railway bootstrap administrator is the **primary owner**. Only that account can open **Administrators** in the admin workspace to create another local administrator, revoke their access, or restore their access. Each additional administrator has a separate email and scrypt-hashed password stored in Neon; no administrator password is written to audit records or exposed to Netlify.

All administrators may use the operational pages appropriate to their role, including customer accounts, deposit review, withdrawal review, bonuses and rewards, site configuration, and the ESPN scores-and-fixtures preview. The owner-only **Administrators** page protects colleague account creation and access changes with server-side authorization and an append-only audit event.

| Workspace page | Purpose | Safety boundary |
| --- | --- | --- |
| Customer accounts | Search a customer and view deposited balance, bonus balance, payment state, and policy exceptions. | Viewing does not alter funds. |
| Deposits and withdrawals | Review separately filtered customer requests and record reasoned decisions. | Decisions do not transfer funds or credit balances. |
| Bonuses & rewards | Configure programme-wide or customer-specific bonus and referral policy. | Rules are audited; bonus configuration is not a balance movement. |
| Site configuration | Route to payment review, reward policy, and editorial controls. | It does not enable an unapproved gateway or wagering service. |
| Match preview | Show the server-cached ESPN score and fixture preview. | No odds, wager creation, payment, or settlement appears in this view. |

## Do not restore Manus OAuth

The values `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, and `OAUTH_SERVER_URL`, plus an OAuth redirect URI, belong to the previous Manus-based authentication flow. That flow is intentionally disabled and is not part of the current SKYBET login. Adding those values cannot repair the first-party sign-up/login issue and risks reintroducing an incompatible authentication path. Leave the legacy OAuth routes disabled.

## Routine checks

The following responses can be safely checked without an account:

| URL | Expected response |
| --- | --- |
| `https://skyybet.netlify.app/api/auth/me` | JSON with `{"user":null}` when no customer is logged in. |
| `https://skybet-production.up.railway.app/health` | JSON stating that the API service is healthy. |

An invalid login should return JSON `401`, not an HTML page. This confirms the Netlify proxy reaches Railway rather than the static-site fallback. Netlify redirects are evaluated in order, so the `/api/*` proxy must remain before the SPA fallback.[1]

## References

[1]: https://docs.netlify.com/manage/routing/redirects/redirect-options/ "Netlify Redirect Options"
