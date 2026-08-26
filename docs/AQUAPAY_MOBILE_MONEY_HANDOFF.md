# Aqùapay Mobile Money Handoff

## Current boundary

SKYBET has a **server-only Aqùapay configuration boundary**. The customer interface does not receive the API URL, API key, webhook secret, merchant identifier, or any signed callback material. Mobile Money deposits remain marked as pending until the provider contract is verified. This is intentional: a payment page must never manufacture a payment-success state from browser input or a screenshot alone.

## Future project secrets

| Secret | Purpose | Customer exposure |
| --- | --- | --- |
| `AQUAPAY_API_URL` | Official Aqùapay API base URL supplied by the provider. | Never exposed. |
| `AQUAPAY_API_KEY` | Aqùapay merchant/server credential. | Never exposed. |
| `AQUAPAY_WEBHOOK_SECRET` | Secret or public-key material used to verify signed provider callbacks. | Never exposed. |

These values must be added through the project’s secure secret-management flow only. They must not be placed in frontend environment variables, source code, screenshots, repository commits, or customer-visible records.

## Server implementation contract

When the official Aqùapay documentation is available, the backend adapter must define the exact request and callback schema before it sends any request. The implementation must establish the provider’s supported Mobile Money networks, customer-number format, initiation endpoint, authorization header, idempotency field, callback URL, callback signature algorithm, event identifiers, status-query endpoint, and reconciliation rules. The adapter must reject unsigned, replayed, or mismatched callbacks and record a non-secret audit result.

Until that contract is verified, the existing payment-review record is **not** a gateway charge or an account credit. It is merely a customer request with evidence that an administrator can review. An approval does not adjust `depositedBalance`, `bonusBalance`, or a withdrawal outcome.

## Mobile Money withdrawal scope

Customer withdrawals now use a **Mobile Money number only**. The request is reviewed by an administrator and is not a payment instruction. A future Aqùapay payout implementation must validate the official Mobile Money-number and network requirements, then prove a provider-verified payout result before it may mark a withdrawal as paid.
