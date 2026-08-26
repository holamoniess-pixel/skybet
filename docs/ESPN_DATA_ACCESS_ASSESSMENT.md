# ESPN Data Access Assessment

## Outcome

ESPN was evaluated as the proposed live-data source. The review did **not** identify an official, public developer API or a documented commercial data-feed onboarding route suitable for treating ESPN web score data as a launch-ready sports-betting feed. Third-party references describe web JSON endpoints as undocumented and note that ESPN discontinued its public API programme; those routes are therefore not an approved production integration basis.[1] [2]

| Decision | Rationale |
| --- | --- |
| Do not connect unofficial ESPN web endpoints | Their status, coverage, rate limits, and commercial-use rights are not an approved provider contract. |
| Keep the current adapter unconfigured | The customer interface continues to state accurately that live data appears only after an approved provider is configured. |
| Select a licensed data provider | A provider agreement should establish the permitted sport/leagues, live-update mechanism, service availability, data-rights scope, and support path. |

The existing provider-ready adapter and administration boundaries remain ready for this handoff. No credentials were requested or used.

## References

[1]: https://www.cmswire.com/cms/customer-experience/espn-slam-dunks-its-public-api-026291.php "ESPN Slam Dunks Its Public API"
[2]: https://publicapis.io/espn-sports-api "ESPN API - Free Hidden Endpoints, No Key Required"
