# Live Data Refresh Architecture

## Purpose

The requested refresh should keep match information current at a two-minute cadence. It must not treat a browser model as a data provider, manufacture match details, or publish odds from unverified content. The customer application remains in its existing non-transactional preview state until a licensed source is connected and server-side validation is complete.

| Approach | Trade-offs | Cost | Setup complexity |
| --- | --- | --- | --- |
| Licensed sports-data feed with scheduled server refresh | Deterministic data, documented coverage, and a stable support path. The model is optional and limited to normalizing provider text into a validated schema. | Provider subscription plus any model usage. | Moderate. Requires provider credentials, source mapping, and a scheduled refresh handler. |
| Permissioned browser collection with model-assisted extraction | Useful only when the specific source gives written permission and no API exists. It is more fragile, needs strict rate limits and source-specific parsers, and must not bypass access controls. | Potential model usage plus maintenance. | High. Requires approved source URLs, rights confirmation, parsing tests, and monitoring. |

## Recommended operating boundary

The first approach should be used for launch. A server-side job can run every two minutes, fetch only the approved provider’s documented endpoints, validate the response, store a timestamped snapshot, and retain the last known good data when a refresh fails. The job must be idempotent, must not change user balances or settle selections, and must keep live provider data separate from the existing preview catalogue.

NVIDIA NIM can be used only as an optional server-side transformation step. Its documented OpenAI-compatible API supports structured model inference, but a model response must never be accepted as a source of truth for fixture, score, or odds data.[1] A strict schema validator should reject incomplete, stale, malformed, or unverified output.

No NVIDIA credential, data provider, source URL, browser automation, schedule, or live odds integration is enabled by this document. Credentials must be added only through secure project configuration.

## Configured model fallback order

The server-side normalizer now has four ordered fallbacks: NVIDIA `meta/llama-3.1-8b-instruct`, NVIDIA `meta/llama-3.3-70b-instruct`, OpenRouter `nvidia/nemotron-3.5-lightning:free`, and OpenRouter `liquid/lfm-2.5-2.6b:free`. Provider keys remain server-only. The normalizer accepts only a `licensed-feed` snapshot and uses zero-temperature structured output for display metadata only. It must omit odds, prices, probabilities, scores, and calculated values; the original licensed-feed event payload remains the sole canonical record for those fields.

## Required source handoff

Before implementation, provide the licensed data-provider name and confirmation of the approved leagues. If browser collection is intended instead, provide the specific source URLs and written permission to collect from them.

## References

[1]: https://docs.nvidia.com/nim/large-language-models/latest/reference/api-reference.html "NVIDIA NIM API Reference"
