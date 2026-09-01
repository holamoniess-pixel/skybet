# SKYBET Overnight Engineering Audit

**Author:** Manus AI  
**Date:** 1 September 2026  
**Repository:** `holamoniess-pixel/skybet`

## Executive summary

A structured audit covered customer pages, admin pages, payment flows, AquaPay integration, database helpers, migrations, match generation, wager placement, authentication, storage, and tests. The production build succeeds. Focused wallet, admin, payment, and match tests pass. The complete suite is not green because seven tests require secrets or external storage that are not available in the sandbox.

The checked-in wallet implementation contains the requested Mobile Money controls: network selector, Ghana phone field, amount selection, and a dedicated **Continue to Mobile Money** action wired to `payments.startAquaPayDeposit`. The live domain had been serving an older Netlify bundle, and Netlify deployment was blocked by account-credit usage. The replacement Netlify account must be reconnected before the updated frontend can appear on `skybet.space`.

## Fixes completed

| Area | Result |
|---|---|
| Admin balance editing | Corrected the doubled-escape decimal validator so `200` and `200.00` are accepted by the router contract. |
| Admin management | Administrator creation and access changes now require the configured primary owner; permissions report the real owner status. |
| Bet placement | The Place bet button is disabled while a request is pending and repeated activation is ignored. |
| Wallet routing | `/wallet#withdraw` now opens the withdrawal mode. |
| Hero carousel | Ten local hero assets replace failing remote URLs, including first-render fallback handling. |
| Match odds | Simulated ordinary match odds are bounded to 1.02–4.00. |

## Release blockers found

| Priority | Finding | Recommended implementation |
|---|---|---|
| P0 | AquaPay request and webhook shapes are not verified against an official provider contract. | Obtain the official contract and implement strict request, response, signature, currency, merchant, status, and replay validation. Keep live payment fail-closed until verified. |
| P0 | Concurrent webhook deliveries and manual approvals can double-credit or lose balance updates. | Use an append-only ledger, unique provider-event and settlement keys, row locks or serializable transactions, and guarded state transitions. |
| P0 | Webhook settlement accepts a customer-controlled reference as an alternate lookup key. | Match only the server-generated merchant reference bound to the payment request and provider event. |
| P0 | Withdrawal approval debits funds although no payout is executed. | Add reserve/hold semantics and `approved` → `processing` → `paid`/`failed`/`reversed` lifecycle states. |
| P0 | Admin-created matches are persisted but displayed feeds still use simulated data. | Connect one authoritative persisted feed to create, list, score, status, market, result, and settlement operations. |
| P1 | Manual admin approval can approve an AquaPay request without provider verification. | Require provider verification for automated deposits, or explicitly classify the request as manual and require evidence. |
| P1 | Failed AquaPay initiation can leave an orphan submitted request. | Store initiation attempts and reconcile or safely cancel uncertain requests. |
| P1 | Webhook deposits do not consistently apply referral rewards or audit/event records. | Centralize settlement so balance, referral, payment event, and audit effects are applied exactly once. |
| P1 | Crypto proof is optional and upload errors are swallowed. | Require valid proof for manual crypto deposits and fail clearly when storage cannot persist it. |
| P1 | Authenticated state-changing requests lack explicit CSRF/origin protections. | Use the narrowest practical cookie policy plus trusted-origin and CSRF checks. |

## Customer and admin gaps

Customer pages should show explicit loading, error, retry, and empty states for wallet methods, gateway readiness, balances, profiles, notifications, and match feeds. Event detail should distinguish loading/backend failure from a genuinely missing event. Sports filters and static account cards should become working actions or be clearly labelled informational.

The admin UI needs end-to-end coverage for balance editing, match creation, persisted-feed visibility, payment approval effects, and owner-only access. Balance adjustments should validate that the target is an existing customer and should retain the same idempotency key across retries.

The betting engine should use explicit states such as scheduled, open, suspended, live, closed, awaiting-result, settled, and void. Acceptance should atomically validate event state, market state, price version, stake, limits, and balance, then save immutable accepted terms and debit funds. Settlement and payout must be independently idempotent.

## Research-backed priorities

Decimal odds should be derived from documented fair probabilities and a documented overround policy. Book percentage is monitored as the sum of inverse decimal odds multiplied by 100 [1]. Each odds update should be logged and the accepted price shown to the customer.

Bet placement should use a high-entropy idempotency key and canonical request hash. A retry with identical parameters should return the original result; reuse with different parameters should be rejected [2].

Live and prematch betting need separate state and freshness protections. Stale feeds, material events, and system incidents should suspend markets with a timestamped reason and controlled reopening [3] [4].

Administrator actions should be least-privilege and append-only audited with actor, timestamp, before/after values, reason, and correlation information. GLI-33 provides a useful baseline for event-wagering auditability, suspension, recovery, and transaction integrity [5].

## Validation status

Passed:

```text
pnpm check
pnpm vitest run client/src/components/skybet/WalletPaymentRequestCard.test.tsx client/src/components/skybet/SelectionSheet.test.tsx client/src/pages/Admin.test.tsx server/paymentReview.test.ts server/matchFeed.test.ts
pnpm build
```

The focused suite passed **12 tests**. The complete suite passed **86 of 93 tests**; the seven failures require missing JWT, Railway, admin, or S3-compatible storage variables. These should become opt-in integration tests or run in CI with provisioned secrets.

## Tomorrow’s implementation order

1. Reconnect the replacement Netlify account and publish the latest frontend.
2. Verify the official AquaPay API and webhook contract before enabling live payments.
3. Implement atomic payment ledger settlement and provider-event idempotency.
4. Connect persisted admin matches to the customer/admin feed and add score/status/result workflows.
5. Add state, price-version, duplicate-submit, balance, withdrawal, and settlement integration tests.
6. Add responsible-play limits, customer transaction history, and administrator audit/export controls.
7. Run the authorized GH₵200 MTN prompt test for `0539042844` and cancel it without approving the charge.

## References

[1]: https://help.smarkets.com/hc/en-gb/articles/214180145-How-to-calculate-betting-margins "Smarkets: How to calculate betting margins"
[2]: https://docs.stripe.com/api/idempotent_requests "Stripe API: Idempotent requests"
[3]: https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-10-interrupted-gambling "UK Gambling Commission RTS 10: Interrupted gambling"
[4]: https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-15-in-play-betting "UK Gambling Commission RTS 15: In-play betting"
[5]: https://gaminglabs.com/wp-content/uploads/2024/06/GLI-33-Event-Wagering-Systems-v1.1-1.pdf "GLI-33 Event Wagering Systems v1.1"

**Document note:** This is an engineering audit, not legal, regulatory, payment-provider, or gambling-licensing advice.
