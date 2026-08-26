export type BonusPolicyAmounts = {
  referralCommissionAmount: number;
  depositBonusAmount: number;
  settlementBonusAmount: number;
};

const MAX_BONUS_POLICY_AMOUNT = 1_000_000;

export function validateBonusPolicyAmounts(input: Record<keyof BonusPolicyAmounts, string>):
  | { ok: true; amounts: BonusPolicyAmounts }
  | { ok: false; reason: string } {
  const fields: Array<[keyof BonusPolicyAmounts, string]> = [
    ["referralCommissionAmount", "referral commission"],
    ["depositBonusAmount", "deposit bonus"],
    ["settlementBonusAmount", "settlement bonus"],
  ];

  const amounts = {} as BonusPolicyAmounts;
  for (const [field, label] of fields) {
    const parsed = Number(input[field]);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_BONUS_POLICY_AMOUNT) {
      return { ok: false, reason: `Enter a valid ${label} amount.` };
    }
    amounts[field] = Math.round(parsed * 100) / 100;
  }

  return { ok: true, amounts };
}
