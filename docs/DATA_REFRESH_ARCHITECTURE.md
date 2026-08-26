# Scores and Fixtures Preview Architecture

## Implemented boundary

SKYBET now uses a **server-only, best-effort ESPN scores-and-fixtures preview** for the English Premier League (`soccer/eng.1`) endpoint. The browser talks only to SKYBET’s typed API; it never requests ESPN directly. The proxy validates the response, allows only an explicit league registry, keeps a two-minute last-good cache, limits repeat outbound calls, and returns a stale marker when a refresh fails.

| Included in the preview | Explicitly excluded |
| --- | --- |
| Fixture identifiers, competition labels, team names, start times, match status, live state, and scores. | Odds, prices, probabilities, selections, bet-slip actions, wallet effects, wagers, settlement, payment decisions, or model-generated estimates. |

The interface displays **“Data sourced from ESPN”**, its refresh interval, and a clear statement that the material is a best-effort preview rather than official betting odds or an ESPN partnership. ESPN’s public web endpoints are undocumented and should be considered operationally unstable; their availability or commercial suitability is not guaranteed.[1] [2]

## Resilience and scheduling boundary

The current implementation refreshes only on demand through the cache; it does not install a background timer, cron task, or continuous worker. A future two-minute scheduled handler must be an authenticated, idempotent `/api/scheduled/*` route deployed and manually tested before the owner enables a Railway-compatible scheduler. That handler must remain isolated from customer balances, transactions, bet acceptance, and settlement.

The in-memory cache is appropriate for an initial preview and stale fallback but is process-local. A multi-instance production deployment will require a shared cache or persisted snapshot if continuously scheduled refresh becomes necessary.

## Retired AI sports-data path

The NVIDIA/OpenRouter sports normalizer and provider-health modules have been removed. SKYBET does not use an AI model to acquire, infer, normalize, or generate customer-facing scores, fixtures, odds, or probabilities. If a future licensed provider requires metadata transformation, that should be treated as a separate, explicitly approved design and cannot alter canonical sporting or wagering data.

## References

[1]: https://www.cmswire.com/cms/customer-experience/espn-slam-dunks-its-public-api-026291.php "ESPN Slam Dunks Its Public API"
[2]: https://publicapis.io/espn-sports-api "ESPN API - Free Hidden Endpoints, No Key Required"
