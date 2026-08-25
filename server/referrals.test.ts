import { describe, expect, it } from "vitest";
import { validateReferralRewardAmount } from "../shared/referrals";

describe("referral reward configuration", () => {
  it("accepts a monetary amount with two decimal places", () => {
    expect(validateReferralRewardAmount("15.759")).toEqual({ ok: true, amount: 15.76 });
  });

  it("rejects non-positive values", () => {
    expect(validateReferralRewardAmount("0")).toEqual({
      ok: false,
      reason: "The reward amount must be greater than zero.",
    });
  });

  it("rejects invalid configuration input", () => {
    expect(validateReferralRewardAmount("not-a-number")).toEqual({
      ok: false,
      reason: "Enter a valid reward amount.",
    });
  });
});
