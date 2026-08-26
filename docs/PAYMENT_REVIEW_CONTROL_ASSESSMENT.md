# Payment Review Control Assessment

## Scope and provider status

SKYBET will support two **deposit-request methods**: a manual TRC20 crypto transfer and a local GHS payment-gateway transfer. The customer must select a fixed GHS amount of **200, 300, 500, 1,000, 1,500, or 2,000**, receive a unique request reference, and submit a deposit proof for administrator review. A withdrawal request must be created separately and does **not** require a screenshot.

The requested provider is spelled **Aqùapay**. Searches for this exact and close spelling did not find a verified official website, API reference, merchant onboarding page, or webhook specification. Consequently, SKYBET must not connect to, send funds through, or treat a client-side success signal from Aqùapay as payment confirmation until the owner provides the provider’s official documentation URL and merchant credentials securely. No Aqùapay connector currently exists in the project configuration.

## Required controls

| Control | SKYBET implementation boundary | Rationale |
| --- | --- | --- |
| Server-owned request record | The backend creates the request identifier, method, selected amount, status, and expiry. Customer-supplied identifiers or amount changes cannot approve a request. | Sensitive transaction data and authorization decisions must be enforced server-side. [1] |
| Exact state machine | Deposit requests transition only from `draft` to `submitted`, then to `approved` or `rejected`; withdrawal requests transition only from `submitted` to `approved`, `paid`, or `rejected`. | Server-side state transitions prevent skipped or reordered review steps. [1] |
| Proof storage and access | Deposit screenshots are uploaded through the authenticated server path into managed storage, linked to the request, and visible only to the requester and authorised reviewers. | File uploads and sensitive payment evidence require restricted handling and should never be stored in browser-accessible source folders. |
| Immutable financial audit | Every submission, reviewer decision, hold, rejection reason, and ledger effect receives an append-only audit event with actor, time, object, and outcome. Secrets, session values, and private payment credentials are excluded from logs. | OWASP advises integrity-protected audit trails for high-value transactions and cautions against logging secrets and payment data. [2] [3] |
| Duplicate and hold checks | A payment reference may be used once per method; an account hold prevents submissions and approvals until explicitly cleared with a reason. | The review queue needs controls against duplicate claims and suspicious activity. |
| Separation of duties | The account holder cannot approve their own request. A future launch policy should require a second reviewer for withdrawals above an owner-defined threshold. | Segregating transaction preparation and approval reduces fraud and operational error risk. |
| Ledger classification | An approved, externally verified deposit increases `depositedBalance` only. Referral commission and promotional rules remain in `bonusBalance`; no customer-side code changes either value. | This retains the existing SKYBET ledger contract and prevents user-interface tampering. |

## Admin controls to add

The new administrator workspace will add review queues with status and method filters, payment-proof viewing, reference search, reviewer attribution, mandatory rejection reasons, account payment holds, and auditable approval history. It will also replace fixed referral reward settings with a **versioned global commission percentage** and a **per-user percentage override**. The per-user override is optional; when absent, the global percentage applies.

## Aqùapay integration gate

Before implementing a live GHS gateway call or webhook handler, the owner must provide the official Aqùapay developer documentation URL and merchant onboarding details. The integration design will then verify the provider’s authentication method, server-side initiation endpoint, webhook signature scheme, payment-status lookup endpoint, supported Ghana payment methods, idempotency guidance, and permitted callback URL. Merchant keys will be added only as server-side project secrets.

## References

[1]: https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html "OWASP Transaction Authorization Cheat Sheet"
[2]: https://owasp.org/Top10/2021/A09_2021-Security_Logging_and_Monitoring_Failures/ "OWASP Top 10 A09: Security Logging and Monitoring Failures"
[3]: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html "OWASP Logging Cheat Sheet"
