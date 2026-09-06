import { formatMoney, getCountry } from '../config/countries';
import { resolveCountry } from './country';

/**
 * Format an amount in the user's registered currency.
 *
 * This used to hardcode "GH₵" for everyone. It now resolves the country the
 * user chose at registration. Pass an explicit ISO code when you already have
 * one in hand (cheaper, and avoids a storage read).
 *
 * Prefer the `useCountry()` hook inside React components — it re-renders when
 * the country changes, which this plain function cannot do.
 */
export function formatCurrency(amount: number, countryCode?: string): string {
  const country = countryCode ? getCountry(countryCode) : resolveCountry();
  return formatMoney(amount, country);
}

export function maskUserId(id: string): string {
  if (id.length <= 6) return id;
  return id.slice(0, 3) + '***' + id.slice(-3);
}

export function calculateTotalOdds(odds: number[]): number {
  return odds.reduce((acc, odd) => acc * odd, 1);
}

export function calculatePotentialReturn(stake: number, totalOdds: number): number {
  return stake * totalOdds;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
