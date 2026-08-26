# ESPN Data Access Assessment

## Outcome

ESPN does not provide SKYBET with an official, documented commercial odds or wagering-data agreement through its public web endpoints. References describe those endpoints as undocumented, and ESPN’s former public API programme has been discontinued.[1] [2]

The owner approved a narrow exception: SKYBET may use the unofficial `soccer/eng.1` scoreboard route as a **best-effort, server-proxied scores-and-fixtures preview**. The implemented boundary permits only team names, competition, start time, match status, and score. It does not read or expose odds fields, does not authenticate with ESPN, does not scrape pages or bypass paywalls, and does not feed bet acceptance, pricing, balances, payment flows, or settlement.

| Decision | Rationale |
| --- | --- |
| Server-only proxy with cache, validation, limiter, and stale fallback | Limits customer-origin calls and allows the application to degrade safely if the undocumented response changes or becomes unavailable. |
| Visible ESPN attribution and preview disclaimer | Makes the unofficial source and non-wagering limitation understandable to customers. |
| No scheduled polling yet | A deployed, authenticated Railway-compatible handler must be tested before the owner enables a recurring job. |
| Licensed provider still required for wagering | A commercial provider agreement must define permitted leagues, availability, market lifecycle, results, and settlement support. |

No ESPN credential was requested or used.

## References

[1]: https://www.cmswire.com/cms/customer-experience/espn-slam-dunks-its-public-api-026291.php "ESPN Slam Dunks Its Public API"
[2]: https://publicapis.io/espn-sports-api "ESPN API - Free Hidden Endpoints, No Key Required"
