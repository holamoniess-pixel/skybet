export const DEPOSIT_PRESET_AMOUNTS = [200, 300, 500, 1000, 1500, 2000] as const;

export type DepositPresetAmount = (typeof DEPOSIT_PRESET_AMOUNTS)[number];

export function validateDepositPresetAmount(rawAmount: string) {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || !DEPOSIT_PRESET_AMOUNTS.includes(amount as DepositPresetAmount)) {
    return { ok: false as const, reason: "Choose one of the approved deposit amounts." };
  }
  return { ok: true as const, amount: amount as DepositPresetAmount };
}

export function validateWithdrawalAmount(rawAmount: string) {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { ok: false as const, reason: "Enter a withdrawal amount greater than zero." };
  }
  return { ok: true as const, amount: Math.round(amount * 100) / 100 };
}

export function validateReferralCommissionPercentage(rawPercentage: string) {
  const percentage = Number(rawPercentage);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return { ok: false as const, reason: "Enter a commission percentage from 0 to 100." };
  }
  return { ok: true as const, percentage: Math.round(percentage * 100) / 100 };
}
