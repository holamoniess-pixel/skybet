/* ============================================================================
   SkyBet — COUNTRY RESOLUTION
   ----------------------------------------------------------------------------
   The rule: THE COUNTRY IS WHATEVER THE USER PICKED AT REGISTRATION.

   IP geolocation used to drive currency across the app (AccountPage hit
   ipapi.co, the games hit /api/geo/currency). That produced a user who
   registered in Ghana seeing naira because they were travelling, or because
   a VPN or a mobile carrier's egress IP said so. It also made the currency
   flicker: the page rendered in cedis, the lookup resolved, everything
   re-rendered in something else.

   Now: registration choice wins, always. IP is used for ONE thing —
   suggesting a default in the country dropdown before the user has chosen.
   ========================================================================== */

import {
  getCountry,
  isSupportedCountry,
  DEFAULT_COUNTRY,
  DEFAULT_COUNTRY_CODE,
  type CountryConfig,
} from '../config/countries';
import { getStoredCountry, getStoredUser, getGuest } from './session';

/**
 * Resolve the country to use for currency, stakes and limits.
 *
 * Order:
 *   1. explicit override (e.g. the value held in the Zustand store)
 *   2. the persisted registration country
 *   3. the country on the stored user profile
 *   4. the guest profile's chosen country
 *   5. DEFAULT_COUNTRY
 */
export function resolveCountry(override?: string | null): CountryConfig {
  if (isSupportedCountry(override)) return getCountry(override);

  const stored = getStoredCountry();
  if (isSupportedCountry(stored)) return getCountry(stored);

  const user = getStoredUser();
  if (isSupportedCountry(user?.country)) return getCountry(user?.country);

  const guest = getGuest();
  if (isSupportedCountry(guest?.country)) return getCountry(guest?.country);

  return DEFAULT_COUNTRY;
}

/* ---------------------------------------------------------------------------
   IP suggestion — ONLY for pre-selecting the dropdown.
   Never call this to decide what currency to render. It is advisory.
   ------------------------------------------------------------------------- */

let suggestionCache: string | null = null;
let suggestionInFlight: Promise<string> | null = null;

async function fetchIpCountry(): Promise<string> {
  const endpoints: Array<{ url: string; pick: (d: Record<string, unknown>) => unknown }> = [
    { url: 'https://ipapi.co/json/', pick: (d) => d.country_code },
    { url: 'https://freeipapi.com/api/json', pick: (d) => d.countryCode },
    {
      url: 'https://ip.guide/',
      pick: (d) => (d.location as Record<string, unknown> | undefined)?.country_code,
    },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        signal: AbortSignal.timeout(3500),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, unknown>;
      const code = ep.pick(data);
      if (typeof code === 'string' && isSupportedCountry(code)) {
        return code.toUpperCase();
      }
    } catch {
      /* try the next provider */
    }
  }
  return DEFAULT_COUNTRY_CODE;
}

/**
 * Best guess at the visitor's country, for pre-selecting the register /
 * guest dropdown. Cached for the page's lifetime; always resolves, never
 * rejects. The user can always override the result.
 */
export function suggestCountryCode(): Promise<string> {
  if (suggestionCache) return Promise.resolve(suggestionCache);
  if (suggestionInFlight) return suggestionInFlight;

  // The browser's own locale is a decent zero-latency first guess.
  try {
    const region = new Intl.Locale(navigator.language).region;
    if (region && isSupportedCountry(region)) {
      suggestionCache = region.toUpperCase();
      return Promise.resolve(suggestionCache);
    }
  } catch {
    /* Intl.Locale unsupported — fall through to the network lookup */
  }

  suggestionInFlight = fetchIpCountry()
    .then((code) => {
      suggestionCache = code;
      return code;
    })
    .finally(() => {
      suggestionInFlight = null;
    });

  return suggestionInFlight;
}
