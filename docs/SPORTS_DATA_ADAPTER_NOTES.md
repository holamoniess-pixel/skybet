# Sports-Data Adapter Assessment

## OpticOdds connector assessment

The current task configuration includes a disabled **OpticOdds** connector. OpticOdds' official getting-started documentation states that access requires a licence key and identifies fixtures, odds, results, and Server-Sent Events streams as core products.[1] Its documentation describes `X-Api-Key` authentication, active-fixture discovery, and SSE streams for odds and results updates.[2] The provider FAQ states that it offers SSE rather than webhooks or WebSockets.[3]

The future adapter should keep the key server-side, normalize fixture/result payloads into the existing event model, expose a read-only public tRPC query, and use a separately approved backend design for any high-frequency streaming. No OpticOdds connector was enabled and no provider call was made in this frontend refinement.

## Flutterwave handoff boundary

Flutterwave credentials and business documents must not be shared in chat or committed to source control. A future backend integration should accept keys only through secure project settings, create payment intents server-side, verify payment callbacks server-side, and keep withdrawal requests under authenticated, validated server control. The present customer UI deliberately does not initiate deposits, withdrawals, wagers, or payouts.

## References

[1]: https://developer.opticodds.com/reference/getting-started "OpticOdds Getting Started"
[2]: https://developer.opticodds.com/docs/odds-api-getting-started-guide "OpticOdds Odds API Getting Started Guide"
[3]: https://developer.opticodds.com/docs/api-faq "OpticOdds API FAQ"
