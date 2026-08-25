export type ReferralRewardValidation =
  | { ok: true; amount: number }
  | { ok: false; reason: string };

export function validateReferralRewardAmount(rawAmount: string): ReferralRewardValidation {
  const amount = Number(rawAmount);

  if (!Number.isFinite(amount)) {
    return { ok: false, reason: "Enter a valid reward amount." };
  }

  if (amount <= 0) {
    return { ok: false, reason: "The reward amount must be greater than zero." };
  }

  if (amount > 100000) {
    return { ok: false, reason: "The reward amount exceeds the permitted configuration range." };
  }

  return { ok: true, amount: Math.round(amount * 100) / 100 };
}
