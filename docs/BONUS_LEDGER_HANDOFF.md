# Bonus Ledger and Settlement Handoff

## Ledger classification

| Event type | Display bucket | Current implementation state |
| --- | --- | --- |
| Confirmed Flutterwave deposit | **Deposited funds** | Awaiting secure payment backend and webhook verification. |
| Referral commission | **Bonus balance** | Admin policy configuration is persisted and audited; no customer credit is created yet. |
| Deposit promotion | **Bonus balance** | Admin policy configuration is persisted and audited; no customer credit is created yet. |
| Settlement promotion or non-deposit credit | **Bonus balance** | The customer win treatment presents this rule as a non-transactional preview only. |

The `account_balance_summaries` read model has separate `depositedBalance` and `bonusBalance` fields. No UI or API mutation in the current application changes either field. The secure backend must own all future ledger writes, validate provider events idempotently, and create audit records for every balance-affecting entry.

## Administrator policy controls

`bonus_policy_rules` provides a versioned programme policy and `bonus_policy_overrides` provides a versioned per-user exception. Each captures the referral commission, deposit bonus, settlement bonus, reason, creator, timestamps, and an append-only administrative audit event. The `/admin` workspace exposes both scopes as configuration controls only.

## Settlement presentation

The bet-history route contains an explicit **Open win treatment preview** entry for review. It uses the cup artwork supplied by the project owner and states that no balance, bonus, or payout has changed. A future settlement service must trigger it only after a verified backend settlement event. It must never derive a result, credit a balance, or mark a slip as settled from the client.
