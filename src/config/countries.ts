/* ============================================================================
   SkyBet — COUNTRY / CURRENCY REGISTRY
   ----------------------------------------------------------------------------
   SINGLE SOURCE OF TRUTH for country, currency, symbol and minimum stake.

   ── THE PARITY RULE ────────────────────────────────────────────────────────
   Money in SkyBet is handled at PARITY across every country:

       1 cedi  ==  1 naira  ==  1 shilling  ==  1 rand  ==  1 unit

   There is NO FX conversion anywhere in the client. A balance of 500 is
   "500" in every market — only the SYMBOL in front of it changes. This is
   deliberate: it keeps stake ladders, minimums, bonuses, promo values and
   leaderboards identical and comparable in every country, and it removes an
   entire class of bugs where a floor silently drifted because an exchange
   rate refreshed mid-session.

   Do NOT reintroduce rate-based conversion without changing this comment
   and every consumer of minStake().

   ── COUNTRY DETECTION ──────────────────────────────────────────────────────
   The country is whatever the user PICKED AT REGISTRATION. It is never
   inferred from IP geolocation. IP lookup is used for exactly one thing:
   pre-selecting a sensible default in the country dropdown on the register
   / guest screen, which the user is always free to change.

   Resolution order (see resolveCountry in src/utils/country.ts):
       1. store.country          — set at registration, persisted
       2. user.country           — whatever the backend has on the profile
       3. guest.country          — chosen on the guest landing screen
       4. DEFAULT_COUNTRY_CODE   — final fallback
   ========================================================================== */

export interface CountryConfig {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** International dialling prefix, including '+' */
  dial: string;
  flag: string;
  /** ISO 4217 currency code */
  currency: string;
  /** Display symbol, placed before the amount */
  symbol: string;
  /** Human name of the currency, used on the account page */
  currencyName: string;
  /** BCP-47 locale used for thousands separators */
  locale: string;
  /** Minimum stake, in local units. Parity rule: same numeral everywhere. */
  minStake: number;
  /** Maximum stake, in local units. */
  maxStake: number;
  /** Quick-pick stake chips shown under bet inputs */
  stakeSteps: number[];
  /** Minimum deposit, in local units */
  minDeposit: number;
  /** Minimum withdrawal, in local units */
  minWithdrawal: number;
  /** Placeholder shown in the phone field */
  phonePlaceholder: string;
  /** Example first/last name pair used as field placeholders */
  namePlaceholder: [string, string];
  /** Deposit rails available in this market */
  paymentMethods: string[];
  /** Whether the market is open for real-money play */
  live: boolean;
}

/* ---------------------------------------------------------------------------
   The registry.
   minStake/maxStake/stakeSteps are intentionally IDENTICAL across countries
   (the parity rule). They are still declared per-country so a single market
   can be tuned later — e.g. if a regulator imposes a different floor — without
   touching any consuming code.
   ------------------------------------------------------------------------- */

// Base values for countries that do not override them
const STAKE_STEPS_DEFAULT = [1, 5, 10, 20, 50, 100];
const MIN_STAKE_DEFAULT = 1;
const MAX_STAKE_DEFAULT = 10_000;
const MIN_DEPOSIT_DEFAULT = 5;
const MIN_WITHDRAWAL_DEFAULT = 10;

const base = {
  minStake: MIN_STAKE_DEFAULT,
  maxStake: MAX_STAKE_DEFAULT,
  stakeSteps: STAKE_STEPS_DEFAULT,
  minDeposit: MIN_DEPOSIT_DEFAULT,
  minWithdrawal: MIN_WITHDRAWAL_DEFAULT,
};

export const COUNTRIES: CountryConfig[] = [
  {
    // GHANA — minStake = 250
    ...base,
    code: 'GH',
    name: 'Ghana',
    dial: '+233',
    flag: '🇬🇭',
    currency: 'GHS',
    symbol: 'GH₵',
    currencyName: 'Ghanaian Cedi',
    locale: 'en-GH',
    minStake: 5,
    maxStake: 100_000,
    stakeSteps: [250, 500, 1000, 2500, 5000],
    minDeposit: 250,
    minWithdrawal: 250,
    phonePlaceholder: '024 123 4567',
    namePlaceholder: ['Kwame', 'Mensah'],
    paymentMethods: ['MTN MoMo', 'Telecel Cash', 'AT Money', 'Bank Transfer', 'Crypto'],
    live: true,
  },
  {
    // NIGERIA — minStake = 35,000
    ...base,
    code: 'NG',
    name: 'Nigeria',
    dial: '+234',
    flag: '🇳🇬',
    currency: 'NGN',
    symbol: '₦',
    currencyName: 'Nigerian Naira',
    locale: 'en-NG',
    minStake: 35_000,
    maxStake: 10_000_000,
    stakeSteps: [35_000, 70_000, 140_000, 350_000, 700_000],
    minDeposit: 35_000,
    minWithdrawal: 35_000,
    phonePlaceholder: '080 1234 5678',
    namePlaceholder: ['Chidi', 'Okonkwo'],
    paymentMethods: ['Bank Transfer', 'Opay', 'Paystack', 'USSD', 'Crypto'],
    live: true,
  },
  // All other countries keep the base values
  {
    ...base,
    code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪',
    currency: 'KES', symbol: 'KSh', currencyName: 'Kenyan Shilling', locale: 'en-KE',
    phonePlaceholder: '0712 345 678', namePlaceholder: ['Aisha', 'Wambua'],
    paymentMethods: ['M-Pesa', 'Airtel Money', 'Bank Transfer', 'Crypto'],
    live: true,
  },
  {
    ...base,
    code: 'TZ', name: 'Tanzania', dial: '+255', flag: '🇹🇿',
    currency: 'TZS', symbol: 'TSh', currencyName: 'Tanzanian Shilling', locale: 'en-TZ',
    phonePlaceholder: '0712 345 678', namePlaceholder: ['Juma', 'Mwakasege'],
    paymentMethods: ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Bank Transfer'],
    live: true,
  },
  {
    ...base,
    code: 'UG', name: 'Uganda', dial: '+256', flag: '🇺🇬',
    currency: 'UGX', symbol: 'USh', currencyName: 'Ugandan Shilling', locale: 'en-UG',
    phonePlaceholder: '0712 345 678', namePlaceholder: ['Brian', 'Okello'],
    paymentMethods: ['MTN MoMo', 'Airtel Money', 'Bank Transfer'],
    live: true,
  },
  {
    ...base,
    code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦',
    currency: 'ZAR', symbol: 'R', currencyName: 'South African Rand', locale: 'en-ZA',
    phonePlaceholder: '071 234 5678', namePlaceholder: ['Thabo', 'Dlamini'],
    paymentMethods: ['Instant EFT', 'Bank Transfer', 'Card', 'Crypto'],
    live: true,
  },
  {
    ...base,
    code: 'ZM', name: 'Zambia', dial: '+260', flag: '🇿🇲',
    currency: 'ZMW', symbol: 'ZK', currencyName: 'Zambian Kwacha', locale: 'en-ZM',
    phonePlaceholder: '097 123 4567', namePlaceholder: ['Mwansa', 'Banda'],
    paymentMethods: ['MTN MoMo', 'Airtel Money', 'Bank Transfer'],
    live: true,
  },
  {
    ...base,
    code: 'CM', name: 'Cameroon', dial: '+237', flag: '🇨🇲',
    currency: 'XAF', symbol: 'FCFA', currencyName: 'Central African CFA Franc', locale: 'fr-CM',
    phonePlaceholder: '6 71 23 45 67', namePlaceholder: ['Ariane', 'Nkeng'],
    paymentMethods: ['MTN MoMo', 'Orange Money', 'Bank Transfer'],
    live: true,
  },
  {
    ...base,
    code: 'SN', name: 'Senegal', dial: '+221', flag: '🇸🇳',
    currency: 'XOF', symbol: 'CFA', currencyName: 'West African CFA Franc', locale: 'fr-SN',
    phonePlaceholder: '77 123 45 67', namePlaceholder: ['Fatou', 'Diallo'],
    paymentMethods: ['Orange Money', 'Wave', 'Free Money', 'Bank Transfer'],
    live: true,
  },
  {
    ...base,
    code: 'CI', name: "Côte d'Ivoire", dial: '+225', flag: '🇨🇮',
    currency: 'XOF', symbol: 'CFA', currencyName: 'West African CFA Franc', locale: 'fr-CI',
    phonePlaceholder: '01 23 45 67 89', namePlaceholder: ['Koffi', 'Kouassi'],
    paymentMethods: ['Orange Money', 'MTN MoMo', 'Wave', 'Bank Transfer'],
    live: true,
  },
  {
    ...base,
    code: 'ET', name: 'Ethiopia', dial: '+251', flag: '🇪🇹',
    currency: 'ETB', symbol: 'Br', currencyName: 'Ethiopian Birr', locale: 'am-ET',
    phonePlaceholder: '091 123 4567', namePlaceholder: ['Biruk', 'Tesfaye'],
    paymentMethods: ['Telebirr', 'CBE Birr', 'Bank Transfer'],
    live: true,
  },
  {
    ...base,
    code: 'RW', name: 'Rwanda', dial: '+250', flag: '🇷🇼',
    currency: 'RWF', symbol: 'FRw', currencyName: 'Rwandan Franc', locale: 'rw-RW',
    phonePlaceholder: '078 123 4567', namePlaceholder: ['Eric', 'Mugisha'],
    paymentMethods: ['MTN MoMo', 'Airtel Money', 'Bank Transfer'],
    live: true,
  },
  {
    ...base,
    code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧',
    currency: 'GBP', symbol: '£', currencyName: 'British Pound', locale: 'en-GB',
    phonePlaceholder: '07911 123456', namePlaceholder: ['Oliver', 'Williams'],
    paymentMethods: ['Card', 'Bank Transfer', 'Apple Pay', 'Crypto'],
    live: true,
  },
  {
    ...base,
    code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸',
    currency: 'USD', symbol: '$', currencyName: 'US Dollar', locale: 'en-US',
    phonePlaceholder: '201 555 0123', namePlaceholder: ['Jordan', 'Smith'],
    paymentMethods: ['Card', 'Bank Transfer', 'Crypto'],
    live: true,
  },
  {
    ...base,
    code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪',
    currency: 'EUR', symbol: '€', currencyName: 'Euro', locale: 'de-DE',
    phonePlaceholder: '0151 1234 5678', namePlaceholder: ['Lukas', 'Müller'],
    paymentMethods: ['SEPA', 'Card', 'Sofort', 'Crypto'],
    live: true,
  },
  {
    ...base,
    code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷',
    currency: 'EUR', symbol: '€', currencyName: 'Euro', locale: 'fr-FR',
    phonePlaceholder: '06 12 34 56 78', namePlaceholder: ['Léa', 'Dubois'],
    paymentMethods: ['SEPA', 'Card', 'Crypto'],
    live: true,
  },
  {
    ...base,
    code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸',
    currency: 'EUR', symbol: '€', currencyName: 'Euro', locale: 'es-ES',
    phonePlaceholder: '612 345 678', namePlaceholder: ['Sofía', 'García'],
    paymentMethods: ['SEPA', 'Card', 'Bizum', 'Crypto'],
    live: true,
  },
];

export const DEFAULT_COUNTRY_CODE = 'GH';

const BY_CODE: Record<string, CountryConfig> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

export const DEFAULT_COUNTRY: CountryConfig = BY_CODE[DEFAULT_COUNTRY_CODE];

/** Look up a country by ISO code. Falls back to the default, never throws. */
export function getCountry(code: string | null | undefined): CountryConfig {
  if (!code) return DEFAULT_COUNTRY;
  return BY_CODE[code.toUpperCase()] ?? DEFAULT_COUNTRY;
}

/** True if the ISO code is a market SkyBet actually serves. */
export function isSupportedCountry(code: string | null | undefined): boolean {
  return !!code && !!BY_CODE[code.toUpperCase()];
}

/** Find a country by its ISO 4217 currency code (first match wins). */
export function getCountryByCurrency(currency: string): CountryConfig | undefined {
  return COUNTRIES.find((c) => c.currency === currency.toUpperCase());
}

/* ---------------------------------------------------------------------------
   Formatting
   ------------------------------------------------------------------------- */

/**
 * Format an amount for display: symbol + grouped digits.
 * `decimals` defaults to 2; pass 0 for whole-unit currencies.
 */
export function formatMoney(
  amount: number,
  country: CountryConfig | string = DEFAULT_COUNTRY,
  decimals = 2,
): string {
  const c = typeof country === 'string' ? getCountry(country) : country;
  const n = Number.isFinite(amount) ? amount : 0;
  let body: string;
  try {
    body = n.toLocaleString(c.locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } catch {
    body = n.toFixed(decimals);
  }
  return `${c.symbol}${body}`;
}

/** Compact form for tickers and chips — 1.2K / 3.4M. */
export function formatMoneyCompact(
  amount: number,
  country: CountryConfig | string = DEFAULT_COUNTRY,
): string {
  const c = typeof country === 'string' ? getCountry(country) : country;
  const n = Math.abs(amount);
  if (n >= 1_000_000) return `${c.symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${c.symbol}${(amount / 1_000).toFixed(1)}K`;
  return formatMoney(amount, c, 2);
}

/* ---------------------------------------------------------------------------
   Stake rules
   ------------------------------------------------------------------------- */

export interface StakeCheck {
  ok: boolean;
  /** Human-readable reason, ready to drop into an error label. */
  reason: string | null;
}

/** Validate a stake against the country's floor and ceiling. */
export function validateStake(
  amount: number,
  country: CountryConfig | string = DEFAULT_COUNTRY,
): StakeCheck {
  const c = typeof country === 'string' ? getCountry(country) : country;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'Enter a stake amount.' };
  }
  if (amount < c.minStake) {
    return { ok: false, reason: `Minimum stake is ${formatMoney(c.minStake, c)}.` };
  }
  if (amount > c.maxStake) {
    return { ok: false, reason: `Maximum stake is ${formatMoney(c.maxStake, c)}.` };
  }
  return { ok: true, reason: null };
}

/** Clamp a stake into the country's legal range. */
export function clampStake(
  amount: number,
  country: CountryConfig | string = DEFAULT_COUNTRY,
): number {
  const c = typeof country === 'string' ? getCountry(country) : country;
  if (!Number.isFinite(amount)) return c.minStake;
  return Math.min(c.maxStake, Math.max(c.minStake, amount));
}
