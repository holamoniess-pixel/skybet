# Match-data backend research notes

## Provider evidence

### Sportmonks Football API
URL: https://www.sportmonks.com/football-api/

Sportmonks advertises 2,200+ leagues, live scores, fixtures, events, lineups, statistics, odds, xG, and predictions. Its published starter plan begins at €29/month for any five leagues, with 2,000 API calls per entity per hour; higher tiers increase league and call coverage. The provider describes a free tier for two full leagues for prototyping. This is a strong production candidate for live and prediction data, but it requires provider signup and a paid plan for broad coverage.

### API-Football / API-Sports
URLs: https://www.api-football.com/ and https://www.api-football.com/pricing

API-Football advertises 1,200+ leagues, teams, fixtures, livescore, events, odds, statistics, and predictions. Its page states live matches and events are updated every 15 seconds. The published free plan includes teams, fixtures, livescore, odds, and predictions at 100 requests/day; published paid tiers include $19/month for 7,500 requests/day, $29/month for 75,000 requests/day, and $39/month for 150,000 requests/day. The free plan is useful for a prototype but is unlikely to support broad multi-league polling at production frequency without caching and a paid quota.

### football-data.org
URL: https://www.football-data.org/documentation/api

The API documentation models competitions, seasons, teams, and matches and supports authenticated requests and resource filters. Its documentation advises smart requests and avoiding excessive polling. It is useful for a smaller competition catalogue and historical fixtures, but the reviewed documentation does not establish the broad live odds/prediction coverage needed for a sportsbook-like product.

## Architecture conclusion

A 5,000-team static name catalogue is not the same as a live match feed. The reliable design is to import team and competition records from a licensed provider, normalize them into SKYBET tables, then refresh fixtures and live status through a server-side cache. Predictions must be stored as clearly labeled model output with timestamp, model/version, and confidence metadata; they must never be presented as guaranteed outcomes or used as a settlement authority.

Before production wagering, the application also needs a verified odds feed, market suspension handling, a server-side wager ledger, event/market validation, settlement rules, and legal/compliance review. The first implementation should therefore separate data ingestion and admin observability from real-money betting and settlement.

## Current repository inspection

The public app still uses the hard-coded `shared/skybet.ts` event catalogue and a separate `shared/mockGamesFeed.ts` demo feed. The server has an ESPN preview adapter and cache, but that adapter is explicitly scores-and-fixtures preview only. The existing admin Match preview page renders that ESPN preview and states that odds, bets, and settlement are unavailable.

The current database schema has no persistent teams, competitions, fixtures, markets, odds, predictions, wagers, or settlement tables. The current betslip is a local preview sheet with selected event/market/value objects, a stake field, accumulator odds, potential return, and a `Save preview slip` action. It does not call a bet-placement procedure or deduct balance.

## Open club catalogue measurement

The public `openfootball/clubs` repository is CC0/public-domain oriented and contains regional plain-text club datasets. A simple count of primary-looking club rows in the cloned dataset returned approximately 3,429 rows, so it is a useful lawful base but does not by itself guarantee 5,000 unique current clubs. The implementation should either target the provider’s available normalized catalogue size, combine it with another compatible source after license review, or let the owner approve a lower target rather than silently inventing club names.
