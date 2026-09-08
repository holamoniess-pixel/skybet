import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import {
  adminAnalytics,
  adminMatches,
  adminAffiliate,
  withdrawals,
  adminBooking,
  superAdminUpgradeChats,
  upgradeChats,
  superAdmin,
  superAdminPayouts,
  matches as matchesApi,
} from '../utils/api';

import type {
  AdminUpgradeChatDto,
  AdminUpgradeChatMessageDto,
  Match,
  BookingCode,
  WithdrawalRequest,
  PayoutRequest,
  AffiliateStatsDTO,
  AdminAffiliateStatsDTO,
  CreateBookingRequest,
  PageResponse,
  ReferralLink,
} from '../utils/api';

import CloseIcon               from '@mui/icons-material/Close';
import AdminPanelSettingsIcon  from '@mui/icons-material/AdminPanelSettings';
import PaymentsIcon            from '@mui/icons-material/Payments';
import BarChartIcon            from '@mui/icons-material/BarChart';
import CheckIcon               from '@mui/icons-material/Check';
import BlockIcon               from '@mui/icons-material/Block';
import ChatIcon                from '@mui/icons-material/Chat';
import RefreshIcon             from '@mui/icons-material/Refresh';
import SendIcon                from '@mui/icons-material/Send';
import SportsSoccerIcon        from '@mui/icons-material/SportsSoccer';
import QrCodeIcon              from '@mui/icons-material/QrCode';
import GroupAddIcon            from '@mui/icons-material/GroupAdd';
import AttachMoneyIcon         from '@mui/icons-material/AttachMoney';
import MarkChatReadIcon        from '@mui/icons-material/MarkChatRead';
import CircularProgress        from '@mui/icons-material/Loop';
import AddIcon                 from '@mui/icons-material/Add';
import SupervisorAccountIcon   from '@mui/icons-material/SupervisorAccount';
import ContentCopyIcon         from '@mui/icons-material/ContentCopy';
import OpenInNewIcon           from '@mui/icons-material/OpenInNew';
import DeleteIcon              from '@mui/icons-material/Delete';
import DeleteSweepIcon         from '@mui/icons-material/DeleteSweep';
import MenuIcon                from '@mui/icons-material/Menu';
import BoltIcon                from '@mui/icons-material/Bolt';
import EventRepeatIcon         from '@mui/icons-material/EventRepeat';
import { getToken as getSessionToken } from '../utils/session';
import { useCountry } from '../hooks/useCountry';
import { COUNTRIES as REGISTRY_COUNTRIES } from '../config/countries';

// ─── Auto-Schedule Match: types + local API client ────────────────────────────
const API_ORIGIN =
  (import.meta as any)?.env?.VITE_API_URL ||
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  'https://futballbackend-production-b1a0.up.railway.app';

const AUTO_MATCH_API_BASE = `${API_ORIGIN.replace(/\/$/, '')}/admin/matches/auto`;

interface AutoMatchScheduleRequest {
  homeTeam: string;
  awayTeam: string;
  league?: string;
  sport?: string;
  homeLogo?: string;
  awayLogo?: string;
  leagueLogo?: string;
  featured?: boolean;
  kickoffAt: string; // ISO instant
  finalScoreHome: number;
  finalScoreAway: number;
}

interface ScheduledGoalPlan {
  minute: number;
  scorer: string;       // 'HOME' | 'AWAY'
  at: string;            // ISO instant the goal fires
  scoreHome: number;
  scoreAway: number;
}

interface AutoMatchSchedule {
  matchId?: string;
  kickoffAt?: string;
  halfTimeAt?: string;
  secondHalfAt?: string;
  finishAt?: string;
  goals?: ScheduledGoalPlan[];
  [key: string]: unknown;
}

function authHeaders(): HeadersInit {
  const token =
    (typeof window !== 'undefined' &&
      (localStorage.getItem('token') || localStorage.getItem('authToken') || getSessionToken())) ||
    '';
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

async function autoMatchApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${AUTO_MATCH_API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch { /* body wasn't JSON */ }
    throw new Error(message);
  }
  if (res.status === 204) return null as unknown as T;
  return res.json();
}

const adminMatchScheduleApi = {
  create: (payload: AutoMatchScheduleRequest) =>
    autoMatchApiFetch<Match>('', { method: 'POST', body: JSON.stringify(payload) }),
  getSchedule: (matchId: string) =>
    autoMatchApiFetch<AutoMatchSchedule>(`/${matchId}`),
  cancelSchedule: (matchId: string) =>
    autoMatchApiFetch<{ matchId: string; jobsCancelled: number }>(`/${matchId}`, { method: 'DELETE' }),
};

// ─── Commission Ledger: daily / weekly / monthly breakdown ───────────────────
const COMMISSION_API_BASE = `${API_ORIGIN.replace(/\/$/, '')}/api/admin/affiliate/commission`;
const COUNTRY_DEPOSIT_API_BASE = `${API_ORIGIN.replace(/\/$/, '')}/api/admin/affiliate/deposits`;

interface CommissionPeriod {
  periodLabel: string;   // "2026-07-03" (daily) | "2026-W27" (weekly, ISO week) | "2026-07" (monthly)
  periodStart: string;   // ISO instant
  amount: number;
  currency: string;
}

interface CountryDepositPeriod {
  periodLabel: string;
  country: string;
  amount: number;
  depositCount: number;
}

type CommissionPeriodType = 'daily' | 'weekly' | 'monthly';

async function commissionApiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${COMMISSION_API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch { /* body wasn't JSON */ }
    throw new Error(message);
  }
  return res.json();
}

/** Backend wraps these responses in ApiResponse<T> — { success, data }. */
function unwrapCommissionResponse(raw: any): CommissionPeriod[] {
  if (raw && typeof raw === 'object' && 'data' in raw) return Array.isArray(raw.data) ? raw.data : [];
  return Array.isArray(raw) ? raw : [];
}

async function countryDepositApiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${COUNTRY_DEPOSIT_API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try { const body = await res.json(); message = body?.message || body?.error || message; } catch {}
    throw new Error(message);
  }
  return res.json();
}

function unwrapDepositResponse(raw: any): CountryDepositPeriod[] {
  if (raw && typeof raw === 'object' && 'data' in raw) return Array.isArray(raw.data) ? raw.data : [];
  return Array.isArray(raw) ? raw : [];
}

const adminCountryDepositApi = {
  getDaily: (days = 30) => countryDepositApiFetch<any>(`/by-country/daily?days=${days}`).then(unwrapDepositResponse),
  getWeekly: (weeks = 12) => countryDepositApiFetch<any>(`/by-country/weekly?weeks=${weeks}`).then(unwrapDepositResponse),
  getMonthly: (months = 12) => countryDepositApiFetch<any>(`/by-country/monthly?months=${months}`).then(unwrapDepositResponse),
  getTotals: (days = 365) => countryDepositApiFetch<any>(`/by-country/totals?days=${days}`).then(unwrapDepositResponse),
};

const adminCommissionApi = {
  getDaily: (days = 30) =>
    commissionApiFetch<any>(`/daily?days=${days}`).then(unwrapCommissionResponse),
  getWeekly: (weeks = 12) =>
    commissionApiFetch<any>(`/weekly?weeks=${weeks}`).then(unwrapCommissionResponse),
  getMonthly: (months = 12) =>
    commissionApiFetch<any>(`/monthly?months=${months}`).then(unwrapCommissionResponse),
};

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionKey =
  | 'dashboard'
  | 'matches'
  | 'bookings'
  | 'affiliate'
  | 'withdrawals'
  | 'upgrade-chats'
  | 'payouts';

// ─── Currency detection ───────────────────────────────────────────────────────

interface CurrencyInfo {
  code: string;
  symbol: string;
  countryCode: string;
  name: string;
  rateFromGhs: number;
}

/* Superseded by src/config/countries.ts — kept only as the lookup source
   for REGISTRY_BY_CODE below, which is built from the shared registry. */
const _LEGACY_COUNTRY_CURRENCY: Record<string, { code: string; symbol: string; name: string }> = {
  GH: { code: 'GHS', symbol: 'GH₵',  name: 'Ghanaian Cedi' },
  NG: { code: 'NGN', symbol: '₦',    name: 'Nigerian Naira' },
  KE: { code: 'KES', symbol: 'KSh',  name: 'Kenyan Shilling' },
  TZ: { code: 'TZS', symbol: 'TSh',  name: 'Tanzanian Shilling' },
  UG: { code: 'UGX', symbol: 'USh',  name: 'Ugandan Shilling' },
  ZA: { code: 'ZAR', symbol: 'R',    name: 'South African Rand' },
  EG: { code: 'EGP', symbol: 'E£',   name: 'Egyptian Pound' },
  ET: { code: 'ETB', symbol: 'Br',   name: 'Ethiopian Birr' },
  SN: { code: 'XOF', symbol: 'CFA',  name: 'West African CFA Franc' },
  CI: { code: 'XOF', symbol: 'CFA',  name: 'West African CFA Franc' },
  CM: { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc' },
  ZM: { code: 'ZMW', symbol: 'ZK',   name: 'Zambian Kwacha' },
  ZW: { code: 'ZWL', symbol: 'Z$',   name: 'Zimbabwean Dollar' },
  RW: { code: 'RWF', symbol: 'FRw',  name: 'Rwandan Franc' },
  MW: { code: 'MWK', symbol: 'MK',   name: 'Malawian Kwacha' },
  MZ: { code: 'MZN', symbol: 'MT',   name: 'Mozambican Metical' },
  GB: { code: 'GBP', symbol: '£',    name: 'British Pound' },
  DE: { code: 'EUR', symbol: '€',    name: 'Euro' },
  FR: { code: 'EUR', symbol: '€',    name: 'Euro' },
  US: { code: 'USD', symbol: '$',    name: 'US Dollar' },
  CA: { code: 'CAD', symbol: 'CA$',  name: 'Canadian Dollar' },
  AU: { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar' },
};

const COUNTRY_LABELS: Record<string, { flag: string; name: string; color: string }> = {
  GH: { flag: '🇬🇭', name: 'Ghana',   color: '#4ade80' },
  NG: { flag: '🇳🇬', name: 'Nigeria', color: '#63d2ff' },
  KE: { flag: '🇰🇪', name: 'Kenya',   color: '#fbbf24' },
  TZ: { flag: '🇹🇿', name: 'Tanzania', color: '#f472b6' },
  UG: { flag: '🇺🇬', name: 'Uganda',  color: '#a78bfa' },
  ZA: { flag: '🇿🇦', name: 'South Africa', color: '#fb923c' },
  UNKNOWN: { flag: '🌍', name: 'Unknown', color: 'rgba(255,255,255,0.3)' },
};
function countryMeta(code: string) { return COUNTRY_LABELS[code] ?? { flag: '🌍', name: code, color: '#94a3b8' }; }

// ─── Deposits by Country — plain figures, no chart ────────────────────────────
//
// FIXED: this component used to format every row with `fmt(amount, currency)`,
// where `currency` is the *admin's own* IP-geolocated currency (from useCurrency()).
// That meant a Nigerian depositor's amount was being labeled with whatever
// currency the admin happens to be browsing from (e.g. GHS if the admin is in
// Ghana) instead of Naira. The deposit `amount` field is already in the correct
// native currency for that country (no conversion is being applied anywhere
// upstream), so the only thing that was wrong was the *symbol/currency code*
// used to render it. `nativeFmt` below formats a row using the currency that
// belongs to its own country (NG -> NGN/₦, GH -> GHS/GH₵, etc.) instead of the
// admin's detected currency. No exchange-rate conversion is performed.
function nativeFmt(amount: number, countryCode: string): string {
  // Sourced from the shared registry so admin rows can never disagree with
  // what the player sees on their own account page.
  const cur = REGISTRY_BY_CODE[countryCode];
  if (!cur) {
    // Unknown country code — fall back to plain GHS-style formatting so we
    // still show *something* sensible rather than crashing.
    return fmt(amount);
  }
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: cur.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${cur.symbol}${amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function CountryDepositBreakdown() {
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [rows, setRows] = useState<CountryDepositPeriod[]>([]);
  const [totals, setTotals] = useState<CountryDepositPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (r: typeof range) => {
    setLoading(true); setError('');
    try {
      const [periodData, totalsData] = await Promise.all([
        r === 'daily' ? adminCountryDepositApi.getDaily(30)
          : r === 'weekly' ? adminCountryDepositApi.getWeekly(12)
          : adminCountryDepositApi.getMonthly(12),
        adminCountryDepositApi.getTotals(365),
      ]);
      setRows(periodData);
      setTotals(totalsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load deposits by country');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  // Most recent period first
  const periods = useMemo(() => [...new Set(rows.map((r) => r.periodLabel))].sort().slice(-14).reverse(), [rows]);
  const grandCount = totals.reduce((s, t) => s + t.depositCount, 0);

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Deposits by Country</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['daily', 'weekly', 'monthly'] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ padding: '5px 11px', borderRadius: 7, border: `1.5px solid ${range === r ? 'rgba(99,210,255,0.4)' : 'rgba(255,255,255,0.08)'}`, background: range === r ? 'rgba(99,210,255,0.1)' : 'transparent', color: range === r ? '#63d2ff' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3, 4].map((i) => <div key={i} style={{ height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />)}</div>
      ) : error ? (
        <ErrorState text={error} onRetry={() => load(range)} />
      ) : periods.length === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0' }}>No deposits in this range yet.</p>
      ) : (
        <>
          {/* Per-country totals — actual figures + number of people who deposited.
              Each country's amount is now rendered in ITS OWN currency
              (nativeFmt) instead of the admin's locally-detected currency. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {totals.sort((a, b) => b.amount - a.amount).map((t) => {
              const meta = countryMeta(t.country);
              return (
                <div key={t.country} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.flag}</span>
                  <span style={{ fontSize: 12, color: '#fff', flexShrink: 0, width: 110 }}>{meta.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{t.depositCount} {t.depositCount === 1 ? 'person' : 'people'} deposited</span>
                  <span style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#63d2ff', fontFamily: 'monospace' }}>{nativeFmt(t.amount, t.country)}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total · {grandCount} {grandCount === 1 ? 'person' : 'people'} deposited</span>
            </div>
          </div>

          {/* Per-period breakdown — actual figures, no chart. Each country chip
              also uses nativeFmt so e.g. Nigeria always reads in ₦, not GH₵. */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 8, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>By Period</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {periods.map((p) => {
              const periodRows = rows.filter((r) => r.periodLabel === p).sort((a, b) => b.amount - a.amount);
              const periodCount = periodRows.reduce((s, r) => s + r.depositCount, 0);
              return (
                <div key={p} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{p}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{periodCount} {periodCount === 1 ? 'person' : 'people'}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {periodRows.map((r) => {
                      const meta = countryMeta(r.country);
                      return (
                        <span key={r.country} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)' }}>
                          {meta.flag} {meta.name}: <strong style={{ color: '#63d2ff' }}>{nativeFmt(r.amount, r.country)}</strong> ({r.depositCount} {r.depositCount === 1 ? 'person' : 'people'})
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const REGISTRY_BY_CODE: Record<string, { code: string; symbol: string; name: string }> = {
  ..._LEGACY_COUNTRY_CURRENCY,
  ...Object.fromEntries(
    REGISTRY_COUNTRIES.map((c) => [
      c.code,
      { code: c.currency, symbol: c.symbol, name: c.currencyName },
    ]),
  ),
};

const DEFAULT_CURRENCY: CurrencyInfo = {
  code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi',
  countryCode: 'GH', rateFromGhs: 1,
};

/* The three-provider IP lookup plus two FX endpoints that used to sit here are
   gone — same reasoning as everywhere else in the app: it contradicted the
   registered country and blocked the panel on up to five network calls. The
   admin panel now reads the operator's registered country via useCountry().
   `rateFromGhs` is pinned to 1 (parity rule) so fmt() below needs no change. */

function fmt(amountInGhs: number, currency: CurrencyInfo = DEFAULT_CURRENCY): string {
  const converted = amountInGhs * currency.rateFromGhs;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: currency.code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(converted);
  } catch {
    return `${currency.symbol}${converted.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function useCurrency(): { currency: CurrencyInfo; currencyReady: boolean } {
  const { country: adminCountry } = useCountry();
  const currency: CurrencyInfo = useMemo(() => ({
    code: adminCountry.currency, symbol: adminCountry.symbol,
    name: adminCountry.currencyName, countryCode: adminCountry.code,
    rateFromGhs: 1,
  }), [adminCountry]);
  const currencyReady = true;
  return { currency, currencyReady };
}

const REFERRAL_DEPOSIT_DEDUCTION_GHS = 0;
function referralDeposit(lifetimeStakeGhs: number): number {
  return Math.max(0, lifetimeStakeGhs - REFERRAL_DEPOSIT_DEDUCTION_GHS);
}

// ─── Booking Code Constants ───────────────────────────────────────────────────

const MARKETS = [
  { value: '1X2',           label: '1X2 Match Result',    picks: ['Home Win', 'Draw', 'Away Win'] },
  { value: 'WIN_ONLY',      label: 'Home / Away Win',     picks: ['Home Win', 'Away Win'] },
  { value: 'BTTS',          label: 'Both Teams To Score', picks: ['Yes', 'No'] },
  { value: 'OVER_UNDER',    label: 'Over / Under',        picks: ['Over', 'Under'], hasLine: true },
  { value: 'HANDICAP',      label: 'Handicap',            picks: [], hasHandicap: true },
  { value: 'CORRECT_SCORE', label: 'Correct Score',       picks: [], hasScore: true },
  { value: 'HT_FT',         label: 'HT / FT',             picks: [], hasHtFt: true },
] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  active:  { bg: '#22c55e22', text: '#22c55e', dot: '#22c55e' },
  expired: { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.4)', dot: 'rgba(255,255,255,0.25)' },
  void:    { bg: '#ef444422', text: '#ef4444', dot: '#ef4444' },
  settled: { bg: '#3b82f622', text: '#3b82f6', dot: '#3b82f6' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtKickoff(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtTimeAgo(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  if (abs < 3_600_000) return `${Math.round(abs / 60000)}m`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h`;
  return `${Math.round(abs / 86_400_000)}d`;
}

function normalise<T>(raw: unknown): { success: boolean; data: T } {
  if (raw === null || raw === undefined) return { success: false, data: [] as unknown as T };
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if ('success' in obj) return { success: Boolean(obj.success), data: obj.data as T };
    return { success: true, data: raw as T };
  }
  if (Array.isArray(raw)) return { success: true, data: raw as unknown as T };
  return { success: false, data: [] as unknown as T };
}

function isExpired(expiresAt?: string | null) {
  return expiresAt && new Date(expiresAt) < new Date();
}

function bookingTypeConfig(typeId: string) {
  return BOOKING_TYPES.find(t => t.id === typeId) ?? BOOKING_TYPES[0];
}

function deriveKind(selections: any[]) {
  if (!selections?.length) return '1X2';
  if (selections.length === 1) return selections[0].market;
  const markets = new Set(selections.map((s: any) => s.market));
  return markets.size === 1 ? selections[0].market : 'MIXED';
}

// ─── Match status config ──────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; border: string; text: string; pulse?: boolean }> = {
  SCHEDULED:   { label: 'Scheduled', dot: '#3b82f6', bg: 'rgba(59, 130, 246,0.08)',  border: 'rgba(59, 130, 246,0.25)',  text: '#60a5fa' },
  LIVE:        { label: 'Live',       dot: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.3)',   text: '#86efac', pulse: true },
  HALF_TIME:   { label: 'Half Time', dot: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  text: '#fcd34d' },
  SECOND_HALF: { label: '2nd Half',  dot: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.25)',  text: '#fdba74', pulse: true },
  FINISHED:    { label: 'Full Time', dot: 'rgba(255,255,255,0.2)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.25)' },
};

const NEXT_STATUSES: Record<string, string[]> = {
  SCHEDULED:   ['LIVE'],
  LIVE:        ['HALF_TIME', 'FINISHED'],
  HALF_TIME:   ['SECOND_HALF'],
  SECOND_HALF: ['FINISHED'],
  FINISHED:    [],
};

const MATCH_TABS = ['ALL', 'SCHEDULED', 'LIVE', 'FINISHED'] as const;
type MatchTab = typeof MATCH_TABS[number];

const CLOCK_FIRST_HALF_MIN  = 22;
const CLOCK_BREAK_MIN       = 5;
const CLOCK_SECOND_HALF_MIN = 22;

function useMatchClock(match: Match) {
  const status = match.status ?? 'SCHEDULED';
  const isLive = ['LIVE', 'HALF_TIME', 'SECOND_HALF'].includes(status);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLive) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [isLive]);

  const kickoffMs = match.kickoffAt ? new Date(match.kickoffAt).getTime() : null;
  let minute = match.minutePlayed ?? 0;

  if (kickoffMs != null && !isNaN(kickoffMs)) {
    const elapsedMin = Math.max(0, Math.floor((now - kickoffMs) / 60000));
    if (status === 'LIVE') {
      minute = Math.min(elapsedMin, CLOCK_FIRST_HALF_MIN);
    } else if (status === 'HALF_TIME') {
      minute = CLOCK_FIRST_HALF_MIN;
    } else if (status === 'SECOND_HALF') {
      const secondHalfElapsed = Math.max(0, elapsedMin - (CLOCK_FIRST_HALF_MIN + CLOCK_BREAK_MIN));
      minute = CLOCK_FIRST_HALF_MIN + Math.min(secondHalfElapsed, CLOCK_SECOND_HALF_MIN);
    } else if (status === 'FINISHED') {
      minute = CLOCK_FIRST_HALF_MIN + CLOCK_SECOND_HALF_MIN;
    }
  }

  return { minute, isHalfTime: status === 'HALF_TIME', isFullTime: status === 'FINISHED' };
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status];
  if (cfg) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 9, fontWeight: 800, color: cfg.text, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
        {cfg.label}
      </span>
    );
  }
  const map: Record<string, string> = {
    PENDING: 'bg-amber-900/30 text-amber-400', APPROVED: 'bg-emerald-900/30 text-emerald-400',
    REJECTED: 'bg-red-900/30 text-red-400', CLOSED: 'bg-slate-700 text-slate-400',
    SETTLED: 'bg-blue-900/30 text-blue-400', PAID: 'bg-emerald-900/30 text-emerald-400',
    REQUESTED: 'bg-amber-900/30 text-amber-400', active: 'bg-emerald-900/30 text-emerald-400',
    suspended: 'bg-red-900/30 text-red-400', COMMISSION_SET: 'bg-emerald-900/30 text-emerald-400',
    PENDING_COMMISSION: 'bg-amber-900/30 text-amber-400', PROCESSED: 'bg-emerald-900/30 text-emerald-400',
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${map[status] ?? 'bg-slate-700 text-slate-300'}`}>{status.replace(/_/g, ' ')}</span>;
}

function Spinner() { return <CircularProgress fontSize="small" className="animate-spin text-primary" />; }

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-slate-600 mb-3">{icon}</span>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-red-900/20 border border-red-800/40 flex items-center justify-center text-red-400 text-lg">!</div>
      <p className="text-sm text-red-400 max-w-xs">{text}</p>
      {onRetry && <button onClick={onRetry} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 transition-colors">Try Again</button>}
    </div>
  );
}

// ─── Logo & League inputs ─────────────────────────────────────────────────────

const LEAGUE_SUGGESTIONS = [
  'Premier League','La Liga','Serie A','Bundesliga','Ligue 1','Champions League',
  'Europa League','FA Cup','Carabao Cup','Copa del Rey','DFB Pokal','Coppa Italia',
  'MLS','Eredivisie','Primeira Liga','Scottish Premiership','Super Lig','Brasileirão',
  'Argentine Primera','Ghana Premier League','CAF Champions League','AFCON',
  'World Cup','Euro 2024','Nations League','Africa Cup','SpeedBet Special','SpeedBet Invitational','Friendly',
];

function LogoInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>('url');
  const handleFile = (file: File) => { if (!file || !file.type.startsWith('image/')) return; onChange(URL.createObjectURL(file)); };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['url', 'upload'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, border: '1px solid', borderColor: mode === m ? 'rgba(99,210,255,0.5)' : 'rgba(255,255,255,0.1)', background: mode === m ? 'rgba(99,210,255,0.1)' : 'transparent', color: mode === m ? '#63d2ff' : 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
              {m === 'upload' ? '📁 Upload' : '🔗 URL'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0, background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {value ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <span style={{ fontSize: 18, opacity: 0.3 }}>🏟️</span>}
        </div>
        <div style={{ flex: 1 }}>
          {mode === 'upload' ? (
            <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()} style={{ border: `1.5px dashed ${dragging ? '#63d2ff' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', background: dragging ? 'rgba(99,210,255,0.05)' : 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: dragging ? '#63d2ff' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{dragging ? 'Drop it!' : 'Click or drag image here'}</span>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          ) : (
            <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://example.com/logo.png" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => (e.target.style.borderColor = 'rgba(99,210,255,0.5)')} onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
          )}
        </div>
        {value && <button type="button" onClick={() => onChange('')} style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff4757', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>}
      </div>
    </div>
  );
}

function LeagueInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const filtered = LEAGUE_SUGGESTIONS.filter((l) => l.toLowerCase().includes(value.toLowerCase()) && l !== value).slice(0, 8);
  const showDropdown = focused && (value.length === 0 || filtered.length > 0);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>League</div>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} placeholder="Premier League, La Liga…" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${focused ? 'rgba(99,210,255,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      <AnimatePresence>
        {showDropdown && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, background: '#13131f', border: '1.5px solid rgba(99,210,255,0.2)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
            {(value.length === 0 ? LEAGUE_SUGGESTIONS.slice(0, 8) : filtered).map((l) => (
              <button key={l} type="button" onMouseDown={() => { onChange(l); setFocused(false); }} style={{ width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,210,255,0.08)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                {l.includes('SpeedBet') ? `⚡ ${l}` : (l.includes('World') || l.includes('AFCON') || l.includes('Nations') || l.includes('Euro') || l.includes('Africa')) ? `🌍 ${l}` : `🏆 ${l}`}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Create Match Modal ───────────────────────────────────────────────────────

const BLANK_FORM = { homeTeam: '', awayTeam: '', league: '', sport: 'football', homeLogo: '', awayLogo: '', leagueLogo: '', kickoffDate: '', kickoffTime: '', status: 'SCHEDULED', featured: false };
const STATUS_OPTIONS_CREATE = ['SCHEDULED', 'LIVE', 'HALF_TIME', 'SECOND_HALF'];

function CreateMatchModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: Match) => void }) {
  const { showToast } = useAppStore();
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }));
  const canNext = form.homeTeam.trim() && form.awayTeam.trim();

  const create = async () => {
    if (!canNext) { setError('Home and away team names are required.'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = { homeTeam: form.homeTeam.trim(), awayTeam: form.awayTeam.trim(), league: form.league?.trim() || undefined, sport: form.sport || 'football', homeLogo: form.homeLogo?.trim() || undefined, awayLogo: form.awayLogo?.trim() || undefined, leagueLogo: form.leagueLogo?.trim() || undefined, status: form.status || 'SCHEDULED', featured: form.featured };
      if (form.kickoffDate && form.kickoffTime) payload.kickoffAt = new Date(`${form.kickoffDate}T${form.kickoffTime}:00`).toISOString();
      else if (form.kickoffDate) payload.kickoffAt = new Date(`${form.kickoffDate}T00:00:00`).toISOString();
      const raw = await adminMatches.create(payload as unknown as Parameters<typeof adminMatches.create>[0]);
      const res = normalise<Match>(raw);
      if (res.success && res.data) { showToast('Match created!', 'success'); onCreated(res.data); onClose(); }
      else setError('Failed to create match — unexpected response.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to create match'); }
    finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(160deg, #0f0f1a 0%, #13131f 60%, #0d0d18 100%)', border: '1.5px solid rgba(99,210,255,0.15)', borderRadius: 18, boxShadow: '0 32px 80px rgba(0,0,0,0.9)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#63d2ff', marginBottom: 4 }}>⚡ Match Manager</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>{step === 1 ? 'Teams & Logos' : 'Details & Schedule'}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>{[1, 2].map((s) => <div key={s} style={{ width: s === step ? 20 : 6, height: 6, borderRadius: 3, background: s === step ? '#63d2ff' : s < step ? 'rgba(99,210,255,0.4)' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s' }} />)}</div>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CloseIcon style={{ fontSize: 16 }} /></button>
            </div>
          </div>
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div key="s1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    {[{ team: form.homeTeam, logo: form.homeLogo, color: '#63d2ff' }, { team: form.awayTeam, logo: form.awayLogo, color: '#ff4757' }].reduce<React.ReactNode[]>((acc, item, i) => {
                      if (i === 1) acc.push(<div key="vs" style={{ fontSize: 18, fontWeight: 900, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>VS</div>);
                      acc.push(<div key={i} style={{ textAlign: 'center', flex: 1 }}>{item.logo ? <img src={item.logo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', margin: '0 auto 6px', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div style={{ width: 40, height: 40, borderRadius: '50%', margin: '0 auto 6px', background: `${item.color}1a`, border: `1.5px solid ${item.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: item.color }}>{item.team ? item.team.slice(0, 3).toUpperCase() : '?'}</div>}<div style={{ fontSize: 12, fontWeight: 700, color: item.team ? '#fff' : 'rgba(255,255,255,0.2)' }}>{item.team || (i === 0 ? 'Home' : 'Away')}</div></div>);
                      return acc;
                    }, [])}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['homeTeam', 'Home Team *', 'Man City'], ['awayTeam', 'Away Team *', 'Arsenal']].map(([k, label, ph]) => (
                      <div key={k}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</div><input type="text" value={(form as Record<string, unknown>)[k] as string} onChange={(e) => set(k, e.target.value)} placeholder={ph} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => (e.target.style.borderColor = 'rgba(99,210,255,0.5)')} onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} /></div>
                    ))}
                  </div>
                  <LogoInput label="Home Team Logo" value={form.homeLogo} onChange={(v) => set('homeLogo', v)} />
                  <LogoInput label="Away Team Logo" value={form.awayLogo} onChange={(v) => set('awayLogo', v)} />
                </motion.div>
              ) : (
                <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <LeagueInput value={form.league} onChange={(v) => set('league', v)} />
                  <LogoInput label="League Logo (optional)" value={form.leagueLogo} onChange={(v) => set('leagueLogo', v)} />
                  <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Sport</div><select value={form.sport} onChange={(e) => set('sport', e.target.value)} style={{ width: '100%', background: '#1a1a2e', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer', boxSizing: 'border-box', appearance: 'none' }}><option value="football">⚽ Football</option><option value="basketball">🏀 Basketball</option><option value="tennis">🎾 Tennis</option><option value="rugby">🏉 Rugby</option><option value="cricket">🏏 Cricket</option><option value="other">🎯 Other</option></select></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['kickoffDate', 'Kickoff Date', 'date'], ['kickoffTime', 'Kickoff Time', 'time']].map(([k, label, type]) => (
                      <div key={k}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</div><input type={type} value={(form as Record<string, unknown>)[k] as string} onChange={(e) => set(k, e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} onFocus={(e) => (e.target.style.borderColor = 'rgba(99,210,255,0.5)')} onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} /></div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Initial Status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                      {STATUS_OPTIONS_CREATE.map((s) => { const cfg = STATUS_CFG[s]; const selected = form.status === s; return <button key={s} type="button" onClick={() => set('status', s)} style={{ padding: '9px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${selected ? cfg.border : 'rgba(255,255,255,0.08)'}`, background: selected ? cfg.bg : 'transparent', color: selected ? cfg.text : 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: selected ? cfg.dot : 'rgba(255,255,255,0.15)', flexShrink: 0 }} />{cfg.label}</button>; })}
                    </div>
                  </div>
                  <button type="button" onClick={() => set('featured', !form.featured)} style={{ padding: '12px 16px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.featured ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`, background: form.featured ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ textAlign: 'left' }}><div style={{ fontSize: 12, fontWeight: 700, color: form.featured ? '#fbbf24' : 'rgba(255,255,255,0.6)', marginBottom: 2 }}>⭐ Feature in hero carousel</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Show this match on the homepage</div></div>
                    <div style={{ width: 40, height: 22, borderRadius: 11, background: form.featured ? '#fbbf24' : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}><div style={{ position: 'absolute', top: 3, left: form.featured ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} /></div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div style={{ padding: '14px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, flexShrink: 0 }}>
            {error ? (
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', fontSize: 11, color: '#ff6b7a', fontWeight: 600 }}>
                {error}<button style={{ marginLeft: 8, textDecoration: 'underline', opacity: 0.7, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}>Dismiss</button>
              </div>
            ) : (
              <>
                {step === 2 && <button onClick={() => setStep(1)} style={{ padding: '10px 20px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>← Back</button>}
                <button onClick={step === 1 ? () => { if (canNext) { setError(''); setStep(2); } else setError('Team names are required.'); } : create} disabled={saving} style={{ flex: 1, padding: '12px 20px', borderRadius: 9, background: saving ? 'rgba(99,210,255,0.2)' : 'linear-gradient(135deg, #63d2ff, #3891ff)', border: 'none', color: saving ? 'rgba(255,255,255,0.5)' : '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', boxShadow: saving ? 'none' : '0 4px 20px rgba(99,210,255,0.3)' }}>{saving ? 'Creating…' : step === 1 ? 'Next: Details →' : '✓ Create Match'}</button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Create Auto-Scheduled Match Modal ─────────────────────────────────────────

const BLANK_AUTO_FORM = {
  homeTeam: '', awayTeam: '', league: '', sport: 'football',
  homeLogo: '', awayLogo: '', leagueLogo: '',
  kickoffDate: '', kickoffTime: '',
  finalScoreHome: '0', finalScoreAway: '0',
  featured: false,
};

function CreateAutoMatchModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: Match) => void }) {
  const { showToast } = useAppStore();
  const [form, setForm] = useState(BLANK_AUTO_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }));
  const canNext = form.homeTeam.trim() && form.awayTeam.trim();
  const canSubmit = canNext && form.kickoffDate && form.kickoffTime;

  const create = async () => {
    if (!canSubmit) { setError('Team names and a kickoff date/time are required.'); return; }
    const fh = parseInt(form.finalScoreHome, 10);
    const fa = parseInt(form.finalScoreAway, 10);
    if (isNaN(fh) || isNaN(fa) || fh < 0 || fa < 0) { setError('Final score must be non-negative numbers.'); return; }
    setSaving(true); setError('');
    try {
      const payload: AutoMatchScheduleRequest = {
        homeTeam: form.homeTeam.trim(),
        awayTeam: form.awayTeam.trim(),
        league: form.league?.trim() || undefined,
        sport: form.sport || 'football',
        homeLogo: form.homeLogo?.trim() || undefined,
        awayLogo: form.awayLogo?.trim() || undefined,
        leagueLogo: form.leagueLogo?.trim() || undefined,
        featured: form.featured,
        kickoffAt: new Date(`${form.kickoffDate}T${form.kickoffTime}:00`).toISOString(),
        finalScoreHome: fh,
        finalScoreAway: fa,
      };
      const created = await adminMatchScheduleApi.create(payload);
      showToast('Auto match scheduled! Kickoff → goals → full time will run automatically.', 'success');
      onCreated(created);
      onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to schedule match'); }
    finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(160deg, #1a1306 0%, #13131f 60%, #0d0d18 100%)', border: '1.5px solid rgba(251,191,36,0.25)', borderRadius: 18, boxShadow: '0 32px 80px rgba(0,0,0,0.9)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 4 }}><BoltIcon style={{ fontSize: 13 }} /> Auto-Schedule Match</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>{step === 1 ? 'Teams & Logos' : 'Kickoff & Final Score'}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>{[1, 2].map((s) => <div key={s} style={{ width: s === step ? 20 : 6, height: 6, borderRadius: 3, background: s === step ? '#fbbf24' : s < step ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s' }} />)}</div>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CloseIcon style={{ fontSize: 16 }} /></button>
            </div>
          </div>
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div key="s1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11, color: '#fcd34d', lineHeight: 1.5 }}>
                    You only pick teams, kickoff time, and the final score. SpeedBet runs kickoff, random goal timings, half-time, second half, and full time automatically — odds refresh at every step exactly like a real live match.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['homeTeam', 'Home Team *', 'Man City'], ['awayTeam', 'Away Team *', 'Arsenal']].map(([k, label, ph]) => (
                      <div key={k}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</div><input type="text" value={(form as Record<string, unknown>)[k] as string} onChange={(e) => set(k, e.target.value)} placeholder={ph} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => (e.target.style.borderColor = 'rgba(251,191,36,0.5)')} onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} /></div>
                    ))}
                  </div>
                  <LogoInput label="Home Team Logo" value={form.homeLogo} onChange={(v) => set('homeLogo', v)} />
                  <LogoInput label="Away Team Logo" value={form.awayLogo} onChange={(v) => set('awayLogo', v)} />
                  <LeagueInput value={form.league} onChange={(v) => set('league', v)} />
                  <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Sport</div><select value={form.sport} onChange={(e) => set('sport', e.target.value)} style={{ width: '100%', background: '#1a1a2e', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer', boxSizing: 'border-box', appearance: 'none' }}><option value="football">⚽ Football</option><option value="basketball">🏀 Basketball</option><option value="tennis">🎾 Tennis</option><option value="rugby">🏉 Rugby</option><option value="cricket">🏏 Cricket</option><option value="other">🎯 Other</option></select></div>
                </motion.div>
              ) : (
                <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['kickoffDate', 'Kickoff Date *', 'date'], ['kickoffTime', 'Kickoff Time *', 'time']].map(([k, label, type]) => (
                      <div key={k}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</div><input type={type} value={(form as Record<string, unknown>)[k] as string} onChange={(e) => set(k, e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} onFocus={(e) => (e.target.style.borderColor = 'rgba(251,191,36,0.5)')} onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} /></div>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12, textAlign: 'center' }}>Final Score (goals will be spread at random minutes)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {[{ team: form.homeTeam || 'Home', key: 'finalScoreHome', borderColor: 'rgba(251,191,36,0.35)' }, { team: form.awayTeam || 'Away', key: 'finalScoreAway', borderColor: 'rgba(255,71,87,0.3)' }].reduce<React.ReactNode[]>((acc, item, i) => {
                        if (i === 1) acc.push(<div key="sep" style={{ fontSize: 24, color: 'rgba(255,255,255,0.2)', fontWeight: 900, flexShrink: 0 }}>–</div>);
                        acc.push(<div key={item.key} style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.team}</div><input type="number" min={0} value={(form as Record<string, unknown>)[item.key] as string} onChange={(e) => set(item.key, e.target.value)} style={{ width: '100%', textAlign: 'center', fontSize: 32, fontWeight: 900, fontFamily: 'monospace', color: '#fff', background: 'rgba(255,255,255,0.06)', border: `2px solid ${item.borderColor}`, borderRadius: 10, padding: '8px 4px', outline: 'none', boxSizing: 'border-box' }} /></div>);
                        return acc;
                      }, [])}
                    </div>
                  </div>
                  <button type="button" onClick={() => set('featured', !form.featured)} style={{ padding: '12px 16px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.featured ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`, background: form.featured ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ textAlign: 'left' }}><div style={{ fontSize: 12, fontWeight: 700, color: form.featured ? '#fbbf24' : 'rgba(255,255,255,0.6)', marginBottom: 2 }}>⭐ Feature in hero carousel</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Show this match on the homepage</div></div>
                    <div style={{ width: 40, height: 22, borderRadius: 11, background: form.featured ? '#fbbf24' : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}><div style={{ position: 'absolute', top: 3, left: form.featured ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} /></div>
                  </button>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                    Timeline once created: kickoff → <strong style={{ color: 'rgba(255,255,255,0.55)' }}>+22m</strong> half time → <strong style={{ color: 'rgba(255,255,255,0.55)' }}>+27m</strong> second half → <strong style={{ color: 'rgba(255,255,255,0.55)' }}>+49m</strong> full time.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div style={{ padding: '14px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, flexShrink: 0 }}>
            {error ? (
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', fontSize: 11, color: '#ff6b7a', fontWeight: 600 }}>
                {error}<button style={{ marginLeft: 8, textDecoration: 'underline', opacity: 0.7, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}>Dismiss</button>
              </div>
            ) : (
              <>
                {step === 2 && <button onClick={() => setStep(1)} style={{ padding: '10px 20px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>← Back</button>}
                <button onClick={step === 1 ? () => { if (canNext) { setError(''); setStep(2); } else setError('Team names are required.'); } : create} disabled={saving} style={{ flex: 1, padding: '12px 20px', borderRadius: 9, background: saving ? 'rgba(251,191,36,0.2)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: 'none', color: saving ? 'rgba(255,255,255,0.5)' : '#1a1306', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', boxShadow: saving ? 'none' : '0 4px 20px rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{saving ? 'Scheduling…' : step === 1 ? 'Next: Kickoff & Score →' : <><BoltIcon style={{ fontSize: 16 }} /> Schedule Match</>}</button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Auto Schedule View Modal ──────────────────────────────────────────────────

function AutoScheduleModal({ match, onClose, onCancelled }: { match: Match; onClose: () => void; onCancelled: (matchId: string) => void }) {
  const { showToast } = useAppStore();
  const [schedule, setSchedule] = useState<AutoMatchSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await adminMatchScheduleApi.getSchedule(match.id); setSchedule(data); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load schedule'); }
    finally { setLoading(false); }
  }, [match.id]);

  useEffect(() => { load(); }, [load]);

  const cancelAutomation = async () => {
    setCancelling(true);
    try {
      const res = await adminMatchScheduleApi.cancelSchedule(match.id);
      showToast(`Automation cancelled — ${res.jobsCancelled} pending job(s) removed.`, 'success');
      onCancelled(match.id);
      onClose();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed to cancel automation', 'error'); }
    finally { setCancelling(false); }
  };

  const goals = schedule?.goals ?? [];

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(160deg, #1a1306, #13131f)', border: '1.5px solid rgba(251,191,36,0.25)', borderRadius: 18, padding: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.8)', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
            <div><div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 4 }}><EventRepeatIcon style={{ fontSize: 13 }} /> Auto Schedule</div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>{match.homeTeam} vs {match.awayTeam}</h3></div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map((i) => <div key={i} style={{ height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />)}</div>
            ) : error ? (
              <ErrorState text={error} onRetry={load} />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Kickoff',     value: schedule?.kickoffAt },
                    { label: 'Half Time',   value: schedule?.halfTimeAt },
                    { label: 'Second Half', value: schedule?.secondHalfAt },
                    { label: 'Full Time',   value: schedule?.finishAt },
                  ].map((row) => (
                    <div key={row.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#fff' }}>{fmtKickoff(row.value as string | undefined)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Goal Plan ({goals.length})</div>
                {goals.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', borderRadius: 10, border: '1.5px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 16 }}>0–0 — no goals scheduled.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {goals.map((g, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: '#fbbf24', width: 30, flexShrink: 0 }}>{g.minute}'</span>
                        <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{g.scorer === 'HOME' ? match.homeTeam : match.awayTeam} scores</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{g.scoreHome}–{g.scoreAway}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div style={{ flexShrink: 0, paddingTop: 12 }}>
            <button onClick={cancelAutomation} disabled={cancelling || loading || !!error} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid rgba(255,71,87,0.3)', background: cancelling ? 'rgba(255,71,87,0.08)' : 'rgba(255,71,87,0.12)', color: '#ff6b7a', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: cancelling || loading || !!error ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.6 : 1 }}>{cancelling ? 'Cancelling…' : 'Cancel Remaining Automation'}</button>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>Match stays at its current status/score. Use Score / Status buttons afterward to take over manually.</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Score Modal ──────────────────────────────────────────────────────────────

function ScoreModal({ match, onClose, onSaved }: { match: Match; onClose: () => void; onSaved: (m: Match) => void }) {
  const { showToast } = useAppStore();
  const [home, setHome] = useState(String(match.scoreHome ?? 0));
  const [away, setAway] = useState(String(match.scoreAway ?? 0));
  const [minute, setMinute] = useState(String(match.minutePlayed ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const h = parseInt(home, 10), a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { setError('Scores must be non-negative.'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = { scoreHome: h, scoreAway: a };
      if (minute.trim()) payload.minutePlayed = parseInt(minute, 10);
      const raw = await adminMatches.updateScore(match.id, payload as unknown as Parameters<typeof adminMatches.updateScore>[1]);
      const res = normalise<Match>(raw);
      if (res.success && res.data) { showToast(`Score updated: ${res.data.scoreHome}–${res.data.scoreAway}`, 'success'); onSaved(res.data); onClose(); }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to update score'); }
    finally { setSaving(false); }
  };
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} style={{ width: '100%', maxWidth: 380, background: 'linear-gradient(160deg, #0f0f1a, #13131f)', border: '1.5px solid rgba(74,222,128,0.2)', borderRadius: 18, padding: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 4 }}>🟢 Live Score</div><h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>Update Score</h3></div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '20px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {[{ team: match.homeTeam, borderColor: 'rgba(99,210,255,0.3)', value: home, onChange: setHome }, { team: match.awayTeam, borderColor: 'rgba(255,71,87,0.3)', value: away, onChange: setAway }].reduce<React.ReactNode[]>((acc, item, i) => {
                if (i === 1) acc.push(<div key="sep" style={{ fontSize: 24, color: 'rgba(255,255,255,0.2)', fontWeight: 900, flexShrink: 0 }}>–</div>);
                acc.push(<div key={String(i)} style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.team}</div><input type="number" min={0} value={item.value} onChange={(e) => item.onChange(e.target.value)} style={{ width: '100%', textAlign: 'center', fontSize: 36, fontWeight: 900, fontFamily: 'monospace', color: '#fff', background: 'rgba(255,255,255,0.06)', border: `2px solid ${item.borderColor}`, borderRadius: 10, padding: '8px 4px', outline: 'none', boxSizing: 'border-box' }} /></div>);
                return acc;
              }, [])}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Minute (optional)</div><input type="number" min={1} max={120} value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="e.g. 67" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} /></div>
          {error && <p style={{ color: '#f87171', fontSize: 11, marginBottom: 12 }}>{error}</p>}
          <button onClick={save} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: saving ? 'rgba(74,222,128,0.2)' : 'linear-gradient(135deg, #4ade80, #22c55e)', color: saving ? 'rgba(255,255,255,0.4)' : '#000', fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 20px rgba(74,222,128,0.3)' }}>{saving ? 'Saving…' : '✓ Save Score'}</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Status Modal ─────────────────────────────────────────────────────────────

function StatusTransitionModal({ match, onClose, onSaved }: { match: Match; onClose: () => void; onSaved: (m: Match) => void }) {
  const { showToast } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const next = NEXT_STATUSES[match.status ?? 'SCHEDULED'] ?? [];
  const cfg = STATUS_CFG[match.status ?? 'SCHEDULED'] ?? STATUS_CFG.SCHEDULED;
  const transition = async (target: string) => {
    setSaving(true); setError('');
    try {
      const raw = await adminMatches.updateStatus(match.id, { status: target });
      const res = normalise<Match>(raw);
      if (res.success && res.data) { showToast(`Status → ${STATUS_CFG[target]?.label ?? target}`, 'success'); onSaved(res.data); onClose(); }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Transition failed'); setSaving(false); }
  };
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} style={{ width: '100%', maxWidth: 360, background: 'linear-gradient(160deg, #0f0f1a, #13131f)', border: `1.5px solid ${cfg.border}`, borderRadius: 18, padding: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: cfg.text, marginBottom: 4 }}>Match Status</div><h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>{match.homeTeam} vs {match.awayTeam}</h3></div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99, background: cfg.bg, border: `1.5px solid ${cfg.border}`, marginBottom: 20 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} /><span style={{ fontSize: 12, fontWeight: 800, color: cfg.text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{cfg.label}</span>
          </div>
          {next.length === 0 ? <div style={{ textAlign: 'center', padding: '20px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}><div style={{ fontSize: 24, marginBottom: 8 }}>🏁</div><p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Match is finished — no further transitions.</p></div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Move to →</div>{next.map((s) => { const tc = STATUS_CFG[s] ?? STATUS_CFG.SCHEDULED; return <button key={s} onClick={() => transition(s)} disabled={saving} style={{ padding: '13px 16px', borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer', border: `1.5px solid ${tc.border}`, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: saving ? 0.5 : 1, transition: 'all 0.15s' }} onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = saving ? '0.5' : '1'; }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: tc.dot, flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 800, color: tc.text, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{tc.label}</span></div><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{s === 'FINISHED' ? 'End match' : 'Continue →'}</span></button>; })}</div>}
          {error && <p style={{ color: '#f87171', fontSize: 11, marginTop: 12 }}>{error}</p>}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ match, index, isAuto, onScoreClick, onStatusClick, onHide, onScheduleClick }: { match: Match; index: number; isAuto: boolean; onScoreClick: (m: Match) => void; onStatusClick: (m: Match) => void; onHide: (id: string) => void; onScheduleClick: (m: Match) => void }) {
  const isLive     = ['LIVE', 'HALF_TIME', 'SECOND_HALF'].includes(match.status ?? '');
  const isFinished = match.status === 'FINISHED';
  const cfg        = STATUS_CFG[match.status ?? 'SCHEDULED'] ?? STATUS_CFG.SCHEDULED;
  const hasScore   = match.scoreHome != null && match.scoreAway != null;
  const { minute, isHalfTime } = useMatchClock(match);
  const statusLabel = isHalfTime ? 'HT' : isFinished ? 'FT' : isLive ? `${minute}'` : cfg.label;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 28 }} style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: `1.5px solid ${isAuto ? 'rgba(251,191,36,0.3)' : isLive ? cfg.border : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: isLive ? `0 0 24px ${cfg.bg}` : '0 4px 16px rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden' }}>
      {isLive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${cfg.dot}, transparent)`, opacity: 0.8 }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, background: cfg.bg, border: `1px solid ${cfg.border}` }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0, boxShadow: cfg.pulse ? `0 0 6px ${cfg.dot}` : 'none' }} /><span style={{ fontSize: 9, fontWeight: 800, color: cfg.text, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{statusLabel}</span></div>
          {isAuto && <span title="Auto-scheduled — running unattended" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 7px', borderRadius: 99, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}><BoltIcon style={{ fontSize: 10, color: '#fbbf24' }} /><span style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Auto</span></span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isLive && !isHalfTime && !isFinished && <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0, boxShadow: `0 0 6px ${cfg.dot}88` }} />}
          <button onClick={() => onHide(match.id)} title="Hide match" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(255,71,87,0.25)', background: 'rgba(255,71,87,0.08)', color: 'rgba(255,71,87,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.22)'; (e.currentTarget as HTMLButtonElement).style.color = '#ff4757'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,71,87,0.6)'; }}><DeleteIcon style={{ fontSize: 13 }} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[{ name: match.homeTeam, logo: match.homeLogo, score: match.scoreHome, winning: hasScore && (match.scoreHome ?? 0) > (match.scoreAway ?? 0) }, { name: match.awayTeam, logo: match.awayLogo, score: match.scoreAway, winning: hasScore && (match.scoreAway ?? 0) > (match.scoreHome ?? 0) }].map(({ name, logo, score, winning }, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{logo ? <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <span style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>{(name ?? '?').slice(0, 3).toUpperCase()}</span>}</div>
            <span style={{ flex: 1, fontSize: 12, fontWeight: winning ? 700 : 500, color: winning ? '#fff' : 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {hasScore && <span style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: isLive ? cfg.text : (winning ? '#fff' : 'rgba(255,255,255,0.5)'), flexShrink: 0, minWidth: 16, textAlign: 'right' }}>{score}</span>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {match.league && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏆 {match.league}</span>}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}>{fmtKickoff(match.kickoffAt)}</span>
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 'auto' }}>
        {isAuto ? (
          <button onClick={() => onScheduleClick(match)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><EventRepeatIcon style={{ fontSize: 12 }} /> Schedule</button>
        ) : (
          <button onClick={() => onScoreClick(match)} disabled={!isLive} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${isLive ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)'}`, background: isLive ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)', color: isLive ? '#4ade80' : 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: isLive ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>⚽ Score</button>
        )}
        <button onClick={() => onStatusClick(match)} disabled={isFinished} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${isFinished ? 'rgba(255,255,255,0.04)' : 'rgba(99,210,255,0.2)'}`, background: isFinished ? 'rgba(255,255,255,0.02)' : 'rgba(99,210,255,0.1)', color: isFinished ? 'rgba(255,255,255,0.15)' : '#63d2ff', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: isFinished ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>⚡ Status</button>
      </div>
    </motion.div>
  );
}

// ─── Section: Matches ─────────────────────────────────────────────────────────

function MatchesSection() {
  const [list, setList]           = useState<Match[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAutoCreate, setShowAutoCreate] = useState(false);
  const [scoreTarget, setScoreTarget]   = useState<Match | null>(null);
  const [statusTarget, setStatusTarget] = useState<Match | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Match | null>(null);
  const [autoMatchIds, setAutoMatchIds] = useState<Set<string>>(new Set());
  const [filter, setFilter]       = useState<MatchTab>('ALL');

  const loadMatches = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const raw = await adminMatches.list();
      const res = normalise<Match[]>(raw);
      if (res.success) setList(Array.isArray(res.data) ? res.data : []);
      else setFetchError('Server returned an unexpected response.');
    } catch (err: unknown) { setFetchError(err instanceof Error ? err.message : 'Network error — could not load matches.'); }
    finally { setLoading(false); }
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const raw = await adminMatches.list();
      const res = normalise<Match[]>(raw);
      if (res.success && Array.isArray(res.data)) setList(res.data);
    } catch { /* keep showing last-known data; next poll tick will retry */ }
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  useEffect(() => {
    const hasActiveMatch = list.some((m) => ['SCHEDULED', 'LIVE', 'HALF_TIME', 'SECOND_HALF'].includes(m.status ?? ''));
    if (!hasActiveMatch) return;
    const iv = setInterval(silentRefresh, 12_000);
    return () => clearInterval(iv);
  }, [list, silentRefresh]);

  const upsert = (updated: Match) => setList((prev) => prev.some((m) => m.id === updated.id) ? prev.map((m) => (m.id === updated.id ? updated : m)) : [updated, ...prev]);
  const handleCreated = (match: Match) => { upsert(match); setTimeout(() => loadMatches(), 800); };
  const handleAutoCreated = (match: Match) => { upsert(match); setAutoMatchIds((prev) => new Set([...prev, match.id])); setTimeout(() => loadMatches(), 800); };
  const handleAutoCancelled = (matchId: string) => { setAutoMatchIds((prev) => { const next = new Set(prev); next.delete(matchId); return next; }); };
  const hideMatch = useCallback((id: string) => { setHiddenIds((prev) => new Set([...prev, id])); }, []);
  const hideAllMatches = useCallback(() => { const visibleIds = list.filter((m) => { if (hiddenIds.has(m.id)) return false; if (filter === 'ALL') return true; if (filter === 'LIVE') return ['LIVE', 'HALF_TIME', 'SECOND_HALF'].includes(m.status ?? ''); return m.status === filter; }).map((m) => m.id); setHiddenIds((prev) => new Set([...prev, ...visibleIds])); }, [list, hiddenIds, filter]);

  const visibleList = list.filter((m) => !hiddenIds.has(m.id));
  const filtered = visibleList.filter((m) => { if (filter === 'ALL') return true; if (filter === 'LIVE') return ['LIVE', 'HALF_TIME', 'SECOND_HALF'].includes(m.status ?? ''); return m.status === filter; });
  const liveCount = visibleList.filter((m) => ['LIVE', 'HALF_TIME', 'SECOND_HALF'].includes(m.status ?? '')).length;
  const tabCounts: Record<MatchTab, number> = { ALL: visibleList.length, LIVE: liveCount, SCHEDULED: visibleList.filter((m) => m.status === 'SCHEDULED').length, FINISHED: visibleList.filter((m) => m.status === 'FINISHED').length };
  const hiddenCount = hiddenIds.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-xl font-bold text-white">Matches</h2>
          {hiddenCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,71,87,0.15)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.25)' }}>{hiddenCount} hidden</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filtered.length > 0 && <button onClick={hideAllMatches} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff4757', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.2)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.1)'; }}><DeleteSweepIcon fontSize="small" /> <span className="hidden sm:inline">Delete All</span></button>}
          <button onClick={loadMatches} disabled={loading} className="p-1.5 rounded-xl bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-50 transition-colors"><RefreshIcon fontSize="small" /></button>
          <button onClick={() => setShowAutoCreate(true)} style={{ padding: '9px 14px', borderRadius: 9, background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: 'none', color: '#1a1306', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 4px 20px rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}><BoltIcon fontSize="small" /> <span className="hidden sm:inline">Auto Match</span></button>
          <button onClick={() => setShowCreate(true)} style={{ padding: '9px 14px', borderRadius: 9, background: 'linear-gradient(135deg, #63d2ff, #3891ff)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 4px 20px rgba(99,210,255,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}><AddIcon fontSize="small" /> <span className="hidden sm:inline">New Match</span></button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {MATCH_TABS.map((t) => { const active = filter === t; const count = tabCounts[t]; return <button key={t} onClick={() => setFilter(t)} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${active ? 'rgba(99,210,255,0.4)' : 'rgba(255,255,255,0.07)'}`, background: active ? 'rgba(99,210,255,0.1)' : 'transparent', color: active ? '#63d2ff' : 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>{t === 'LIVE' && liveCount > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />}{t} {count > 0 && <span style={{ opacity: 0.6 }}>({count})</span>}</button>; })}
      </div>
      {loading && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>{[1,2,3,4,5,6].map((i) => <div key={i} className="animate-pulse" style={{ height: 200, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.06)' }} />)}</div>}
      {!loading && fetchError && <ErrorState text={fetchError} onRetry={loadMatches} />}
      {!loading && !fetchError && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏟️</div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontWeight: 600, marginBottom: 16 }}>No {filter !== 'ALL' ? filter.toLowerCase() + ' ' : ''}matches{hiddenCount > 0 ? ' visible' : ' yet'}</p>
          {hiddenCount > 0 && <button onClick={() => setHiddenIds(new Set())} style={{ marginBottom: 10, padding: '8px 18px', borderRadius: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff4757', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Restore {hiddenCount} hidden</button>}
          {filter === 'ALL' && hiddenCount === 0 && <button onClick={() => setShowCreate(true)} style={{ padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg, #63d2ff, #3891ff)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Create your first match</button>}
        </div>
      )}
      {!loading && !fetchError && filtered.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}><AnimatePresence>{filtered.map((m, i) => <MatchCard key={m.id} match={m} index={i} isAuto={autoMatchIds.has(m.id)} onScoreClick={setScoreTarget} onStatusClick={setStatusTarget} onHide={hideMatch} onScheduleClick={setScheduleTarget} />)}</AnimatePresence></div>}
      {showCreate && <CreateMatchModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {showAutoCreate && <CreateAutoMatchModal onClose={() => setShowAutoCreate(false)} onCreated={handleAutoCreated} />}
      {scoreTarget && <ScoreModal match={scoreTarget} onClose={() => setScoreTarget(null)} onSaved={upsert} />}
      {statusTarget && <StatusTransitionModal match={statusTarget} onClose={() => setStatusTarget(null)} onSaved={upsert} />}
      {scheduleTarget && <AutoScheduleModal match={scheduleTarget} onClose={() => setScheduleTarget(null)} onCancelled={handleAutoCancelled} />}
    </div>
  );
}

// ─── Booking Code ─────────────────────────────────────────────────────────────

const bcInputStyle: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', appearance: 'none' };

function BcField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</label>{children}</div>;
}

const BOOKING_TYPES = [
  { id: 'STANDARD',   label: 'Standard Code',   desc: 'Build a slip from any available match in the feed.',      accent: '#63d2ff', accentBg: 'rgba(99,210,255,0.1)',  apiMethod: 'createBookingCode' as const },
  { id: 'ADMIN_ONLY', label: 'Admin Games Only', desc: 'Selections locked to matches you personally created.',    accent: '#f59e0b', accentBg: 'rgba(245,158,11,0.1)', apiMethod: 'createAdminOnlyBookingCode' as const },
  { id: 'MIXED',      label: 'Mixed Code',       desc: 'Combine your admin fixtures with external feed matches.', accent: '#a78bfa', accentBg: 'rgba(167,139,250,0.1)', apiMethod: 'createMixedBookingCode' as const },
] as const;

type BookingTypeId    = typeof BOOKING_TYPES[number]['id'];
type BookingApiMethod = typeof BOOKING_TYPES[number]['apiMethod'];

function BcModalShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0' }}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} style={{ background: 'linear-gradient(160deg, #0f0f1a 0%, #13131f 60%, #0d0d18 100%)', borderRadius: '16px 16px 0 0', border: '1.5px solid rgba(255,255,255,0.08)', borderBottom: 'none', width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -24px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</div>{subtitle && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{subtitle}</div>}</div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', flexShrink: 0, marginLeft: 12 }}><CloseIcon style={{ fontSize: 14 }} /></button>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginTop: 14 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

function BcTypePickerModal({ onClose, onPick }: { onClose: () => void; onPick: (t: BookingTypeId) => void }) {
  return (
    <BcModalShell title="Choose Code Type" onClose={onClose}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.5 }}>Select the type of booking code you want to create.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BOOKING_TYPES.map((t, i) => (
          <motion.button key={t.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, duration: 0.22 }} onClick={() => onPick(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .15s, background .15s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.background = t.accentBg; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: t.accentBg, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{t.id === 'STANDARD' ? '🎟️' : t.id === 'ADMIN_ONLY' ? '⭐' : '🔀'}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{t.label}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{t.desc}</div></div>
            <span style={{ color: t.accent, opacity: 0.7, fontSize: 16 }}>›</span>
          </motion.button>
        ))}
      </div>
    </BcModalShell>
  );
}

function BcSelectionRow({ sel, onRemove }: { sel: any; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.match}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(99,210,255,0.1)', fontWeight: 700, fontSize: 10, color: '#63d2ff' }}>{sel.market}</span><span>{sel.pick}</span>{sel.line != null && <span>· Line {sel.line}</span>}</div></div>
      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#63d2ff', flexShrink: 0 }}>{sel.odds.toFixed(2)}</div>
      <button onClick={onRemove} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff4757', padding: 4, borderRadius: 6, display: 'flex', fontSize: 14 }}>×</button>
    </div>
  );
}

function BcSelectionPicker({ bookingType, onPick, onClose }: { bookingType: BookingTypeId; onPick: (sel: any) => void; onClose: () => void }) {
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [market, setMarket] = useState<typeof MARKETS[number]>(MARKETS[0]);
  const [pick, setPick] = useState('');
  const [line, setLine] = useState(2.5);
  const [team, setTeam] = useState('');
  const [handicap, setHandicap] = useState(-1);
  const [home, setHome] = useState(2);
  const [away, setAway] = useState(1);
  const [ht, setHt] = useState('Home Win');
  const [ft, setFt] = useState('Home Win');
  const [odds, setOdds] = useState(2.0);
  const typeCfg = bookingTypeConfig(bookingType);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let fetchedMatches: any[] = [];
        if (bookingType === 'ADMIN_ONLY') { const raw = await adminMatches.list(); const res = normalise<Match[]>(raw); fetchedMatches = (res.success && Array.isArray(res.data) ? res.data : []).map((m: any) => ({ ...m, _source: 'ADMIN' })); }
        else if (bookingType === 'MIXED') { const [adminRaw, feedRaw] = await Promise.all([adminMatches.list(), matchesApi.upcoming()]); const adminRes = normalise<Match[]>(adminRaw); const feedRes = normalise<Match[]>(feedRaw); const adminMs = (adminRes.success && Array.isArray(adminRes.data) ? adminRes.data : []).map((m: any) => ({ ...m, _source: 'ADMIN' })); const feedMs = (feedRes.success && Array.isArray(feedRes.data) ? feedRes.data : []).map((m: any) => ({ ...m, _source: 'EXTERNAL' })); const seen = new Set(adminMs.map((m: any) => m.id)); fetchedMatches = [...adminMs, ...feedMs.filter((m: any) => !seen.has(m.id))]; }
        else { const raw = await matchesApi.upcoming(); const res = normalise<Match[]>(raw); fetchedMatches = (res.success && Array.isArray(res.data) ? res.data : []).map((m: any) => ({ ...m, _source: 'EXTERNAL' })); }
        if (!cancelled) setAllMatches(fetchedMatches);
      } catch (err) { console.error('BcSelectionPicker: load failed', err); }
      finally { if (!cancelled) setLoadingMatches(false); }
    })();
    return () => { cancelled = true; };
  }, [bookingType]);

  const playable = allMatches.filter((m) => ['UPCOMING', 'SCHEDULED', 'LIVE'].includes(m.status ?? ''));
  const buildSelection = () => {
    const base: any = { fixture_id: match.id, match: `${match.homeTeam} vs ${match.awayTeam}`, market: market.value, odds: +odds, result: null, _source: match._source };
    if (['1X2', 'WIN_ONLY', 'BTTS'].includes(market.value)) base.pick = pick;
    else if (market.value === 'OVER_UNDER') { base.line = +line; base.pick = pick; }
    else if (market.value === 'HANDICAP') { base.team = team; base.handicap = +handicap; base.pick = `${team} ${handicap > 0 ? '+' : ''}${handicap}`; }
    else if (market.value === 'CORRECT_SCORE') { base.home_goals = +home; base.away_goals = +away; base.pick = `${home}-${away}`; }
    else if (market.value === 'HT_FT') { base.ht_result = ht; base.ft_result = ft; const short = (v: string) => v.split(' ')[0]; base.pick = `${short(ht)} / ${short(ft)}`; }
    return base;
  };
  const canSubmit = () => { if (!match || +odds < 1.1) return false; if (['1X2','WIN_ONLY','BTTS','OVER_UNDER'].includes(market.value) && !pick) return false; if (market.value === 'HANDICAP' && !team) return false; return true; };

  return (
    <BcModalShell title="Add Selection" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: typeCfg.accent, textTransform: 'uppercase', padding: '6px 10px', borderRadius: 7, background: typeCfg.accentBg, display: 'inline-flex', alignSelf: 'flex-start' }}>{bookingType === 'ADMIN_ONLY' ? '⭐ Your admin matches only' : bookingType === 'MIXED' ? '🔀 Admin + external matches' : '🎟️ All available matches'}</div>
        <BcField label="Match">
          {loadingMatches ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.08)', background: '#12121e' }}><div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${typeCfg.accent}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} /><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Loading matches…</span><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style></div>
          : playable.length === 0 ? <div style={{ padding: '14px', borderRadius: 8, border: '1.5px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}><div style={{ fontSize: 20, marginBottom: 6 }}>🏟️</div><p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{bookingType === 'ADMIN_ONLY' ? 'No admin-created matches found.' : 'No matches available.'}</p></div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <select value={match?.id || ''} onChange={(e) => { setMatch(playable.find((m) => m.id === e.target.value) || null); setPick(''); setTeam(''); }} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px 36px 10px 14px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.12)', background: '#12121e', color: match ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13, outline: 'none', fontFamily: 'inherit', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }} onFocus={(e) => (e.currentTarget.style.borderColor = typeCfg.accent)} onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}>
                  <option value="" style={{ background: '#12121e', color: 'rgba(255,255,255,0.4)' }}>— Choose a match —</option>
                  {bookingType === 'MIXED' ? (<><optgroup label="── Your Admin Matches ──" style={{ background: '#12121e' }}>{playable.filter((m) => m._source === 'ADMIN').map((m: any) => <option key={m.id} value={m.id} style={{ background: '#12121e', color: '#fff' }}>{m.homeTeam} vs {m.awayTeam}{m.league ? ` · ${m.league}` : ''}</option>)}</optgroup><optgroup label="── External Feed ──" style={{ background: '#12121e' }}>{playable.filter((m) => m._source === 'EXTERNAL').map((m: any) => <option key={m.id} value={m.id} style={{ background: '#12121e', color: '#fff' }}>{m.homeTeam} vs {m.awayTeam}{m.league ? ` · ${m.league}` : ''}</option>)}</optgroup></>) : playable.map((m: any) => <option key={m.id} value={m.id} style={{ background: '#12121e', color: '#fff' }}>{m.homeTeam} vs {m.awayTeam}{m.league ? ` · ${m.league}` : ''}{m._source === 'ADMIN' ? ' ★' : ''}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>▼</span>
              </div>
              {match && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, background: `${typeCfg.accent}0f`, border: `1.5px solid ${typeCfg.accent}35` }}><span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{match.homeTeam}</span><span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>VS</span><span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{match.awayTeam}</span>{match._source === 'ADMIN' && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 5, background: `${typeCfg.accent}22`, color: typeCfg.accent, border: `1px solid ${typeCfg.accent}40` }}>Admin</span>}</div>}
            </div>
          )}
        </BcField>
        <BcField label="Market"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>{MARKETS.map((m) => <button key={m.value} onClick={() => { setMarket(m); setPick(''); }} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', background: market.value === m.value ? typeCfg.accent : 'rgba(255,255,255,0.06)', color: market.value === m.value ? '#fff' : 'rgba(255,255,255,0.6)', transition: 'background .12s' }}>{m.label}</button>)}</div></BcField>
        {'picks' in market && market.picks.length > 0 && <BcField label="Pick"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{market.picks.map((p) => <button key={p} onClick={() => setPick(p)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: pick === p ? typeCfg.accent : 'rgba(255,255,255,0.06)', color: pick === p ? '#fff' : 'rgba(255,255,255,0.6)', transition: 'background .12s' }}>{p}</button>)}</div></BcField>}
        {'hasLine' in market && market.hasLine && <BcField label="Line"><input type="number" step="0.5" value={line} onChange={(e) => setLine(+e.target.value)} style={bcInputStyle} /></BcField>}
        {'hasHandicap' in market && market.hasHandicap && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><BcField label="Team"><div style={{ position: 'relative' }}><select value={team} onChange={(e) => setTeam(e.target.value)} style={{ ...bcInputStyle, cursor: 'pointer', background: '#12121e', color: team ? '#fff' : 'rgba(255,255,255,0.4)', appearance: 'none', WebkitAppearance: 'none', paddingRight: 30 }}><option value="" style={{ background: '#12121e' }}>Choose…</option>{match && <option value={match.homeTeam} style={{ background: '#12121e', color: '#fff' }}>{match.homeTeam}</option>}{match && <option value={match.awayTeam} style={{ background: '#12121e', color: '#fff' }}>{match.awayTeam}</option>}</select><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>▼</span></div></BcField><BcField label="Handicap"><input type="number" step="0.5" value={handicap} onChange={(e) => setHandicap(+e.target.value)} style={bcInputStyle} /></BcField></div>}
        {'hasScore' in market && market.hasScore && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><BcField label="Home Goals"><input type="number" min={0} max={10} value={home} onChange={(e) => setHome(+e.target.value)} style={bcInputStyle} /></BcField><BcField label="Away Goals"><input type="number" min={0} max={10} value={away} onChange={(e) => setAway(+e.target.value)} style={bcInputStyle} /></BcField></div>}
        {'hasHtFt' in market && market.hasHtFt && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><BcField label="Half-Time"><div style={{ position: 'relative' }}><select value={ht} onChange={(e) => setHt(e.target.value)} style={{ ...bcInputStyle, cursor: 'pointer', background: '#12121e', color: '#fff', appearance: 'none', WebkitAppearance: 'none', paddingRight: 30 }}>{['Home Win','Draw','Away Win'].map((v) => <option key={v} style={{ background: '#12121e', color: '#fff' }}>{v}</option>)}</select><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>▼</span></div></BcField><BcField label="Full-Time"><div style={{ position: 'relative' }}><select value={ft} onChange={(e) => setFt(e.target.value)} style={{ ...bcInputStyle, cursor: 'pointer', background: '#12121e', color: '#fff', appearance: 'none', WebkitAppearance: 'none', paddingRight: 30 }}>{['Home Win','Draw','Away Win'].map((v) => <option key={v} style={{ background: '#12121e', color: '#fff' }}>{v}</option>)}</select><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>▼</span></div></BcField></div>}
        <BcField label="Odds"><input type="number" step="0.01" min="1.10" value={odds} onChange={(e) => setOdds(+e.target.value)} style={bcInputStyle} /></BcField>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onPick(buildSelection())} disabled={!canSubmit()} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', background: canSubmit() ? typeCfg.accent : 'rgba(255,255,255,0.1)', color: canSubmit() ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 800, cursor: canSubmit() ? 'pointer' : 'not-allowed', transition: 'background .15s' }}>Add Selection</button>
        </div>
      </div>
    </BcModalShell>
  );
}

function BcCreateModal({ bookingType, onClose, onBack, onCreate }: { bookingType: BookingTypeId; onClose: () => void; onBack: () => void; onCreate: (code: BookingCode) => void }) {
  const { showToast } = useAppStore();
  const { currency } = useCurrency();
  const typeCfg = bookingTypeConfig(bookingType);
  const [form, setForm] = useState({ label: '', stake: 10, expires_in_hours: 24, selections: [] as any[] });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const totalOdds = useMemo(() => form.selections.reduce((p, s) => p * s.odds, 1), [form.selections]);
  const potential = +(form.stake * totalOdds).toFixed(2);
  const kind = useMemo(() => deriveKind(form.selections), [form.selections]);
  const addSelection = (sel: any) => { if (form.selections.find((s) => s.fixture_id === sel.fixture_id)) { setError('That fixture is already in this slip.'); return; } setError(''); setForm((f) => ({ ...f, selections: [...f.selections, sel] })); setPickerOpen(false); };
  const validate = () => { if (!form.label.trim()) return 'Label is required'; if (!form.selections.length) return 'Add at least 1 selection'; if (form.selections.length > 20) return 'Max 20 selections'; if (form.stake < 1) return 'Min stake is 1'; if (form.selections.some((s) => s.odds < 1.10)) return 'Min odds per selection: 1.10'; if (totalOdds > 10000) return 'Max total odds: 10,000'; return null; };
  const submit = async () => {
    const err = validate(); if (err) { setError(err); return; } setError(''); setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + form.expires_in_hours * 3_600_000).toISOString();
      const payload: CreateBookingRequest = { kind, label: form.label.trim(), stake: +form.stake, currency: currency.code, selections: form.selections, expiresAt, ...(bookingType !== 'STANDARD' ? { bookingType } : {}) };
      const method = typeCfg.apiMethod satisfies BookingApiMethod;
      const raw = await adminBooking[method](payload);
      const res = normalise<BookingCode>(raw);
      if (res.success && res.data) { showToast('Code created!', 'success'); onCreate(res.data); }
      else setError('Server returned an unexpected response.');
    } catch (err: unknown) { setError('Failed to create code: ' + (err instanceof Error ? err.message : 'Unknown error')); }
    finally { setSubmitting(false); }
  };
  return (
    <BcModalShell title={typeCfg.label} subtitle={typeCfg.desc} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: typeCfg.accentBg, border: `1px solid ${typeCfg.accent}40` }}><span style={{ fontSize: 16 }}>{typeCfg.id === 'STANDARD' ? '🎟️' : typeCfg.id === 'ADMIN_ONLY' ? '⭐' : '🔀'}</span><span style={{ fontSize: 12, color: typeCfg.accent, fontWeight: 600 }}>{typeCfg.label}</span><button onClick={onBack} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: typeCfg.accent, fontSize: 11, fontWeight: 600 }}>Change type ›</button></div>
        <BcField label="Label"><input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Weekend Big 4" style={bcInputStyle} /></BcField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <BcField label={`Stake (${currency.code})`}><input type="number" min="1" value={form.stake} onChange={(e) => setForm((f) => ({ ...f, stake: +e.target.value || 0 }))} style={bcInputStyle} /></BcField>
          <BcField label="Expires in (hours)"><input type="number" min="1" value={form.expires_in_hours} onChange={(e) => setForm((f) => ({ ...f, expires_in_hours: +e.target.value || 24 }))} style={bcInputStyle} /></BcField>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Selections ({form.selections.length})</label><button onClick={() => setPickerOpen(true)} style={{ padding: '6px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${typeCfg.accent}60`, color: typeCfg.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>+ Add Match</button></div>
          {form.selections.length === 0 ? <div style={{ padding: '20px 16px', textAlign: 'center', borderRadius: 10, border: '2px dashed rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No selections yet — tap <strong>Add Match</strong> to build your slip.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{form.selections.map((s, i) => <BcSelectionRow key={i} sel={s} onRemove={() => setForm((f) => ({ ...f, selections: f.selections.filter((_, j) => j !== i) }))} />)}</div>}
        </div>
        <div style={{ borderRadius: 12, padding: '14px 16px', background: typeCfg.accentBg, border: `1px solid ${typeCfg.accent}60`, display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 12, alignItems: 'center' }}>
          <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Kind</div><div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: typeCfg.accent }}>{kind}</div></div>
          <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Total Odds</div><div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 22, color: typeCfg.accent, lineHeight: 1 }}>{totalOdds.toFixed(2)}x</div></div>
          <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Potential Payout</div><div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 22, color: '#4ade80', lineHeight: 1 }}>{fmt(potential, currency)}</div></div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={submitting} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', background: submitting ? 'rgba(255,255,255,0.1)' : typeCfg.accent, color: submitting ? 'rgba(255,255,255,0.4)' : '#fff', fontSize: 13, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: '0.04em' }}>{submitting ? 'Creating…' : '⚡ Create Code'}</button>
        </div>
      </div>
      <AnimatePresence>{pickerOpen && <BcSelectionPicker bookingType={bookingType} onPick={addSelection} onClose={() => setPickerOpen(false)} />}</AnimatePresence>
    </BcModalShell>
  );
}

function BcViewModal({ code, onClose }: { code: BookingCode; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { currency } = useCurrency();
  const totalOdds = +((code as any).totalOdds ?? (code as any).total_odds ?? 0);
  const potentialPayout = +((code as any).potentialPayout ?? (code as any).potential_payout ?? 0);
  const btCfg = bookingTypeConfig((code as any).bookingType ?? 'STANDARD');
  const share = async () => { await navigator.clipboard.writeText(code.code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <BcModalShell title={`Code · ${code.code}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ borderRadius: 10, padding: '12px 14px', background: 'rgba(99,210,255,0.08)', border: '1px solid rgba(99,210,255,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}><div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{code.label}</div>{(code as any).bookingType && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: btCfg.accentBg, color: btCfg.accent, flexShrink: 0 }}>{(code as any).bookingType === 'ADMIN_ONLY' ? 'Admin Only' : (code as any).bookingType === 'MIXED' ? 'Mixed' : 'Standard'}</span>}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 10, flexWrap: 'wrap' }}><span>Stake {fmt(code.stake ?? 0, currency)}</span><span>·</span><span>Odds <strong style={{ color: '#63d2ff' }}>{totalOdds.toFixed(2)}x</strong></span><span>·</span><span>Payout <strong style={{ color: '#4ade80' }}>{fmt(potentialPayout, currency)}</strong></span></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{((code as any).selections ?? []).map((s: any, i: number) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}><div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{i + 1}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.match ?? s.homeTeam ?? 'Unknown match'}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(99,210,255,0.1)', fontWeight: 700, fontSize: 10, color: '#63d2ff' }}>{s.market}</span><span>{s.pick}</span>{s.line != null && <span>· Line {s.line}</span>}</div></div><div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#63d2ff', flexShrink: 0 }}>{(+s.odds).toFixed(2)}</div></div>)}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close</button>
          <button onClick={share} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', background: copied ? '#4ade80' : 'linear-gradient(135deg, #63d2ff, #3891ff)', color: copied ? '#000' : '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{copied ? '✓ Copied!' : '📋 Copy Code'}</button>
        </div>
      </div>
    </BcModalShell>
  );
}

function BcStatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="bg-slate-800 rounded-2xl p-3 border border-slate-700"><p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">{label}</p><p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: accent ?? '#fff', lineHeight: 1 }}>{value}</p></div>;
}

function BcCodeCard({ code, onView, onHide }: { code: BookingCode; onView: () => void; onHide: () => void }) {
  const [copied, setCopied] = useState(false);
  const { currency } = useCurrency();
  const totalOdds = +((code as any).totalOdds ?? (code as any).total_odds ?? 0);
  const potentialPayout = +((code as any).potentialPayout ?? (code as any).potential_payout ?? 0);
  const redemptionCount = +((code as any).redemptionCount ?? (code as any).redemption_count ?? 0);
  const maxRedemptions = (code as any).maxRedemptions ?? (code as any).max_redemptions ?? null;
  const expiresAt = (code as any).expiresAt ?? (code as any).expires_at ?? null;
  const expired = isExpired(expiresAt);
  const status = expired ? 'expired' : ((code as any).status ?? 'active');
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.expired;
  const selCount = (code as any).selections?.length ?? 0;
  const btCfg = bookingTypeConfig((code as any).bookingType ?? 'STANDARD');
  const copyCode = async (e: React.MouseEvent) => { e.stopPropagation(); await navigator.clipboard.writeText(code.code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', transition: 'border-color .15s, box-shadow .15s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,210,255,0.35)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ height: 3, background: sc.text, opacity: 0.7 }} />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <div style={{ minWidth: 0 }}><div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#63d2ff', letterSpacing: '0.06em' }}>{code.code}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{code.label || '—'}</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: sc.bg, color: sc.text, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />{status}</span>
              <button onClick={onHide} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(255,71,87,0.25)', background: 'rgba(255,71,87,0.08)', color: 'rgba(255,71,87,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.22)'; (e.currentTarget as HTMLButtonElement).style.color = '#ff4757'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,71,87,0.6)'; }}><DeleteIcon style={{ fontSize: 13 }} /></button>
            </div>
            {(code as any).bookingType && (code as any).bookingType !== 'STANDARD' && <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: btCfg.accentBg, color: btCfg.accent }}>{(code as any).bookingType === 'ADMIN_ONLY' ? 'Admin Only' : 'Mixed'}</span>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[{ label: 'Stake', value: fmt(code.stake ?? 0, currency), accent: undefined }, { label: 'Total Odds', value: totalOdds.toFixed(2) + 'x', accent: '#63d2ff' }, { label: 'Potential', value: fmt(potentialPayout, currency), accent: '#4ade80' }, { label: 'Redeemed', value: `${redemptionCount}${maxRedemptions != null ? ' / ' + maxRedemptions : ''}`, accent: undefined }].map((s) => <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 9px' }}><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{s.label}</div><div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: s.accent ?? '#fff' }}>{s.value}</div></div>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12, flexWrap: 'wrap' }}>
          <span>🎟️ {selCount} sel.</span><span style={{ opacity: 0.4 }}>·</span><span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(99,210,255,0.1)', color: '#63d2ff' }}>{(code as any).kind}</span>
          {expiresAt && (<><span style={{ opacity: 0.4 }}>·</span><span>⏱ {fmtTimeAgo(expiresAt)}</span></>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onView} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>👁 View</button>
          <button onClick={copyCode} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(99,210,255,0.1)', border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(99,210,255,0.2)'}`, color: copied ? '#4ade80' : '#63d2ff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{copied ? '✓ Copied!' : '📋 Copy'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Bookings ────────────────────────────────────────────────────────

function BookingsSection() {
  const { currency } = useCurrency();
  const [codes, setCodes] = useState<BookingCode[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<null | 'picker' | BookingTypeId>(null);
  const [viewCode, setViewCode] = useState<BookingCode | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const raw = await adminBooking.list();
      const res = normalise<PageResponse<BookingCode>>(raw);
      if (res.success) setCodes(res.data?.content ?? (Array.isArray(res.data) ? res.data as unknown as BookingCode[] : []));
      else setFetchError('Failed to load booking codes.');
    } catch (err: unknown) { setFetchError(err instanceof Error ? err.message : 'Network error.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = useCallback((newCode: BookingCode) => { setCodes((prev) => [newCode, ...prev]); setModalState(null); }, []);
  const hideCode = useCallback((id: string) => { setHiddenIds((prev) => new Set([...prev, id])); }, []);
  const hideAllCodes = useCallback(() => { const ids = codes.filter((c) => !hiddenIds.has((c as any).id)).map((c) => (c as any).id); setHiddenIds((prev) => new Set([...prev, ...ids])); }, [codes, hiddenIds]);
  const visibleCodes = codes.filter((c) => !hiddenIds.has((c as any).id));
  const hiddenCount = hiddenIds.size;
  const stats = useMemo(() => { const active = visibleCodes.filter((c) => (c as any).status === 'active' && !isExpired((c as any).expiresAt ?? (c as any).expires_at)).length; const redeemed = visibleCodes.reduce((s, c) => s + +((c as any).redemptionCount ?? (c as any).redemption_count ?? 0), 0); const avgOdds = visibleCodes.length ? (visibleCodes.reduce((s, c) => s + +((c as any).totalOdds ?? (c as any).total_odds ?? 0), 0) / visibleCodes.length).toFixed(2) : null; const avgStake = visibleCodes.length ? visibleCodes.reduce((s, c) => s + +(c.stake ?? 0), 0) / visibleCodes.length : null; return { active, redeemed, avgOdds, avgStake }; }, [visibleCodes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2"><h2 className="font-heading text-xl font-bold text-white">Booking Codes</h2>{hiddenCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,71,87,0.15)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.25)' }}>{hiddenCount} hidden</span>}</div>
        <div className="flex items-center gap-2">
          {visibleCodes.length > 0 && <button onClick={hideAllCodes} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff4757', fontSize: 11, fontWeight: 800, cursor: 'pointer' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.2)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.1)'; }}><DeleteSweepIcon fontSize="small" /></button>}
          <button onClick={load} disabled={loading} className="p-1.5 rounded-xl bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-50 transition-colors"><RefreshIcon fontSize="small" /></button>
          <button onClick={() => setModalState('picker')} style={{ padding: '9px 14px', borderRadius: 9, background: 'linear-gradient(135deg, #63d2ff, #3891ff)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 4px 20px rgba(99,210,255,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}><AddIcon fontSize="small" /> <span className="hidden sm:inline">New Code</span></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }} className="sm:grid-cols-4">
        <BcStatCard label="Active"      value={loading ? '—' : String(stats.active)} />
        <BcStatCard label="Redeemed" value={loading ? '—' : String(stats.redeemed)} accent="#63d2ff" />
        <BcStatCard label="Avg Odds"    value={loading ? '—' : stats.avgOdds ? stats.avgOdds + 'x' : '—'} accent="#4ade80" />
        <BcStatCard label="Avg Stake"   value={loading ? '—' : stats.avgStake != null ? fmt(stats.avgStake, currency) : '—'} accent="#a78bfa" />
      </div>
      {loading ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>{[1,2,3,4].map((i) => <div key={i} className="animate-pulse" style={{ height: 200, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}><div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }} /></div>)}</div>
        : fetchError ? <ErrorState text={fetchError} onRetry={load} />
        : visibleCodes.length === 0 ? <div style={{ textAlign: 'center', padding: '60px 24px' }}><div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div><p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontWeight: 600, marginBottom: 16 }}>No booking codes{hiddenCount > 0 ? ' visible' : ' yet'}</p>{hiddenCount > 0 ? <button onClick={() => setHiddenIds(new Set())} style={{ marginBottom: 10, padding: '8px 18px', borderRadius: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff4757', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Restore {hiddenCount} hidden</button> : <button onClick={() => setModalState('picker')} style={{ padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg, #63d2ff, #3891ff)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Create First Code</button>}</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}><AnimatePresence>{visibleCodes.map((c, i) => <motion.div key={(c as any).id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }}><BcCodeCard code={c} onView={() => setViewCode(c)} onHide={() => hideCode((c as any).id)} /></motion.div>)}</AnimatePresence></div>}
      <AnimatePresence>
        {modalState === 'picker' && <BcTypePickerModal key="picker" onClose={() => setModalState(null)} onPick={(t) => setModalState(t)} />}
        {(modalState === 'STANDARD' || modalState === 'ADMIN_ONLY' || modalState === 'MIXED') && <BcCreateModal key="create" bookingType={modalState} onClose={() => setModalState(null)} onBack={() => setModalState('picker')} onCreate={handleCreate} />}
        {viewCode && <BcViewModal key="view" code={viewCode} onClose={() => setViewCode(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function UpgradeChatPanel({ chat, isSuperAdmin, onClose, onCommissionSet }: { chat: AdminUpgradeChatDto; isSuperAdmin: boolean; onClose: () => void; onCommissionSet: () => void }) {
  const { showToast } = useAppStore();
  const [messages, setMessages] = useState<AdminUpgradeChatMessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [commissionInput, setCommissionInput] = useState('70');
  const [settingCommission, setSettingCommission] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const fn = isSuperAdmin ? () => superAdminUpgradeChats.getMessages(chat.id) : () => upgradeChats.getMessages(chat.id);
      const raw = await fn(); const res = normalise<AdminUpgradeChatMessageDto[]>(raw); if (res.success) setMessages(res.data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [chat.id, isSuperAdmin]);

  useEffect(() => { fetchMessages(); const iv = setInterval(fetchMessages, 5000); return () => clearInterval(iv); }, [fetchMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    const content = msgInput.trim(); if (!content) return; setSending(true);
    try { const fn = isSuperAdmin ? () => superAdminUpgradeChats.sendMessage(chat.id, { content }) : () => upgradeChats.sendMessage(chat.id, { content }); const raw = await fn(); const res = normalise<AdminUpgradeChatMessageDto>(raw); if (res.success) { setMessages((p) => [...p, res.data]); setMsgInput(''); } }
    catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed.', 'error'); }
    finally { setSending(false); }
  };

  const handleSetCommission = async () => {
    const rate = parseFloat(commissionInput);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      showToast('Commission rate must be between 0 and 100.', 'error');
      return;
    }
    setSettingCommission(true);
    try {
      const raw = await superAdminUpgradeChats.setCommission(chat.id, { commissionRate: rate });
      const res = normalise(raw);
      if (res.success) {
        showToast(`Commission set to ${rate}%!`, 'success');
        onCommissionSet();
        fetchMessages();
      }
    }
    catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed.', 'error'); }
    finally { setSettingCommission(false); }
  };

  const displayCommission = (chat as any).commissionRate ?? (chat as any).commission_percent ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800 shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"><CloseIcon fontSize="small" /></button>
        <div className="flex-1 min-w-0"><p className="text-sm font-bold text-white truncate">{chat.userFirstName ?? 'User'} · {chat.userEmail ?? ''}</p><StatusBadge status={chat.status} /></div>
        <span className="text-xs text-emerald-400 font-bold shrink-0">
          {displayCommission != null ? `${displayCommission}%` : '—'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
        {loading ? <div className="flex justify-center py-8"><Spinner /></div>
          : messages.length === 0 ? <EmptyState icon={<ChatIcon sx={{ fontSize: 40 }} />} text="No messages yet." />
          : messages.map((msg) => {
            if (msg.senderRole === 'SYSTEM') return <div key={msg.id} className="flex justify-center"><div className="bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-2 max-w-[80%]"><p className="text-xs text-slate-300 text-center">{msg.content}</p><p className="text-[10px] text-slate-500 text-center mt-1">{fmtDate(msg.sentAt)}</p></div></div>;
            const isCurrentSide = isSuperAdmin ? msg.senderRole === 'SUPER_ADMIN' : msg.senderRole === 'USER';
            return <div key={msg.id} className={`flex ${isCurrentSide ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isCurrentSide ? 'bg-primary text-white rounded-br-sm' : 'bg-slate-700 text-slate-100 rounded-bl-sm'}`}>{!isCurrentSide && <p className="text-[10px] font-bold mb-1 text-slate-400 uppercase tracking-wider">{msg.senderRole === 'SUPER_ADMIN' ? 'Support' : msg.senderName}</p>}<p className="text-sm leading-relaxed">{msg.content}</p><p className={`text-[10px] mt-1 ${isCurrentSide ? 'text-white/60' : 'text-slate-500'}`}>{fmtDate(msg.sentAt)}</p></div></div>;
          })}
        <div ref={bottomRef} />
      </div>
      {isSuperAdmin && chat.status === 'PENDING_COMMISSION' && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800 shrink-0">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Set Commission
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={commissionInput}
              onChange={(e) => setCommissionInput(e.target.value)}
              placeholder="e.g. 60"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-sm font-bold text-emerald-400 outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSetCommission}
              disabled={settingCommission}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-1.5"
            >
              {settingCommission ? <Spinner /> : <><CheckIcon fontSize="small" /> Set Rate</>}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">Enter a rate between 0–100%. This is sent directly to the backend for this admin.</p>
        </div>
      )}
      {chat.status !== 'CLOSED' && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800 shrink-0 flex gap-2">
          <input type="text" value={msgInput} onChange={(e) => setMsgInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder="Type a message…" maxLength={2000} className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-primary outline-none" />
          <button onClick={sendMessage} disabled={sending || !msgInput.trim()} className="p-2.5 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white rounded-xl">{sending ? <Spinner /> : <SendIcon fontSize="small" />}</button>
        </div>
      )}
    </div>
  );
}

// ─── Section: Dashboard ───────────────────────────────────────────────────────

function DashboardSection({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { currency } = useCurrency();
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');
  const [affiliateStats, setAffiliateStats] = useState<AffiliateStatsDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRaw, affRaw] = await Promise.all([adminAnalytics.get(range), adminAffiliate.getStats()]);
      const analyticsRes = normalise<Record<string, unknown>>(analyticsRaw);
      const affRes = normalise<AffiliateStatsDTO>(affRaw);
      if (analyticsRes.success) setAnalytics(analyticsRes.data);
      if (affRes.success) setAffiliateStats(affRes.data);
      if (isSuperAdmin) { const metricsRaw = await superAdmin.metrics(); const metricsRes = normalise<Record<string, unknown>>(metricsRaw); if (metricsRes.success) setMetrics(metricsRes.data); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [range, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const kpis = isSuperAdmin && metrics
    ? [{ label: 'Total Users', value: String(metrics.totalUsers ?? '—') }, { label: 'Total Admins', value: String(metrics.totalAdmins ?? '—') }, { label: 'Total Revenue', value: typeof metrics.totalRevenue === 'number' ? fmt(metrics.totalRevenue, currency) : '—' }, { label: 'Active Chats', value: String(metrics.activeChats ?? '—') }]
    : analytics
    ? [{ label: 'Total Revenue', value: typeof analytics.totalRevenue === 'number' ? fmt(analytics.totalRevenue, currency) : '—' }, { label: 'Total Bets', value: String(analytics.totalBets ?? '—') }, { label: 'Total Users', value: String(analytics.totalUsers ?? '—') }, { label: 'Aff. Balance', value: affiliateStats ? fmt(affiliateStats.availableBalance, currency) : '—' }]
    : [{ label: 'Total Revenue', value: '—' }, { label: 'Total Bets', value: '—' }, { label: 'Total Users', value: '—' }, { label: 'Aff. Balance', value: '—' }];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading text-xl font-bold text-white">Dashboard</h2>
        <div className="flex gap-1.5">{['7d','30d','90d'].map((r) => <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${range === r ? 'bg-primary text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{r}</button>)}<button onClick={load} className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:bg-slate-600"><RefreshIcon fontSize="small" /></button></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{kpis.map((kpi) => <div key={kpi.label} className="bg-slate-800 rounded-2xl p-3 border border-slate-700"><p className="text-xs text-slate-400 mb-1">{kpi.label}</p>{loading ? <div className="h-6 bg-slate-700 rounded animate-pulse" /> : <p className="font-heading text-lg font-bold text-white">{kpi.value}</p>}</div>)}</div>
      {affiliateStats && <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Affiliate Summary</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[{ label: 'Referrals', value: String(affiliateStats.totalReferrals) }, { label: 'Users Deposit', value: fmt(affiliateStats.lifetimeStake, currency) }, { label: 'Lifetime Comm.', value: fmt(affiliateStats.lifetimeCommission, currency) }, { label: 'Available', value: fmt(affiliateStats.availableBalance, currency) }].map((s) => <div key={s.label}><p className="text-xs text-slate-500">{s.label}</p><p className="text-sm font-bold text-white mt-0.5">{s.value}</p></div>)}</div></div>}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Revenue Trend</p>
        {loading ? <div className="h-24 bg-slate-700 rounded animate-pulse" /> : <div className="flex items-end gap-1 h-24">{(analytics?.dailyRevenue as number[] | undefined ?? [35,55,42,68,75,60,85,90,72,95,80,88]).map((h, i) => { const max = Math.max(...(analytics?.dailyRevenue as number[] | undefined ?? [100])); const pct = typeof h === 'number' ? (h / max) * 100 : h; return <div key={i} className="flex-1 bg-primary/70 rounded-t hover:bg-primary transition-colors" style={{ height: `${pct}%` }} />; })}</div>}
      </div>
    </div>
  );
}

// ─── Commission Breakdown — plain figures, no chart ────────────────────────
function CommissionBreakdown() {
  const { currency } = useCurrency();
  const [range, setRange] = useState<CommissionPeriodType>('daily');
  const [periods, setPeriods] = useState<CommissionPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (r: CommissionPeriodType) => {
    setLoading(true); setError('');
    try {
      const data = r === 'daily' ? await adminCommissionApi.getDaily(30)
        : r === 'weekly' ? await adminCommissionApi.getWeekly(12)
        : await adminCommissionApi.getMonthly(12);
      setPeriods(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load commission breakdown');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  // Most recent period first
  const sorted = [...periods].sort((a, b) => b.periodLabel.localeCompare(a.periodLabel)).slice(0, 12);
  const total = periods.reduce((s, p) => s + p.amount, 0);

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Commission Breakdown</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['daily', 'weekly', 'monthly'] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ padding: '5px 11px', borderRadius: 7, border: `1.5px solid ${range === r ? 'rgba(99,210,255,0.4)' : 'rgba(255,255,255,0.08)'}`, background: range === r ? 'rgba(99,210,255,0.1)' : 'transparent', color: range === r ? '#63d2ff' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3, 4].map((i) => <div key={i} style={{ height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />)}</div>
      ) : error ? (
        <ErrorState text={error} onRetry={() => load(range)} />
      ) : sorted.length === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0' }}>No commission activity in this range yet.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {sorted.map((p) => (
              <div key={p.periodLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{p.periodLabel}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#63d2ff', fontFamily: 'monospace' }}>{fmt(p.amount, currency)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total ({range})</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#4ade80', fontFamily: 'monospace' }}>{fmt(total, currency)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Section: Affiliate ───────────────────────────────────────────────────────

function AffiliateSection({ userEmail }: { userEmail?: string }) {
  const { showToast } = useAppStore();
  const { currency } = useCurrency();
  const [stats, setStats] = useState<AdminAffiliateStatsDTO | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRequest[]>([]);
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMain, setCopiedMain] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRaw, historyRaw, linksRaw, usersRaw] = await Promise.all([
        adminAffiliate.getStats(),
        adminAffiliate.getPayoutHistory(),
        adminAffiliate.getLinks(),
        adminAffiliate.getReferredUsers(),
      ]);
      const statsRes = normalise<AdminAffiliateStatsDTO>(statsRaw);
      const historyRes = normalise<{ content: PayoutRequest[] }>(historyRaw);
      const linksRes = normalise<ReferralLink[]>(linksRaw);
      const usersRes = normalise<any[]>(usersRaw);
      if (statsRes.success) setStats(statsRes.data);
      if (historyRes.success) setPayoutHistory(historyRes.data?.content ?? (Array.isArray(historyRes.data) ? historyRes.data as unknown as PayoutRequest[] : []));
      if (linksRes.success) setLinks(Array.isArray(linksRes.data) ? linksRes.data : []);
      if (usersRes.success) setReferredUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const payoutEnabled = (stats?.commissionBalance ?? 0) > 0;

  const requestPayout = async () => {
    setRequesting(true);
    try {
      const raw = await adminAffiliate.requestPayout();
      const res = normalise(raw);
      if (res.success) { showToast('Payout requested!', 'success'); load(); }
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed.', 'error'); }
    finally { setRequesting(false); }
  };

  const createLink = async () => {
    setCreatingLink(true);
    try {
      const raw = await adminAffiliate.createLink({ label: newLinkLabel.trim() || undefined });
      const res = normalise<ReferralLink>(raw);
      if (res.success) { setLinks(prev => [res.data, ...prev]); setNewLinkLabel(''); setShowLinkForm(false); showToast('Referral link created!', 'success'); }
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed to create link.', 'error'); }
    finally { setCreatingLink(false); }
  };

  const copyLink = (id: string, url: string) => { navigator.clipboard.writeText(url); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); showToast('Link copied!', 'success'); };
  const buildUrl = (code: string) => `${window.location.origin}/register?ref=${code}`;
  const primaryLink = links[0];
  const primaryUrl = primaryLink ? buildUrl(primaryLink.code) : null;
  const primaryCode = primaryLink?.code ?? '—';
  const copyMainLink = () => { if (!primaryUrl) return; navigator.clipboard.writeText(primaryUrl); setCopiedMain(true); setTimeout(() => setCopiedMain(false), 2000); showToast('Link copied!', 'success'); };

  const statCards = [
    { label: 'TOTAL COMMISSION',  value: stats ? fmt(stats.lifetimeCommission, currency)  : `${currency.symbol}0.00`, icon: '↗' },
    { label: 'TOTAL PAID OUT',   value: stats ? fmt(stats.totalPaidOutLifetime, currency)  : `${currency.symbol}0.00`, icon: '📋' },
    { label: 'COMMISSION OWED',  value: stats ? fmt(stats.commissionBalance, currency)     : `${currency.symbol}0.00`, icon: '%' },
    { label: 'USERS BROUGHT',    value: stats ? String(stats.totalReferrals)               : '0',                      icon: '👤' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>DASHBOARD</h2>
          {userEmail && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Signed in as <span style={{ color: '#63d2ff', fontWeight: 600 }}>{userEmail}</span></p>}
        </div>
        <button onClick={load} style={{ padding: '8px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><RefreshIcon fontSize="small" /></button>
      </div>

      {/* ── Referral link card ── */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#374151' }}>YOUR REFERRAL LINK</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', letterSpacing: '0.06em' }}>CODE: {loading ? '…' : primaryCode}</span>
        </div>
        <button onClick={copyMainLink} disabled={!primaryUrl} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: copiedMain ? '#f0fdf4' : '#f9fafb', border: `1.5px solid ${copiedMain ? '#86efac' : '#e5e7eb'}`, cursor: primaryUrl ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
          <span style={{ fontSize: 16 }}>{copiedMain ? '✓' : '📋'}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: copiedMain ? '#16a34a' : '#6b7280', flexShrink: 0 }}>{copiedMain ? 'COPIED!' : 'COPY'}</span>
          <span style={{ flex: 1, fontSize: 12, color: '#dc2626', fontWeight: 500, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loading ? 'Loading…' : (primaryUrl ?? 'No referral link yet — create one below')}</span>
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>{card.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280' }}>{card.label}</span>
            </div>
            {loading
              ? <div style={{ height: 28, background: '#f3f4f6', borderRadius: 6 }} />
              : <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: card.label === 'TOTAL COMMISSION' ? '#16a34a' : '#111827', lineHeight: 1.1 }}>{card.value}</p>}
          </div>
        ))}
      </div>

      {/* ── Commission breakdown (daily / weekly / monthly) ── */}
      <CommissionBreakdown />
      <CountryDepositBreakdown />

      {/* ── Commission balance + payout ── */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
        <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280' }}>COMMISSION BALANCE (AVAILABLE TO WITHDRAW)</p>
        {loading
          ? <div style={{ height: 32, background: '#f3f4f6', borderRadius: 6, marginBottom: 16 }} />
          : <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 900, color: '#111827', lineHeight: 1 }}>{stats ? fmt(stats.commissionBalance, currency) : `${currency.symbol}0.00`}</p>}
        {stats?.lastPayoutAt && (
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#9ca3af' }}>
            Last payout: {stats.lastPayoutAt ? fmtDate(stats.lastPayoutAt) : '—'}
          </p>
        )}
        {!stats?.lastPayoutAt && !loading && (
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#9ca3af' }}>No payouts yet</p>
        )}
        <button
          onClick={requestPayout}
          disabled={requesting || !payoutEnabled}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: payoutEnabled ? 'linear-gradient(135deg, #f87171, #dc2626)' : '#d1d5db',
            color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase', cursor: payoutEnabled ? 'pointer' : 'not-allowed',
            boxShadow: payoutEnabled ? '0 4px 16px rgba(220,38,38,0.35)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {requesting ? <Spinner /> : null}
          {requesting ? 'Requesting…' : 'REQUEST PAYOUT'}
        </button>
        {!payoutEnabled && !loading && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>No commission balance available to withdraw</p>
        )}
      </div>

      {/* ── Referral links ── */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            Referral Links <span style={{ color: '#63d2ff' }}>({links.length})</span>
          </p>
          <button onClick={() => setShowLinkForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#63d2ff', background: 'transparent', border: 'none', cursor: 'pointer' }}><AddIcon fontSize="small" /> New Link</button>
        </div>
        {showLinkForm && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}>
            <input type="text" placeholder="Label (optional)" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && createLink()} disabled={creatingLink} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fff', outline: 'none' }} />
            <button onClick={createLink} disabled={creatingLink} style={{ padding: '8px 16px', borderRadius: 8, background: '#63d2ff', border: 'none', color: '#000', fontSize: 12, fontWeight: 800, cursor: creatingLink ? 'not-allowed' : 'pointer', opacity: creatingLink ? 0.5 : 1 }}>{creatingLink ? '…' : 'Create'}</button>
          </div>
        )}
        {loading
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2].map(i => <div key={i} style={{ height: 52, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }} />)}</div>
          : links.length === 0
            ? <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0' }}>No referral links yet. Create one above.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {links.map(link => {
                  const url = buildUrl(link.code);
                  const isCopied = copiedId === link.id;
                  const commissionDisplay = link.commissionPercent != null
                    ? `${link.commissionPercent}% commission`
                    : 'Commission rate unavailable';
                  return (
                    <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {link.label && <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{link.label}</p>}
                        <p style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#63d2ff' }}>{commissionDisplay}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => copyLink(link.id, url)} style={{ padding: 7, borderRadius: 7, background: isCopied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: isCopied ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex' }}>{isCopied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}</button>
                        <a href={url} target="_blank" rel="noreferrer" style={{ padding: 7, borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', display: 'flex', textDecoration: 'none' }}><OpenInNewIcon fontSize="small" /></a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </div>

      {/* ── Referred players ── */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Referred Players <span style={{ color: '#63d2ff' }}>({referredUsers.length})</span></p>
        {loading
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} style={{ height: 44, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />)}</div>
          : referredUsers.length === 0
            ? <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0' }}>No referred players yet.</p>
            : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total Players</p><p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>{referredUsers.length}</p></div>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Active Players</p><p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#4ade80' }}>{referredUsers.filter(u => referralDeposit(u.lifetimeStake ?? 0) > 0).length}</p></div>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total Deposits</p><p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#63d2ff' }}>{fmt(referredUsers.reduce((s, u) => s + referralDeposit(u.lifetimeStake ?? 0), 0), currency)}</p></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {referredUsers.map((player) => {
                    const name = [player.firstName, player.lastName].filter(Boolean).join(' ') || player.email || player.userId;
                    const isActive = referralDeposit(player.lifetimeStake ?? 0) > 0;
                    return (
                      <div key={player.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Joined {fmtDate(player.joinedAt)} · Deposit: <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{fmt(referralDeposit(player.lifetimeStake ?? 0), currency)}</span></p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                          {player.lifetimeCommission > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>+{fmt(player.lifetimeCommission, currency)}</span>}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: isActive ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: isActive ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>{isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
      </div>

      {/* ── Payout history ── */}
      {payoutHistory.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Payout History</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payoutHistory.map((pr) => (
              <div key={pr.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmt(pr.amount, currency)}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{fmtDate(pr.createdAt)}</p>
                </div>
                <StatusBadge status={pr.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Withdrawals ─────────────────────────────────────────────────────

function WithdrawalsSection() {
  const { showToast } = useAppStore();
  const { currency } = useCurrency();
  const [list, setList] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | undefined>('PENDING');

  const load = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try { const raw = await withdrawals.getAllForAdmin(0, 20, statusFilter); const res = normalise<{ content: WithdrawalRequest[] }>(raw); if (res.success) setList(res.data?.content ?? (Array.isArray(res.data) ? res.data as unknown as WithdrawalRequest[] : [])); else setFetchError('Failed to load withdrawals.'); }
    catch (err: unknown) { setFetchError(err instanceof Error ? err.message : 'Network error.'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => { setProcessing(id); try { const raw = await withdrawals.approve(id, { note: 'Approved via admin panel' }); const res = normalise<WithdrawalRequest>(raw); if (res.success) { setList((p) => p.map((w) => w.id === id ? res.data : w)); showToast('Approved!', 'success'); } } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed.', 'error'); } finally { setProcessing(null); } };
  const reject = async (id: string) => { setProcessing(id); try { const raw = await withdrawals.reject(id, { note: 'Rejected via admin panel' }); const res = normalise<WithdrawalRequest>(raw); if (res.success) { setList((p) => p.map((w) => w.id === id ? res.data : w)); showToast('Rejected.', 'success'); } } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed.', 'error'); } finally { setProcessing(null); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-heading text-xl font-bold text-white">Withdrawals</h2><button onClick={load} className="p-1.5 rounded-xl bg-slate-700 text-slate-400 hover:bg-slate-600"><RefreshIcon fontSize="small" /></button></div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>{([undefined, 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => <button key={String(s)} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${statusFilter === s ? 'bg-primary text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{s ?? 'All'}</button>)}</div>
      {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
        : fetchError ? <ErrorState text={fetchError} onRetry={load} />
        : list.length === 0 ? <EmptyState icon={<PaymentsIcon sx={{ fontSize: 40 }} />} text="No withdrawals found." />
        : <div className="space-y-2">{list.map((w) => <div key={w.id} className="bg-slate-800 rounded-2xl p-3 border border-slate-700 flex items-center justify-between gap-3"><div className="flex-1 min-w-0"><p className="text-sm font-bold text-white truncate">{w.user?.firstName ?? ''} {w.user?.lastName ?? ''} · {fmt(w.amount, currency)}</p><p className="text-xs text-slate-400 truncate">{w.method} · {w.accountNumber}</p><p className="text-xs text-slate-500">{fmtDate(w.createdAt)}</p></div><div className="flex items-center gap-2 shrink-0"><StatusBadge status={w.status} />{w.status === 'PENDING' && (<><button disabled={processing === w.id} onClick={() => approve(w.id)} className="p-1.5 rounded-lg bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-50">{processing === w.id ? <Spinner /> : <CheckIcon fontSize="small" />}</button><button disabled={processing === w.id} onClick={() => reject(w.id)} className="p-1.5 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-50"><BlockIcon fontSize="small" /></button></>)}</div></div>)}</div>}
    </div>
  );
}

// ─── Section: Upgrade Chats ───────────────────────────────────────────────────

function UpgradeChatsSection({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [chats, setChats] = useState<AdminUpgradeChatDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<AdminUpgradeChatDto | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try { const fn = filter === 'pending' ? superAdminUpgradeChats.getPending : superAdminUpgradeChats.getAll; const raw = await fn(); const res = normalise<AdminUpgradeChatDto[]>(raw); if (res.success) setChats(Array.isArray(res.data) ? res.data : []); }
    catch { /* silent */ } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  if (activeChat) return <div className="h-full -m-3 sm:-m-5 md:-m-6 flex flex-col"><UpgradeChatPanel chat={activeChat} isSuperAdmin={isSuperAdmin} onClose={() => { setActiveChat(null); load(); }} onCommissionSet={() => { load(); }} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><h2 className="font-heading text-xl font-bold text-white">Upgrade Chats</h2>{chats.length > 0 && <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">{chats.length}</span>}</div><button onClick={load} className="p-1.5 rounded-xl bg-slate-700 text-slate-400 hover:bg-slate-600"><RefreshIcon fontSize="small" /></button></div>
      <div className="flex gap-2">{(['pending','all'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{f === 'pending' ? 'Pending' : 'All'}</button>)}</div>
      {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
        : chats.length === 0 ? <EmptyState icon={<MarkChatReadIcon sx={{ fontSize: 40 }} />} text={filter === 'pending' ? 'No pending chats.' : 'No upgrade chats.'} />
        : <div className="space-y-2">{chats.map((chat) => {
            const displayRate = (chat as any).commissionRate ?? (chat as any).commission_percent ?? null;
            return (
              <button key={chat.id} onClick={() => setActiveChat(chat)} className="w-full bg-slate-800 rounded-2xl p-3 border border-slate-700 hover:border-primary/40 text-left flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1"><p className="text-sm font-bold text-white truncate">{chat.userFirstName ?? 'User'}</p><StatusBadge status={chat.status} /></div>
                  <p className="text-xs text-slate-400 truncate">{chat.userEmail ?? '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {chat.messageCount ?? 0} msgs · {fmtDate(chat.createdAt)}
                    {displayRate != null ? ` · ${displayRate}%` : ''}
                  </p>
                </div>
                <ChatIcon fontSize="small" className="text-slate-500 shrink-0" />
              </button>
            );
          })}</div>}
    </div>
  );
}

// ─── Section: Payouts ─────────────────────────────────────────────────────────

function PayoutsSection() {
  const { showToast } = useAppStore();
  const { currency } = useCurrency();
  const [list, setList] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const raw = await superAdminPayouts.getPending(); const res = normalise<PayoutRequest[]>(raw); if (res.success) setList(Array.isArray(res.data) ? res.data : []); }
    catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const action = async (id: string, type: 'approve' | 'reject' | 'markPaid') => {
    setProcessing(id);
    try { let raw; if (type === 'approve') raw = await superAdminPayouts.approve(id); else if (type === 'reject') raw = await superAdminPayouts.reject(id, { reason: 'Rejected via admin panel' }); else raw = await superAdminPayouts.markPaid(id); const res = normalise<PayoutRequest>(raw); if (res.success) { setList((p) => p.map((r) => r.id === id ? res.data : r)); showToast('Done!', 'success'); } }
    catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Failed.', 'error'); }
    finally { setProcessing(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-heading text-xl font-bold text-white">Payout Requests</h2><button onClick={load} className="p-1.5 rounded-xl bg-slate-700 text-slate-400 hover:bg-slate-600"><RefreshIcon fontSize="small" /></button></div>
      {loading ? <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
        : list.length === 0 ? <EmptyState icon={<AttachMoneyIcon sx={{ fontSize: 40 }} />} text="No payout requests." />
        : <div className="space-y-2">{list.map((pr) => <div key={pr.id} className="bg-slate-800 rounded-2xl p-3 border border-slate-700"><div className="flex items-center justify-between gap-3 mb-3"><div className="flex-1 min-w-0"><p className="text-sm font-bold text-white">{fmt(pr.amount, currency)}</p><p className="text-xs text-slate-400">{fmtDate(pr.createdAt)}</p></div><StatusBadge status={pr.status} /></div>{(pr.status === 'REQUESTED' || pr.status === 'APPROVED') && <div className="flex gap-2">{pr.status === 'REQUESTED' && (<><button disabled={processing === pr.id} onClick={() => action(pr.id, 'approve')} className="flex-1 py-1.5 rounded-xl bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">{processing === pr.id ? <Spinner /> : <><CheckIcon fontSize="small" /> Approve</>}</button><button disabled={processing === pr.id} onClick={() => action(pr.id, 'reject')} className="flex-1 py-1.5 rounded-xl bg-red-900/30 text-red-400 hover:bg-red-900/50 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"><BlockIcon fontSize="small" /> Reject</button></>)}{pr.status === 'APPROVED' && <button disabled={processing === pr.id} onClick={() => action(pr.id, 'markPaid')} className="flex-1 py-1.5 rounded-xl bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">{processing === pr.id ? <Spinner /> : <><AttachMoneyIcon fontSize="small" /> Mark Paid</>}</button>}</div>}</div>)}</div>}
    </div>
  );
}

// ─── Main AdminModal ──────────────────────────────────────────────────────────

export default function AdminModal() {
  const { isAdminModalOpen, setAdminModalOpen, setModalOpen, user } = useAppStore();
  const [activeSection, setActiveSection] = useState<SectionKey>('affiliate');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setModalOpen(isAdminModalOpen);
    return () => setModalOpen(false);
  }, [isAdminModalOpen, setModalOpen]);

  const handleSectionChange = (key: SectionKey) => {
    setActiveSection(key);
    setMobileSidebarOpen(false);
  };

  if (!isAdminModalOpen || !user) return null;

  const role = user.role as string;
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'super_admin';

  const sections: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
    { key: 'affiliate',     label: 'Home',          icon: <GroupAddIcon fontSize="small" /> },
    { key: 'dashboard',     label: 'Analytics',     icon: <BarChartIcon fontSize="small" /> },
    { key: 'matches',       label: 'Matches',       icon: <SportsSoccerIcon fontSize="small" /> },
    { key: 'bookings',      label: 'Codes',         icon: <QrCodeIcon fontSize="small" /> },
    { key: 'withdrawals',   label: 'Withdrawals',   icon: <PaymentsIcon fontSize="small" /> },
    { key: 'upgrade-chats', label: 'Chats',         icon: <ChatIcon fontSize="small" /> },
    { key: 'payouts',       label: 'Payouts',       icon: <AttachMoneyIcon fontSize="small" /> },
  ];

  const activeLabel = sections.find(s => s.key === activeSection)?.label ?? '';

  return (
    <div className="fixed inset-0 z-[9998] bg-slate-900 flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-slate-700 shrink-0 bg-slate-900" style={{ minHeight: 52 }}>
        <div className="flex items-center gap-2">
          <button
            className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white mr-1"
            onClick={() => setMobileSidebarOpen(v => !v)}
          >
            <MenuIcon fontSize="small" />
          </button>
          {isSuperAdmin
            ? <SupervisorAccountIcon className="text-purple-400 hidden sm:block" fontSize="small" />
            : <AdminPanelSettingsIcon className="text-primary hidden sm:block" fontSize="small" />
          }
          <h1 className="font-heading text-sm sm:text-base font-bold text-white truncate">
            <span className="hidden sm:inline">{isSuperAdmin ? 'Super Admin' : 'Admin'} · </span>
            {activeLabel}
          </h1>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md hidden xs:inline ${isSuperAdmin ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-900/30 text-blue-400'}`}>
            {isSuperAdmin ? 'SUPER' : 'ADMIN'}
          </span>
        </div>
        <button onClick={() => setAdminModalOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 shrink-0">
          <CloseIcon fontSize="small" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Mobile sidebar overlay ── */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="md:hidden fixed inset-0 bg-black/60 z-30"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <motion.nav
                initial={{ x: -240 }}
                animate={{ x: 0 }}
                exit={{ x: -240 }}
                transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                className="md:hidden fixed top-[52px] left-0 bottom-0 w-56 z-40 bg-slate-800 border-r border-slate-700 p-3 flex flex-col gap-1 overflow-y-auto"
              >
                {sections.map((section) => (
                  <button
                    key={section.key}
                    onClick={() => handleSectionChange(section.key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${activeSection === section.key ? 'bg-primary text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700'}`}
                  >
                    {section.icon}{section.label}
                  </button>
                ))}
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        {/* ── Desktop sidebar ── */}
        <nav className="hidden md:flex w-52 flex-col border-r border-slate-700 bg-slate-800 p-3 gap-1 shrink-0 overflow-y-auto">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${activeSection === section.key ? 'bg-primary text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700'}`}
            >
              {section.icon}{section.label}
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-slate-900">
          {activeSection === 'affiliate'     && <AffiliateSection userEmail={user.email} />}
          {activeSection === 'dashboard'     && <DashboardSection isSuperAdmin={isSuperAdmin} />}
          {activeSection === 'matches'       && <MatchesSection />}
          {activeSection === 'bookings'      && <BookingsSection />}
          {activeSection === 'withdrawals'   && <WithdrawalsSection />}
          {activeSection === 'upgrade-chats' && <UpgradeChatsSection isSuperAdmin={isSuperAdmin} />}
          {activeSection === 'payouts'       && <PayoutsSection />}
        </div>
      </div>
    </div>
  );
}