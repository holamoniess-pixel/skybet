# Free Sports-Data Research for SKYBET

## API-Sports / API-Football

The official API-Sports site states that its free plan provides access to all dashboard endpoints, requires registration, needs no credit card, and remains free. The site lists football, AFL, baseball, basketball, Formula 1, handball, hockey, MMA, NBA, NFL/NCAA, rugby, and volleyball APIs. This makes it a plausible free source for fixtures, scores, and some sports metadata. The site also advertises widgets and separate sports libraries, but the free plan’s exact request quota, odds endpoint limits, commercial-use terms, and Ghana-market coverage must be confirmed in the account dashboard and terms before production use. A free plan should not automatically be assumed to grant sportsbook odds or wagering rights.

Source: [API-Sports](https://api-sports.io/)

## TheSportsDB

The official free API page says TheSportsDB provides free JSON sports data and artwork and aims to remain free at point of access. It distinguishes a paid premium tier that provides a dedicated production API key, V2 API access, and two-minute livescores. The free page does not advertise sportsbook odds, settlement, or wagering markets. This makes it useful for a free editorial or fixture/artwork preview, not for live betting odds.

Source: [TheSportsDB Free Sports API](https://www.thesportsdb.com/free_sports_api)

## Odds-API.io

The official free-tier page advertises 100 requests per hour, up to 500 requests per day, all 34 sports, two recreational bookmakers, live and pre-match odds, and JSON responses. Crucially, the same page says the free tier is intended for development and testing and that production applications with commercial use should upgrade to a paid plan. It is therefore useful for a proof of concept, but it does not satisfy the requirement for a completely free commercial live sportsbook odds feed.

Source: [Odds-API.io Free Sports Betting Odds API](https://odds-api.io/pricing/free)

## ESPN finding

The official ESPN public site exposes sports news, video, scores/fantasy experiences, and gambling-related links, but the reviewed public site does not expose a supported developer portal or a documented free odds-distribution API. Search results also surfaced unofficial reverse-engineered endpoints and third-party wrappers; those are not safe foundations for a production sportsbook because they may be undocumented, rate-limited, unstable, or outside ESPN’s permission. ESPN should therefore not be treated as a free licensed odds provider for SKYBET. Direct browser access to ESPN was policy-blocked in this environment, so this conclusion is based on the official public-site text retrieval and the absence of an official developer-access path, not on scraping.

Source: [ESPN](https://www.espn.com/)
