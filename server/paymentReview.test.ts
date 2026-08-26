import { describe, expect, it } from "vitest";
import { validateDepositPresetAmount, validateGhanaMobileMoneyNumber, validateReferralCommissionPercentage, validateWithdrawalAmount } from "../shared/payments";

describe("payment review input contracts", () => {
  it("accepts only the owner-approved deposit amounts", () => {
    expect(validateDepositPresetAmount("1000")).toEqual({ ok: true, amount: 1000 });
    expect(validateDepositPresetAmount("250")).toMatchObject({ ok: false });
  });

  it("validates withdrawal amounts without inferring an available balance", () => {
    expect(validateWithdrawalAmount("15.759")).toEqual({ ok: true, amount: 15.76 });
    expect(validateWithdrawalAmount("0")).toMatchObject({ ok: false });
  });

  it("normalizes Ghana Mobile Money withdrawal numbers and rejects malformed values", () => {
    expect(validateGhanaMobileMoneyNumber("024 123 4567")).toEqual({ ok: true, number: "233241234567" });
    expect(validateGhanaMobileMoneyNumber("+233 24 123 4567")).toEqual({ ok: true, number: "233241234567" });
    expect(validateGhanaMobileMoneyNumber("12345")).toMatchObject({ ok: false });
  });

  it("limits global and per-user referral commission settings to a percentage", () => {
    expect(validateReferralCommissionPercentage("12.345")).toEqual({ ok: true, percentage: 12.35 });
    expect(validateReferralCommissionPercentage("101")).toMatchObject({ ok: false });
  });
});
