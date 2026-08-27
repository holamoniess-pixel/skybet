# Scores and Fixtures Preview Architecture

## Implemented boundary

SKYBET now uses a **server-only, best-effort ESPN scores-and-fixtures preview** for the English Premier League (`soccer/eng.1`) endpoint. The browser talks only to SKYBET’s typed API; it never requests ESPN directly. The proxy validates the response, allows only an explicit league registry, keeps a two-minute last-good cache, limits repeat outbound calls, and returns a stale marker when a refresh fails.

| Included in the preview | Explicitly excluded |
| --- | --- |
| Fixture identifiers, competition labels, team names, start times, match status, live state, and scores. | Odds, prices, probabilities, selections, bet-slip actions, wallet effects, wagers, settlement, payment decisions, or model-generated estimates. |

The interface displays **“Data sourced from ESPN”**, its refresh interval, and a clear statement that the material is a best-effort preview rather than official betting odds or an ESPN partnership. ESPN’s public web endpoints are undocumented and should be considered operationally unstable; their availability or commercial suitability is not guaranteed.[1] [2]

## Resilience and scheduling boundary

The current implementation refreshes on demand through the cache and exposes a disabled-by-default `POST /api/scheduled/espn-preview-refresh` handler for a future Railway-compatible scheduler. The handler activates only when a server-side `SKYBET_ESPN_CRON_SECRET` is configured and a caller sends the matching bearer token. It is idempotent and returns only a safe refresh summary. No scheduler, in-process timer, or recurring job has been installed yet.

Railway’s native Cron Jobs are not suitable for the requested two-minute cadence: its shortest supported interval is five minutes, and its cron service must execute a short task and exit rather than run this web server.[3] If the owner later requires a two-minute refresh, use a separate managed HTTP scheduler that securely calls the deployed handler; otherwise use a five-minute cadence after confirming the trade-off. Do not use `node-cron`, `setInterval`, or a timer inside the SKYBET web process.

Before the owner enables any recurring schedule, deploy this handler, configure the token only in Railway, test one authenticated run, and then configure the approved scheduler to `POST` at the selected cadence. The handler must remain isolated from customer balances, transactions, bet acceptance, and settlement.

The in-memory cache is appropriate for an initial preview and stale fallback but is process-local. A multi-instance production deployment will require a shared cache or persisted snapshot if continuously scheduled refresh becomes necessary.

## Retired AI sports-data path

The NVIDIA/OpenRouter sports normalizer and provider-health modules have been removed. SKYBET does not use an AI model to acquire, infer, normalize, or generate customer-facing scores, fixtures, odds, or probabilities. If a future licensed provider requires metadata transformation, that should be treated as a separate, explicitly approved design and cannot alter canonical sporting or wagering data.

## References

[1]: https://www.cmswire.com/cms/customer-experience/espn-slam-dunks-its-public-api-026291.php "ESPN Slam Dunks Its Public API"
[2]: https://publicapis.io/espn-sports-api "ESPN API - Free Hidden Endpoints, No Key Required"
[3]: https://docs.railway.com/cron-jobs "Railway Cron Jobs"
