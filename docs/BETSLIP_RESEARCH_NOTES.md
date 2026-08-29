# Betslip research notes

## Public sources reviewed

### Football.com sports betting help
URL: https://www.football.com/ng/m/n/help/sports/how_to_play_sports

The documented flow is staged: browse/filter events, select odds into a bet slip, choose a bet type, enter a stake, review total odds and potential winnings, click Place Bet, confirm, and wait for results. The page says selections are added by tapping odds and describes Single, Multiple, and System bet types. It also states a maximum of 50 selections per slip and that the bet slip should display total odds, multibet bonus, and potential win amount based on stake.

### SportyBet help page
URL: https://www.sportybet.com/gh/m/help/how-to-play/others/how-to-edit-a-bet

The public page was dynamically loading in the sandbox and did not expose readable help text. The search result identifies the official help topic as editing a placed bet from Open Bets, with a Save Changes action and cashout implications. This is relevant as a deferred post-placement feature, not a prerequisite for the initial betslip fix.

## Implementation implications for SKYBET

The immediate defect is that the current preview slip has no stake-entry and Place Bet action. The first release should therefore support a clearly staged slip: selected legs, bet type, total odds, stake input, potential return, available balance, validation messages, explicit Place Bet action, and a separate confirmation step before any balance mutation.

Because the current SKYBET application is explicitly documented as a non-transactional preview and does not yet have a complete wager ledger or settlement engine, a real-money deduction should not be implemented as a client-only balance decrement. The server must validate the selection snapshot, stake bounds, account status, sufficient balance, and idempotency before atomically recording the wager and deducting funds. Odds should be snapshotted at placement, and later odds changes should not mutate an already accepted wager.

The automatic payment method remains deferred and must not be coupled to bet placement. The betslip can be built against the existing account balance boundary, but production wagering requires a verified server-side ledger, wager tables, event/market status validation, authorization, audit events, and settlement rules.

## Additional official FAQ findings

### SportyBet help search result
The official SportyBet help result says the normal placement flow uses “Place Bet” followed by “Confirm,” and reports whether the bet was successfully placed. Its edit-bet result says edited prices use current odds rather than the originally selected prices. The live help pages were dynamically rendered and not text-readable in the sandbox, so these points are treated as search-result evidence rather than a fully extracted page.

### Football.com Ghana sports FAQ
URL: https://www.football.com/gh/m/n/help/faq/faq_sports

The FAQ states that a confirmed bet cannot be cancelled. It gives a Ghana ticket stake range of GHS 0.1 to GHS 150,000, says both settled and unsettled bets are available in sports bet history, describes live odds as dynamic, and explains that Bet Builder selections can combine markets from the same match with automatically calculated combined odds.
