# SKYBET AI Sports Refresh Status

## Current status: retired

The previously proposed NVIDIA/OpenRouter sports-normalization implementation has been removed at the owner’s request. SKYBET does not operate a browser bot, model fallback, model provider health check, or AI probability/odds generator in the customer sports-data path.

The active implementation is a **server-cached ESPN scores-and-fixtures preview**. It exposes only match identity, team names, timing, status, and scores; it contains no odds, prices, probabilities, or bet-slip actions. The customer UI explicitly attributes ESPN and identifies the display as an unofficial, best-effort preview.

## Production boundary

No model output may become official sports truth, pricing, settlement input, or a source for real-money wagers. A future commercial betting launch requires an independently licensed data provider with explicit rights, market coverage, settlement rules, and operational support. ESPN’s undocumented public web endpoints do not meet that requirement.[1] [2]

No two-minute scheduler is active. The on-demand cache provides the initial data-refresh boundary while a Railway-compatible authenticated scheduler remains a separate owner decision.

## References

[1]: https://www.cmswire.com/cms/customer-experience/espn-slam-dunks-its-public-api-026291.php "ESPN Slam Dunks Its Public API"
[2]: https://publicapis.io/espn-sports-api "ESPN API - Free Hidden Endpoints, No Key Required"
