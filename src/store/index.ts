import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, BetSlipSelection, Bet, Transaction } from '../types';
import { mockBets, mockTransactions } from '../data/mock';
import {
  getCountry,
  validateStake,
  formatMoney,
  DEFAULT_COUNTRY_CODE,
  type CountryConfig,
} from '../config/countries';
import { resolveCountry } from '../utils/country';
import {
  getToken,
  getStoredUser,
  setStoredCountry,
  clearSession,
  migrateLegacySession,
  getGuest,
  setGuest,
  clearGuest,
  markVisited,
  hasVisited,
  type GuestProfile,
} from '../utils/session';

type Theme = 'skybet-primary' | 'skybet-dark';

/* ---------------------------------------------------------------------------
   Guest starting balance. Play money — it never touches the wallet API.
   ------------------------------------------------------------------------- */
const GUEST_START_BALANCE = 500;

interface AppState {
  user: User | null;

  /* ── Session ──────────────────────────────────────────────────────────── */
  /**
   * False until hydrateSession() has run. Guards render so we don't flash the
   * logged-out header for a frame on every refresh — that flash was what made
   * the old build look like it had signed you out.
   */
  authReady: boolean;

  /* ── Country / currency ───────────────────────────────────────────────── */
  /** ISO code chosen at registration. Drives currency, stakes, limits. */
  countryCode: string;

  /* ── Guest mode ───────────────────────────────────────────────────────── */
  isGuest: boolean;
  guest: GuestProfile | null;

  betSlip: BetSlipSelection[];
  bets: Bet[];
  mainWalletBalance: number;
  affiliateWalletBalance: number;
  transactions: Transaction[];
  theme: Theme;
  isAdminModalOpen: boolean;
  modalOpen: boolean;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;

  /* ── Actions ──────────────────────────────────────────────────────────── */
  hydrateSession: () => void;
  login: (user: User) => void;
  logout: () => void;

  setCountry: (code: string) => void;
  /** Resolved config object for the active country. */
  country: () => CountryConfig;
  /** Format an amount in the active country's currency. */
  fmt: (amount: number) => string;

  startGuest: (countryCode?: string) => GuestProfile;
  updateGuestDraft: (draft: Partial<GuestProfile['draft']>) => void;
  adjustGuestBalance: (delta: number) => void;
  endGuest: () => void;

  addToBetSlip: (selection: BetSlipSelection) => void;
  removeFromBetSlip: (matchId: string, market: string, selection: string) => void;
  clearBetSlip: () => void;
  placeBet: (stake: number) => void;
  toggleTheme: () => void;
  setAdminModalOpen: (open: boolean) => void;
  setModalOpen: (open: boolean) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => void;
  withdrawAffiliate: (amount: number) => void;
}

const allowedThemes: Theme[] = ['skybet-primary', 'skybet-dark'];

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme') as Theme;
    return allowedThemes.includes(saved) ? saved : 'skybet-primary';
  } catch {
    return 'skybet-primary';
  }
}

function newGuestId(): string {
  return `guest_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      authReady: false,
      countryCode: DEFAULT_COUNTRY_CODE,
      isGuest: false,
      guest: null,

      betSlip: [],
      bets: mockBets,
      mainWalletBalance: 1250.0,
      affiliateWalletBalance: 820.0,
      transactions: mockTransactions,
      theme: initialTheme(),
      isAdminModalOpen: false,
      modalOpen: false,
      toast: null,

      /* ══════════════════════════════════════════════════════════════════
         SESSION HYDRATION — the fix for "refresh logs me out"
         ------------------------------------------------------------------
         The old store had `user: null` as a hard-coded initial value and
         nothing ever read the token back out of storage. LoginPage wrote a
         token to localStorage, set `user` in memory, and on the next page
         load the token was still sitting there but the store had forgotten
         who you were — so the header rendered "Log in" and every guarded
         page bounced you out.

         This runs once from App.tsx on mount. It rebuilds `user` from the
         persisted token + user blob, then flips authReady so the UI can
         render with the right state on the very first paint.
         ══════════════════════════════════════════════════════════════════ */
      hydrateSession: () => {
        migrateLegacySession();

        const token = getToken();
        const stored = getStoredUser();
        const guest = getGuest();

        let user: User | null = get().user;

        if (token && stored) {
          user = {
            id: String(stored.id ?? ''),
            fullName:
              [stored.firstName, stored.lastName].filter(Boolean).join(' ') ||
              String(stored.email ?? 'SkyBet Player'),
            phone: String(stored.phone ?? ''),
            email: String(stored.email ?? ''),
            role: ['ADMIN', 'admin', 'SUPER_ADMIN', 'super_admin'].includes(
              String(stored.role ?? ''),
            )
              ? 'admin'
              : 'user',
            kycStatus: 'verified',
            referralCode: String(stored.referralCode ?? ''),
          };
        } else if (!token) {
          // No token means no session, regardless of what's in the persisted
          // slice. This is what stops a stale `user` from surviving a logout
          // that happened in another tab.
          user = null;
        }

        const country = resolveCountry(user ? undefined : get().countryCode);

        set({
          user,
          authReady: true,
          countryCode: country.code,
          isGuest: !user && !!guest,
          guest: user ? null : guest,
        });

        if (user && guest) {
          // A guest who signed in doesn't need the guest record any more.
          clearGuest();
          set({ isGuest: false, guest: null });
        }

        markVisited();
      },

      login: (user) => {
        clearGuest();
        set({ user, isGuest: false, guest: null, authReady: true });
        const c = resolveCountry(get().countryCode);
        set({ countryCode: c.code });
      },

      logout: () => {
        clearSession();
        set({ user: null, betSlip: [], isGuest: false, guest: null, authReady: true });
      },

      /* ══════════════════════════════════════════════════════════════════
         COUNTRY
         ══════════════════════════════════════════════════════════════════ */
      setCountry: (code) => {
        const c = getCountry(code);
        setStoredCountry(c.code);
        set({ countryCode: c.code });
        // Keep the guest record in step so the games bridge sees one value.
        const g = get().guest;
        if (g) {
          const next = { ...g, country: c.code };
          setGuest(next);
          set({ guest: next });
        }
      },

      country: () => getCountry(get().countryCode),

      fmt: (amount) => formatMoney(amount, getCountry(get().countryCode)),

      /* ══════════════════════════════════════════════════════════════════
         GUEST MODE
         ══════════════════════════════════════════════════════════════════ */
      startGuest: (countryCode) => {
        const code = getCountry(countryCode ?? get().countryCode).code;
        const existing = getGuest();
        const g: GuestProfile = existing ?? {
          id: newGuestId(),
          country: code,
          createdAt: new Date().toISOString(),
          balance: GUEST_START_BALANCE,
          draft: {},
        };
        g.country = code;
        setGuest(g);
        setStoredCountry(code);
        markVisited();
        set({ isGuest: true, guest: g, countryCode: code });
        return g;
      },

      updateGuestDraft: (draft) => {
        const g = get().guest ?? getGuest();
        if (!g) return;
        const next = { ...g, draft: { ...g.draft, ...draft } };
        setGuest(next);
        set({ guest: next });
      },

      adjustGuestBalance: (delta) => {
        const g = get().guest ?? getGuest();
        if (!g) return;
        const next = { ...g, balance: Math.max(0, Math.round((g.balance + delta) * 100) / 100) };
        setGuest(next);
        set({ guest: next });
      },

      endGuest: () => {
        clearGuest();
        set({ isGuest: false, guest: null });
      },

      /* ══════════════════════════════════════════════════════════════════
         BET SLIP
         ══════════════════════════════════════════════════════════════════ */
      addToBetSlip: (selection) => {
        const { betSlip } = get();
        const exists = betSlip.find(
          (s) =>
            s.matchId === selection.matchId &&
            s.market === selection.market &&
            s.selection === selection.selection,
        );
        if (exists) {
          set({
            betSlip: betSlip.filter(
              (s) =>
                !(
                  s.matchId === selection.matchId &&
                  s.market === selection.market &&
                  s.selection === selection.selection
                ),
            ),
          });
        } else {
          const filtered = betSlip.filter(
            (s) => !(s.matchId === selection.matchId && s.market === selection.market),
          );
          set({ betSlip: [...filtered, selection] });
        }
      },

      removeFromBetSlip: (matchId, market, selection) => {
        set({
          betSlip: get().betSlip.filter(
            (s) => !(s.matchId === matchId && s.market === market && s.selection === selection),
          ),
        });
      },

      clearBetSlip: () => set({ betSlip: [] }),

      placeBet: (stake) => {
        const { betSlip, mainWalletBalance, countryCode } = get();
        const country = getCountry(countryCode);

        if (betSlip.length === 0) {
          get().showToast('Your bet slip is empty.', 'error');
          return;
        }

        // Per-country stake floor / ceiling.
        const check = validateStake(stake, country);
        if (!check.ok) {
          get().showToast(check.reason ?? 'Invalid stake.', 'error');
          return;
        }
        if (stake > mainWalletBalance) {
          get().showToast('Insufficient balance for this stake.', 'error');
          return;
        }

        const totalOdds = betSlip.reduce((acc, s) => acc * s.odd, 1);
        const newBet: Bet = {
          id: `b${Date.now()}`,
          selections: [...betSlip],
          stake,
          totalOdds: Math.round(totalOdds * 100) / 100,
          potentialReturn: Math.round(stake * totalOdds * 100) / 100,
          status: 'pending',
          placedAt: new Date().toISOString(),
        };
        set((state) => ({
          bets: [newBet, ...state.bets],
          betSlip: [],
          mainWalletBalance: Math.round((mainWalletBalance - stake) * 100) / 100,
          transactions: [
            {
              id: `t${Date.now()}`,
              type: 'bet_loss',
              amount: stake,
              description: 'Bet Placed',
              date: new Date().toISOString().split('T')[0],
              status: 'completed',
            },
            ...state.transactions,
          ],
        }));
        get().showToast('Bet placed successfully!', 'success');
      },

      toggleTheme: () =>
        set((state) => {
          const themeOrder: Theme[] = ['skybet-primary', 'skybet-dark'];
          const currentIndex = themeOrder.indexOf(state.theme);
          const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
          document.documentElement.setAttribute('data-theme', nextTheme);
          try {
            localStorage.setItem('theme', nextTheme);
          } catch {
            /* ignore */
          }
          return { theme: nextTheme };
        }),

      setAdminModalOpen: (open) => set({ isAdminModalOpen: open }),
      setModalOpen: (open) => set({ modalOpen: open }),

      showToast: (message, type) => {
        set({ toast: { message, type } });
        setTimeout(() => set({ toast: null }), 3000);
      },

      clearToast: () => set({ toast: null }),

      deposit: (amount) => {
        const country = getCountry(get().countryCode);
        if (amount <= 0) {
          get().showToast('Deposit amount must be positive.', 'error');
          return;
        }
        if (amount < country.minDeposit) {
          get().showToast(
            `Minimum deposit is ${formatMoney(country.minDeposit, country)}.`,
            'error',
          );
          return;
        }
        set((s) => ({
          mainWalletBalance: Math.round((s.mainWalletBalance + amount) * 100) / 100,
          transactions: [
            {
              id: `t${Date.now()}`,
              type: 'deposit',
              amount,
              description: 'Deposit',
              date: new Date().toISOString().split('T')[0],
              status: 'completed',
            },
            ...s.transactions,
          ],
        }));
        get().showToast('Deposit successful!', 'success');
      },

      withdraw: (amount) => {
        const { mainWalletBalance, countryCode } = get();
        const country = getCountry(countryCode);
        if (amount <= 0) {
          get().showToast('Withdrawal amount must be positive.', 'error');
          return;
        }
        if (amount < country.minWithdrawal) {
          get().showToast(
            `Minimum withdrawal is ${formatMoney(country.minWithdrawal, country)}.`,
            'error',
          );
          return;
        }
        if (amount > mainWalletBalance) {
          get().showToast('Insufficient balance for withdrawal.', 'error');
          return;
        }
        set((s) => ({
          mainWalletBalance: Math.round((s.mainWalletBalance - amount) * 100) / 100,
          transactions: [
            {
              id: `t${Date.now()}`,
              type: 'withdrawal',
              amount,
              description: 'Withdrawal',
              date: new Date().toISOString().split('T')[0],
              status: 'completed',
            },
            ...s.transactions,
          ],
        }));
        get().showToast('Withdrawal successful!', 'success');
      },

      withdrawAffiliate: (amount) => {
        const { affiliateWalletBalance } = get();
        if (amount <= 0) {
          get().showToast('Affiliate withdrawal amount must be positive.', 'error');
          return;
        }
        if (amount > affiliateWalletBalance) {
          get().showToast('Insufficient affiliate balance for withdrawal.', 'error');
          return;
        }
        set((s) => ({
          affiliateWalletBalance: Math.round((s.affiliateWalletBalance - amount) * 100) / 100,
          transactions: [
            {
              id: `t${Date.now()}`,
              type: 'affiliate',
              amount,
              description: 'Affiliate Withdrawal',
              date: new Date().toISOString().split('T')[0],
              status: 'completed',
            },
            ...s.transactions,
          ],
        }));
        get().showToast('Affiliate withdrawal successful!', 'success');
      },
    }),
    {
      name: 'skybet_app_state',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      /**
       * Only durable state is persisted. Transient UI (toast, modals,
       * authReady) is deliberately excluded so a refresh never restores a
       * half-open modal or a stale "already loaded" flag.
       */
      partialize: (s) => ({
        user: s.user,
        countryCode: s.countryCode,
        isGuest: s.isGuest,
        guest: s.guest,
        betSlip: s.betSlip,
        bets: s.bets,
        mainWalletBalance: s.mainWalletBalance,
        affiliateWalletBalance: s.affiliateWalletBalance,
        transactions: s.transactions,
        theme: s.theme,
      }),
    },
  ),
);

/** Re-export so callers don't have to reach into utils/session directly. */
export { hasVisited };
