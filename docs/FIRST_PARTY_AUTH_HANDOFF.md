# SKYBET first-party authentication handoff

## Scope

SKYBET now uses a server-owned customer authentication flow rather than Better Auth or Manus OAuth for customer sign-up and sign-in. Customers provide an email address, a Ghana Mobile Money phone number, a password, and a matching password confirmation when creating an account. Existing customers sign in with email and password.

## Security boundary

Passwords are hashed with Node’s `scrypt` implementation and are never stored or returned in plaintext. Customer sessions use cryptographically random bearer tokens, store only a SHA-256 token hash in `customer_sessions`, expire after twelve hours, and are delivered in the `skybet-session` HTTP-only cookie. The API returns generic login failure feedback so it does not disclose whether an email exists. Email and phone values are normalized server-side, and database uniqueness constraints prevent duplicate credentials.

The first-party customer session is checked before the retiring Manus session in the tRPC context. The administrator’s existing local password flow remains separate and continues to use its own session path and role check. The legacy Manus OAuth callback is disabled when its server URL is absent; it is not used by customer sign-up or login.

## Customer endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/signup` | Validate email, Ghana phone, password, and confirmation; create a user and issue a session. |
| `POST /api/auth/login` | Verify email and scrypt password hash; issue a session. |
| `POST /api/auth/logout` | Revoke the stored customer session and clear the customer and legacy session cookies. |
| `GET /api/auth/me` | Return the current public user shape or `null`; no password hash or session token is returned. |

## Deployment notes

The first-party session path is database-backed: it generates a cryptographically random token, stores only its one-way hash and expiry, and does not require the Better Auth Infrastructure key or an additional auth secret. Do not place any credential in the React bundle, GitHub source, browser storage, or a screenshot. On Railway, redeploy the application, then test `GET /health` and the customer auth endpoints from the public Railway domain. Do not test production sign-up with a dummy account; use the owner’s approved test account or a staging database.

## Deferred work

Password reset, email verification, multi-factor authentication, bot protection, rate limiting, and production account-recovery messaging are not enabled by this release. They should be implemented before public launch. Payment approval and balance changes remain separate server-gated workflows and are not triggered by authentication.

## References

The implementation follows the project’s established scrypt password-hashing and HTTP-only cookie conventions. The Better Auth integration was intentionally not added after the owner selected the simpler first-party approach. The retired Better Auth Infrastructure secret is not required by this implementation.
