/* ============================================================================
   SkyBet — SESSION / TOKEN STORE
   ----------------------------------------------------------------------------
   ONE place where the auth token lives. Before this file existed the app used
   three different key names for the same token:

       'accessToken'  — React app (LoginPage / api.ts)
       'sb_token'     — the arcade games in /public/games/*
       'currentUser'  — React app user blob
       'sb_user'      — games user blob

   Because the React app wrote 'accessToken' and the games read 'sb_token',
   a logged-in user was anonymous the moment they opened a game. Everything
   is now unified under SkyBet-branded keys, and legacy keys are migrated
   on first load so nobody gets signed out by the upgrade.

   Tokens are written to BOTH localStorage and sessionStorage:
     - localStorage survives a tab close ("remember me")
     - sessionStorage is the non-remembered case
   Reads check sessionStorage first, then localStorage. This is what makes a
   page refresh keep you signed in — see hydrateSession() in the store.
   ========================================================================== */

export const TOKEN_KEY = 'skybet_token';
export const USER_KEY = 'skybet_user';
export const COUNTRY_KEY = 'skybet_country';
export const GUEST_KEY = 'skybet_guest';
export const REMEMBER_KEY = 'skybet_remember';
export const VISITED_KEY = 'skybet_visited';

/** Keys written by older builds, read once then cleaned up. */
const LEGACY_TOKEN_KEYS = ['accessToken', 'sb_token', 'speedbet_token', 'token'];
const LEGACY_USER_KEYS = ['currentUser', 'sb_user', 'speedbet_user'];

export interface StoredUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  country?: string;
  currency?: string;
  [k: string]: unknown;
}

const hasWindow = () => typeof window !== 'undefined';

function readRaw(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    const v = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    return v && v !== 'undefined' && v !== 'null' ? v : null;
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string, remember: boolean): void {
  if (!hasWindow()) return;
  try {
    sessionStorage.setItem(key, value);
    if (remember) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode / quota — non-fatal */
  }
}

function removeRaw(key: string): void {
  if (!hasWindow()) return;
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------------------
   Legacy migration — runs once per page load, before anything reads a token.
   ------------------------------------------------------------------------- */

let migrated = false;

export function migrateLegacySession(): void {
  if (migrated || !hasWindow()) return;
  migrated = true;
  try {
    if (!readRaw(TOKEN_KEY)) {
      for (const k of LEGACY_TOKEN_KEYS) {
        const v = localStorage.getItem(k) ?? sessionStorage.getItem(k);
        if (v && v !== 'undefined' && v !== 'null') {
          // A migrated session is always treated as "remembered" — we can't
          // know which storage the user originally opted into, and silently
          // signing someone out is the worse failure.
          writeRaw(TOKEN_KEY, v, true);
          break;
        }
      }
    }
    if (!readRaw(USER_KEY)) {
      for (const k of LEGACY_USER_KEYS) {
        const v = localStorage.getItem(k) ?? sessionStorage.getItem(k);
        if (v && v !== 'undefined' && v !== 'null') {
          writeRaw(USER_KEY, v, true);
          break;
        }
      }
    }
    [...LEGACY_TOKEN_KEYS, ...LEGACY_USER_KEYS].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------------------
   Token
   ------------------------------------------------------------------------- */

export function getToken(): string | null {
  migrateLegacySession();
  return readRaw(TOKEN_KEY);
}

export function setToken(token: string, remember = true): void {
  if (!token) return;
  writeRaw(TOKEN_KEY, token, remember);
  writeRaw(REMEMBER_KEY, remember ? '1' : '0', true);
}

export function isRemembered(): boolean {
  return readRaw(REMEMBER_KEY) !== '0';
}

/* ---------------------------------------------------------------------------
   User blob
   ------------------------------------------------------------------------- */

export function getStoredUser(): StoredUser | null {
  migrateLegacySession();
  const raw = readRaw(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser, remember = true): void {
  writeRaw(USER_KEY, JSON.stringify(user), remember);
}

/* ---------------------------------------------------------------------------
   Country — persisted separately so the games iframe can read it cheaply
   without parsing the whole user object.
   ------------------------------------------------------------------------- */

export function getStoredCountry(): string | null {
  return readRaw(COUNTRY_KEY);
}

export function setStoredCountry(code: string): void {
  if (!code) return;
  writeRaw(COUNTRY_KEY, code.toUpperCase(), true);
}

/* ---------------------------------------------------------------------------
   Guest profile
   ------------------------------------------------------------------------- */

export interface GuestProfile {
  id: string;
  country: string;
  createdAt: string;
  /** Play-money balance so a guest can try the games before signing up. */
  balance: number;
  /** Anything the guest filled in that we carry into registration. */
  draft: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

export function getGuest(): GuestProfile | null {
  const raw = readRaw(GUEST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestProfile;
  } catch {
    return null;
  }
}

export function setGuest(g: GuestProfile): void {
  writeRaw(GUEST_KEY, JSON.stringify(g), true);
}

export function clearGuest(): void {
  removeRaw(GUEST_KEY);
}

/** Has this browser ever loaded SkyBet before? Drives the guest landing. */
export function hasVisited(): boolean {
  return readRaw(VISITED_KEY) === '1';
}

export function markVisited(): void {
  writeRaw(VISITED_KEY, '1', true);
}

/* ---------------------------------------------------------------------------
   Save / clear a whole session
   ------------------------------------------------------------------------- */

export interface SessionPayload {
  accessToken: string;
  user: StoredUser;
}

export function saveSession(data: SessionPayload, remember = true): void {
  setToken(data.accessToken, remember);
  if (data.user) {
    setStoredUser(data.user, remember);
    if (typeof data.user.country === 'string' && data.user.country) {
      setStoredCountry(data.user.country);
    }
  }
}

export function clearSession(): void {
  removeRaw(TOKEN_KEY);
  removeRaw(USER_KEY);
  removeRaw(REMEMBER_KEY);
  // Country and guest data deliberately survive a logout: the next visitor
  // on this device is overwhelmingly likely to be in the same country, and
  // wiping it would send them back through country selection for nothing.
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
