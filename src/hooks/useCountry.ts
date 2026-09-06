import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store';
import {
  getCountry,
  formatMoney,
  formatMoneyCompact,
  validateStake,
  clampStake,
  type CountryConfig,
  type StakeCheck,
} from '../config/countries';

/* ============================================================================
   useCountry — the hook every component should use for money.
   ----------------------------------------------------------------------------
   Reads the country the user chose AT REGISTRATION out of the store and hands
   back everything derived from it: symbol, currency code, stake floor/ceiling,
   quick-stake chips, and formatters.

   Usage:
       const { fmt, minStake, symbol, checkStake } = useCountry();
       <span>{fmt(balance)}</span>
       <p>Minimum stake: {fmt(minStake)}</p>

   Never hardcode 'GH₵' or '$' in a component again — go through fmt().
   ========================================================================== */

export interface UseCountry {
  country: CountryConfig;
  code: string;
  name: string;
  flag: string;
  dial: string;
  symbol: string;
  currency: string;
  currencyName: string;

  minStake: number;
  maxStake: number;
  stakeSteps: number[];
  minDeposit: number;
  minWithdrawal: number;
  paymentMethods: string[];

  /** Format with symbol + grouping, 2dp by default. */
  fmt: (amount: number, decimals?: number) => string;
  /** Compact form for tickers: GH₵1.2K */
  fmtCompact: (amount: number) => string;
  /** Validate a stake against this country's floor/ceiling. */
  checkStake: (amount: number) => StakeCheck;
  /** Clamp a stake into the legal range. */
  clamp: (amount: number) => number;
  /** Change the active country (also persists it). */
  setCountry: (code: string) => void;
}

export function useCountry(): UseCountry {
  const countryCode = useAppStore((s) => s.countryCode);
  const setCountryAction = useAppStore((s) => s.setCountry);

  const country = useMemo(() => getCountry(countryCode), [countryCode]);

  const fmt = useCallback(
    (amount: number, decimals = 2) => formatMoney(amount, country, decimals),
    [country],
  );

  const fmtCompact = useCallback(
    (amount: number) => formatMoneyCompact(amount, country),
    [country],
  );

  const checkStake = useCallback((amount: number) => validateStake(amount, country), [country]);

  const clamp = useCallback((amount: number) => clampStake(amount, country), [country]);

  return {
    country,
    code: country.code,
    name: country.name,
    flag: country.flag,
    dial: country.dial,
    symbol: country.symbol,
    currency: country.currency,
    currencyName: country.currencyName,

    minStake: country.minStake,
    maxStake: country.maxStake,
    stakeSteps: country.stakeSteps,
    minDeposit: country.minDeposit,
    minWithdrawal: country.minWithdrawal,
    paymentMethods: country.paymentMethods,

    fmt,
    fmtCompact,
    checkStake,
    clamp,
    setCountry: setCountryAction,
  };
}

export default useCountry;
