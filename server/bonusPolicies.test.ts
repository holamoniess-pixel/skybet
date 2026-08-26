import { describe, expect, it } from "vitest";
import { validateBonusPolicyAmounts } from "../shared/bonusPolicies";

describe("bonus policy configuration", () => {
  it("accepts zero-valued bonus categories while preserving two-decimal amounts", () => {
    expect(validateBonusPolicyAmounts({ referralCommissionAmount: "15.759", depositBonusAmount: "0", settlementBonusAmount: "5" })).toEqual({
      ok: true,
      amounts: { referralCommissionAmount: 15.76, depositBonusAmount: 0, settlementBonusAmount: 5 },
    });
  });

  it("rejects a negative bonus category", () => {
    expect(validateBonusPolicyAmounts({ referralCommissionAmount: "-1", depositBonusAmount: "0", settlementBonusAmount: "0" })).toEqual({
      ok: false,
      reason: "Enter a valid referral commission amount.",
    });
  });
});
