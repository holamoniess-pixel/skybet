# SkyBet — Upgrade Notes (v2.0.0)

Everything below is implemented and the project builds clean (`npm run build`).

---

## 1. Country detection now follows the registration choice

**Before:** `AccountPage` raced three IP geolocation providers (ipapi.co,
freeipapi, ip.guide) then hit two FX endpoints. `BetSlipPage` had its own
separate copy of the same thing. The casino games called `/api/geo/currency`.
The country the user actually picked at registration was sent to the API and
then thrown away.

That meant a player who registered in Ghana saw naira if they travelled or used
a VPN, and the currency visibly changed between page loads as lookups resolved.

**Now:** one registry, one rule — *the country is whatever the user picked at
registration.*

| File | Role |
|---|---|
| `src/config/countries.ts` | 17 markets: currency, symbol, locale, stake floor/ceiling, deposit/withdrawal minimums, payment rails, phone format |
| `src/utils/country.ts` | Resolution order: store → stored country → user profile → guest → default |
| `src/hooks/useCountry.ts` | The hook every component uses for money |

IP lookup still exists but does exactly **one** job now: pre-selecting a sensible
default in the country dropdown, which the user can always change. It never
decides what currency to render.

### The parity rule

You said *"1 cedi is the same as 1 naira and same for every country."* That's
implemented literally:

```
1 cedi == 1 naira == 1 shilling == 1 rand == 1 unit
```

There is **no FX conversion anywhere in the client**. A balance of 500 reads as
500 in every market — only the symbol changes. This also removed a real bug: the
old Aviator floor was `$10 USD × live rate`, recalculated every five minutes, so
the minimum moved under players mid-session.

### Minimum stake per country

Declared per-country in `countries.ts` so any single market can be tuned later
without touching consuming code, but defaulting to the same numeral everywhere
per the parity rule:

```ts
minStake: 1, maxStake: 10_000,
minDeposit: 5, minWithdrawal: 10,
stakeSteps: [1, 5, 10, 20, 50, 100]
```

Enforced in four places: the store's `placeBet`, the React casino games, the
arcade games via the bridge, and deposit/withdrawal in the store.

---

## 2. Token renamed to fit the site

**This fixed a live bug, not just naming.** The app used three different keys
for the same token:

| Old key | Used by |
|---|---|
| `accessToken` | React app |
| `sb_token` | the 10 arcade games |
| `currentUser` / `sb_user` | user blobs |

The React app wrote `accessToken`; the games read `sb_token`. **A signed-in
player was anonymous the instant a game loaded** — every authed call 401'd and
the game dropped to its own login gate.

Everything is now `skybet_token` / `skybet_user`, owned by
`src/utils/session.ts`. Legacy keys are **migrated automatically** on first
load, so nobody gets signed out by the upgrade.

Rewritten: 19 token references across game sources, 5 React call sites.

---

## 3. Refresh no longer logs you out

**Root cause:** `LoginPage` wrote the token to `localStorage` and set `user` in
the Zustand store's memory. Nothing ever read that token back. The store
initialised `user: null` on every page load — your session was sitting in
storage the whole time, the app just never looked.

**Fix,** in `src/store/index.ts`:

- `persist` middleware, storing durable state under `skybet_app_state`
- `hydrateSession()` rebuilds `user` from the token on mount (called from `App.tsx`)
- an `authReady` flag so the logged-out header never flashes for a frame
- tokens write to `sessionStorage` *and* `localStorage` when "remember me" is on
- no token means no session, so a logout in another tab can't leave a stale user

---

## 4. Games: smooth and seamless

### The structural bug

`GameRunner` fetches `/games/{slug}/index.html`, but the games lived in
`src/games/` and **there was no `public/` directory in the project at all**.
Every iframe was 404ing or getting the React app served back into itself.

- Games moved to `public/games/` (they now ship in `dist/` — verified)
- `vercel.json` rewrote *every* route to `index.html`, which would have broken
  the games in production the same way. Now excludes `/games/` and `/assets/`

### The bridge

`public/games/_skybet-bridge.js` is injected into every game's `<head>`
**before** the game's own script. The iframe is sandboxed with a null origin so
it can't read the parent's `localStorage` — values are serialised into a boot
payload at injection time and kept live over `postMessage`.

```js
CB.sym()  CB.fmt(n)  CB.fmtCompact(n)     // currency
CB.minStake()  CB.checkStake(n)  CB.clampStake(n)   // stake rules
CB.getToken()  CB.isAuthed()  CB.isGuest()          // session
CB.requestLogin()  CB.requestDeposit()              // route back to the shell
CB.onChange(fn)                                      // live country/session updates
```

Country changes and login/logout sync **without remounting the iframe** — a
rebuild of `srcDoc` would throw away a round in progress.

### Applied across all ten games

- 40 hardcoded `$` replaced with `CB.sym()`
- 44 static money elements in HTML tagged for symbol localisation
- 7 stake-floor checks replaced (`"Min bet is $1"` → country-aware validator)
- Quick-stake buttons parse any symbol instead of assuming `$`, and clamp to range
- **4 games were missing from the catalogue entirely** (spaceman, lucky-slots,
  fruit-frenzy, magic-ball) — `/games/spaceman` rendered "Game not found". Now all
  10 are registered

---

## 5. Guest mode

`/welcome` — where a first-time visitor on a direct link lands. Pick a country
(sets currency and stake floor before they see a single price), then explore
with play credits.

`FirstVisitGate` in `App.tsx` fires **once per browser**:

- returning visitors pass straight through — it's a first-run experience, not a wall
- signed-in users and active guests pass through
- `/register`, `/join`, `/login` and legal routes are exempt, so a shared referral
  link doesn't bounce and lose its `?ref=` code

Guests get 500 play credits, full run of the book and casino in demo mode. Deposit,
withdraw and real bets route into registration.

---

## 6. Two registration flows

| Route | Flow | For |
|---|---|---|
| `/register` | Classic 4-step form, everything visible | Someone who arrived intending to sign up |
| `/join` | Fill-in: **one question per screen** | A guest converting |

`/join` pre-fills everything already known from the guest draft and **skips
questions already answered** — a guest who gave their name earlier starts at the
email question. Answers persist to the draft as they're given, so closing the tab
halfway doesn't lose progress. Both hit the same `auth.register()` and produce
identical accounts.

---

## 7. Account page

- IP detection and FX conversion removed; currency is correct on first paint
  with zero network calls
- New **Region & Currency** card: country, currency, min/max stake, min
  deposit/withdrawal, and the payment rails available in that market

Previously a user had no way to see which currency their account was denominated
in, or what the floors were, until a bet failed.

---

## Verification

```bash
npm install
npm run build      # ✓ clean
npm run dev
```

- `npx tsc --noEmit` — no errors in any new or modified code
  (remaining `TS6133` unused-import warnings are pre-existing, untouched files)
- All 11 game scripts pass `node --check`
- `dist/games/` confirmed to contain all 10 games plus the bridge

### Worth testing by hand

1. Log in → hard refresh → still logged in
2. Register with Nigeria → header, bet slip, account page and every game show `₦`
3. Open a game while signed in → balance loads, no login gate
4. Fresh browser on a direct link → `/welcome` → guest → `/join` is pre-filled
5. Try to stake below the minimum in a game → country-specific error message

---

## 8. Full conversion — every file (completed)

The first pass converted the core. A full audit then found that **nine separate
files each carried their own private copy of IP geolocation + FX conversion** —
the same logic duplicated with different constants, cache keys and fallbacks.
All are now on the shared `useCountry()`:

| File | What was removed |
|---|---|
| `MinesGames.tsx` | ipapi.co + open.er-api.com, module-cached, converting a fixed 150 GHS floor |
| `VirtualFootballGame.tsx` | ipapi.co + USD FX table, converting a fixed 115 GHS floor |
| `Spindabottlegame.tsx` | ipapi.co + NGN-based FX refreshed every 5 min, driving an "≈ ₦1,234" second line |
| `Header.tsx` | ipapi.co cached **24 hours** in localStorage, mapping to only 3 symbols |
| `WalletPage.tsx` | Two-provider IP lookup **persisted permanently** under `cb_currency_v2`, plus a live USD rate fetch |
| `DepositPage.tsx` | ipapi.co deciding which market's payment rails to show |
| `AdminModal.tsx` | Three IP providers + two FX endpoints |
| `BetSlipPage.tsx` | Three IP providers + live rates + every `!isGHS` conversion branch |
| `MatchList.tsx` | Hardcoded `GH₵` ticker amounts and stake labels |

Two were worse than a plain lookup. `Header.tsx` cached its answer for 24 hours
and `WalletPage.tsx` persisted it **forever** with no invalidation path — so a
wrong result, or one belonging to a previous user of the device, stuck around
indefinitely. Logging out and back in as someone else cleared neither.

`DepositPage` was the riskiest of the set: IP decided which country's **payment
rails** you were offered, so someone travelling could be depositing into a
wallet denominated in one currency through another market's gateway.

Also completed in this pass:

- `Sidebar.tsx` — `formatCedi()` deleted; 60 winner rows now render in the
  player's own currency
- `RightSidebar.tsx` — moved to the reactive hook, so it re-renders on a
  country change (the plain `formatCurrency()` helper could not)
- `CasinoPage.tsx` — added a currency/stake strip above the grid, and fixed
  `LIVE_SLUGS`, which **omitted `sporty-hero`, `magic-ball` and `fruit-frenzy`
  even though all three had working components wired into `renderOpenGame()`** —
  clicking them showed a "still in development" popup for a finished game
- Last legacy token keys in `Spindabottlegame`, `VirtualFootballGame`,
  `MinesGames` and the `sessionStorage('accessToken')` fallbacks in
  `WalletPage` / `DepositPage`
- `AdminModal`'s per-user currency rows now resolve through the shared registry,
  so an admin view can never disagree with what the player sees

`SportyKickGame`, `MagicBallGame` and `FruitFrenzyGame` needed no changes —
they carry no currency logic at all (the "symbol" matches in FruitFrenzy are
slot reel symbols).

### Audit result

```
Live IP/FX fetches outside utils/country.ts ...... NONE
Hardcoded currency symbols in JSX ............... NONE
Legacy token keys in code ....................... NONE  (comments only)
Game scripts passing node --check ............... 11/11
Games shipped in dist/ .......................... 10 + bridge
tsc --noEmit .................................... clean
```

The only remaining `tsc` output is pre-existing `TS6133` unused-import warnings
in files this work never touched.
