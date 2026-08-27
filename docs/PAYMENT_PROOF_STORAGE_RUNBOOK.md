# Payment-Proof Object Storage and Retention Runbook

## Scope

Payment screenshots are sensitive operational records. SKYBET will store their bytes in a dedicated **private** Neon Object Storage bucket and retain only the object key, MIME type, and payment-request metadata in Neon PostgreSQL. A screenshot must be retrievable only through a short-lived server-generated link after the existing customer-ownership or administrator authorization checks pass.

| Control | Decision |
| --- | --- |
| Bucket | A dedicated private `SKYBET_PAYMENT_PROOF_BUCKET`, separate from public assets and application code. |
| Addressing | AWS SDK with `forcePathStyle: true`, required by Neon’s S3-compatible endpoint. |
| Upload | Customer uploads to the Railway backend; the browser never receives storage credentials. |
| Viewing | Server-generated short-lived presigned GET URL after customer-ownership or administrator authorization. |
| Retention | The protected Railway endpoint `POST /api/scheduled/payment-proof-retention` deletes objects only once their recorded 24-hour expiry time has passed. |
| Deletion evidence | A system retention record stores key-free counts and timestamps; it never copies screenshot bytes, signed URLs, credentials, or sensitive payment details. |

## Important constraint

Neon Object Storage accepts S3 lifecycle configuration but does **not** enforce lifecycle expiry. SKYBET must therefore run its own authenticated daily cleanup and not depend on a bucket rule for deletion.[1]

## Cleanup behavior

Each run examines a bounded batch of eligible proof records. It explicitly deletes a private `neon_s3` object before clearing its stored key and MIME metadata. If an older `legacy_forge` record is encountered, SKYBET removes its application reference and records it as access-revoked; it does not claim that the legacy provider has physically deleted the object. A failed object action leaves that payment-request record unchanged so a later run can retry it. The cleanup never changes a review decision, customer balance, bonus balance, withdrawal, wager, or settlement state.

The endpoint is fail-closed. It returns `503` while the Railway-only retention secret is absent, accepts only a matching bearer token, and returns a key-free result summary. Its outcome record contains aggregate counts and timestamps only.

## Activation boundary

The cleanup handler will remain disabled until replacement storage credentials and a new `SKYBET_PROOF_RETENTION_CRON_SECRET` are configured only in Railway. The related daily scheduler must be configured only after deployment and one manual protected test. The scheduler must call the endpoint once daily over HTTPS; it is not an in-process timer. No screenshot storage credential belongs in GitHub, Netlify, the customer browser, or client source files.

The storage endpoint and credentials supplied in chat are treated as exposed and must be rotated. The replacement values are held as server-only configuration and are never reproduced in repository documentation.

## References

[1]: https://neon.com/docs/storage/s3-compatibility "Neon Object Storage: S3 compatibility"
[2]: https://neon.com/docs/storage/buckets "Neon Object Storage: Buckets"
[3]: https://neon.com/docs/storage/overview "Neon Object Storage overview"
