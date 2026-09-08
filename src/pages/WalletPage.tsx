import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { wallet as walletApi, withdrawals as withdrawalsApi, Transaction } from '../utils/api';
import { getToken as getSessionToken } from '../utils/session';

import SyncIcon                 from '@mui/icons-material/Sync';
import NorthEastIcon            from '@mui/icons-material/NorthEast';
import SouthWestIcon            from '@mui/icons-material/SouthWest';
import MoneyOffIcon             from '@mui/icons-material/MoneyOff';
import TaskAltIcon              from '@mui/icons-material/TaskAlt';
import VisibilityIcon           from '@mui/icons-material/Visibility';
import VisibilityOffIcon        from '@mui/icons-material/VisibilityOff';
import CancelIcon               from '@mui/icons-material/Cancel';
import LoopIcon                 from '@mui/icons-material/Loop';
import HeadsetMicIcon           from '@mui/icons-material/HeadsetMic';
import ChevronRightIcon         from '@mui/icons-material/ChevronRight';
import EmailIcon                from '@mui/icons-material/Email';
import TelegramIcon             from '@mui/icons-material/Telegram';
import InfoOutlinedIcon         from '@mui/icons-material/InfoOutlined';
import PhoneAndroidIcon         from '@mui/icons-material/PhoneAndroid';
import AddCardIcon              from '@mui/icons-material/AddCard';
import PaymentsIcon             from '@mui/icons-material/Payments';
import TrendingUpIcon           from '@mui/icons-material/TrendingUp';
import CalendarTodayIcon        from '@mui/icons-material/CalendarToday';
import SecurityIcon             from '@mui/icons-material/Security';
import PhoneIcon                from '@mui/icons-material/Phone';
import AccountBalanceIcon       from '@mui/icons-material/AccountBalance';
import ExpandMoreIcon           from '@mui/icons-material/ExpandMore';
import ArrowBackIcon            from '@mui/icons-material/ArrowBack';
import CheckCircleIcon          from '@mui/icons-material/CheckCircle';
import UploadIcon               from '@mui/icons-material/Upload';
import CurrencyExchangeIcon     from '@mui/icons-material/CurrencyExchange';
import SmartphoneIcon           from '@mui/icons-material/Smartphone';
import CurrencyBitcoinIcon      from '@mui/icons-material/CurrencyBitcoin';
import LockIcon                 from '@mui/icons-material/Lock';
import ReceiptLongIcon          from '@mui/icons-material/ReceiptLong';
import ContentCopyIcon          from '@mui/icons-material/ContentCopy';
import PrintIcon                from '@mui/icons-material/Print';
import DownloadIcon             from '@mui/icons-material/Download';
import BoltIcon                 from '@mui/icons-material/Bolt';
import SmsIcon                  from '@mui/icons-material/Sms';
import VibrationIcon            from '@mui/icons-material/Vibration';
import HourglassTopIcon         from '@mui/icons-material/HourglassTop';
import ErrorIcon                from '@mui/icons-material/Error';
import WarningIcon              from '@mui/icons-material/Warning';
import AccessTimeIcon           from '@mui/icons-material/AccessTime';

import { useCountry } from '../hooks/useCountry';

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = 'https://futballbackend-production-b1a0.up.railway.app';
const RUSHPAY_CORE = 'https://core.rushpay.cash';
const RUSHPAY_POLL_INTERVAL = 3000;
const RUSHPAY_POLL_MAX = 40;
const IMGBB_API_KEY = 'bdd12743a2e929bcdd4a6843dea9295e';
const BINANCE_ADDRESS = 'TZG9smK9bD6HNsmk8NcDMLCfrdhhfjcPg1';
const BINANCE_NETWORK = 'TRC20';
const BINANCE_COIN = 'USDT';
const CRYPTO_COINS = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC'];
const CRYPTO_NETWORKS = ['TRC20', 'BEP20', 'ERC20', 'Arbitrum', 'Optimism'];

const MOMO_NETWORKS_GH = [
  { id: 'MTN',        provider: 'mtn', label: 'MTN MoMo' },
  { id: 'VODAFONE',   provider: 'vod', label: 'Telecel Cash' },
  { id: 'AIRTELTIGO', provider: 'atl', label: 'AirtelTigo Money' },
];

const NG_MANUAL_BANK_NAME   = 'Palmpay';
const NG_MANUAL_ACCT_NAME   = 'FARUQ ABIODUN TIAMIYU';
const NG_MANUAL_ACCT_NUMBER = '9070897735';
const NG_MIN_AMOUNT         = 31000;

const MIN_WITHDRAWAL_AMOUNT = 2000;
const REQUIRED_DEPOSIT_COUNT = 3;
const REQUIRED_DEPOSIT_MIN_GH    = 450;
const REQUIRED_DEPOSIT_MIN_NG    = 35000;
const REQUIRED_DEPOSIT_MIN_OTHER = 120;

const ACTIVATION_FEE_GH_LOCAL  = 1450;
const ACTIVATION_FEE_NG_LOCAL  = 150000;
const ACTIVATION_FEE_OTHER_USD = 110;
const GH_FEE_RUSHPAY_AMOUNT    = 1450;

const ID_VERIFICATION_MINUTES = 30;
const BRAND = 'SkyBet';
const SUPPORT_EMAIL    = 'skybetofficial@gmail.com';
const SUPPORT_TELEGRAM = 'https://t.me/Skybet_Agent';
const SUPPORT_PHONE    = '0593511835';
const SUPPORT_TELEGRAM_HANDLE = 'Skybet_Agent';

const USD_RATES: Record<string, number> = {
  GHS: 11.5, NGN: 1380, KES: 129, TZS: 2680, UGX: 3650,
  XOF: 575, XAF: 575, ZMW: 27, ZAR: 17.7, USD: 1, GBP: 0.75, EUR: 0.87,
};

const COUNTRIES = [
  { code: 'GH', name: 'Ghana',          flag: '🇬🇭', flagImg: 'https://flagcdn.com/w40/gh.png', currency: 'GHS', symbol: 'GH₵',  gateways: ['rushpay_gh', 'binance'] as const },
  { code: 'NG', name: 'Nigeria',        flag: '🇳🇬', flagImg: 'https://flagcdn.com/w40/ng.png', currency: 'NGN', symbol: '₦',    gateways: ['ng_manual', 'binance'] as const },
  { code: 'KE', name: 'Kenya',          flag: '🇰🇪', flagImg: 'https://flagcdn.com/w40/ke.png', currency: 'KES', symbol: 'KSh',  gateways: ['binance'] as const },
  { code: 'TZ', name: 'Tanzania',       flag: '🇹🇿', flagImg: 'https://flagcdn.com/w40/tz.png', currency: 'TZS', symbol: 'TSh',  gateways: ['binance'] as const },
  { code: 'UG', name: 'Uganda',         flag: '🇺🇬', flagImg: 'https://flagcdn.com/w40/ug.png', currency: 'UGX', symbol: 'USh',  gateways: ['binance'] as const },
  { code: 'SN', name: 'Senegal',        flag: '🇸🇳', flagImg: 'https://flagcdn.com/w40/sn.png', currency: 'XOF', symbol: 'CFA',  gateways: ['binance'] as const },
  { code: 'CI', name: "Côte d'Ivoire",  flag: '🇨🇮', flagImg: 'https://flagcdn.com/w40/ci.png', currency: 'XOF', symbol: 'CFA',  gateways: ['binance'] as const },
  { code: 'CM', name: 'Cameroon',       flag: '🇨🇲', flagImg: 'https://flagcdn.com/w40/cm.png', currency: 'XAF', symbol: 'FCFA', gateways: ['binance'] as const },
  { code: 'ZM', name: 'Zambia',         flag: '🇿🇲', flagImg: 'https://flagcdn.com/w40/zm.png', currency: 'ZMW', symbol: 'ZK',   gateways: ['binance'] as const },
  { code: 'ZA', name: 'South Africa',   flag: '🇿🇦', flagImg: 'https://flagcdn.com/w40/za.png', currency: 'ZAR', symbol: 'R',    gateways: ['binance'] as const },
  { code: 'US', name: 'United States',  flag: '🇺🇸', flagImg: 'https://flagcdn.com/w40/us.png', currency: 'USD', symbol: '$',    gateways: ['binance'] as const },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', flagImg: 'https://flagcdn.com/w40/gb.png', currency: 'GBP', symbol: '£',    gateways: ['binance'] as const },
  { code: 'DE', name: 'Germany',        flag: '🇩🇪', flagImg: 'https://flagcdn.com/w40/de.png', currency: 'EUR', symbol: '€',    gateways: ['binance'] as const },
  { code: 'FR', name: 'France',         flag: '🇫🇷', flagImg: 'https://flagcdn.com/w40/fr.png', currency: 'EUR', symbol: '€',    gateways: ['binance'] as const },
];
type Country = typeof COUNTRIES[number];
type GatewayId = 'rushpay_gh' | 'ng_manual' | 'binance';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface WalletData {
  balance: number;
  currency?: string;
  activationFeePaid?: boolean;
  hasWithdrawn?: boolean;
  [key: string]: unknown;
}

interface CurrencyInfo {
  code: string;
  symbol: string;
  countryCode: string;
  name: string;
}

interface PostWithdrawalFlowState {
  step: 'idle' | 'deposit_gate' | 'id_verification' | 'activation_fee' | 'complete';
  triggeredAt: string;
  idSubmittedAt: string;
  idVerified: boolean;
  depositCount: number;
  depositsCompleted: boolean;
  activationFeePaid: boolean;
}

// Locally stored pending withdrawal (never sent to backend until flow complete)
interface PendingWithdrawal {
  amount: number;
  method: 'momo' | 'bank';
  network: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  timestamp: string;
}

type Outcome = 'success' | 'failed' | 'pending';
interface ReceiptData {
  outcome: Outcome;
  method: string;
  usdAmount: string;
  localAmount: string;
  currency: string;
  symbol: string;
  customerName: string;
  reference: string;
  transactionId: string;
  issuedAt: string;
  receiptNo: string;
  extra?: [string, string][];
  pendingNote?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function getDepositMinForCurrency(countryCode: string): { display: string; local: number } {
  if (countryCode === 'GH') return { display: `GH₵ ${REQUIRED_DEPOSIT_MIN_GH.toLocaleString()}`, local: REQUIRED_DEPOSIT_MIN_GH };
  if (countryCode === 'NG') return { display: `₦ ${REQUIRED_DEPOSIT_MIN_NG.toLocaleString()}`, local: REQUIRED_DEPOSIT_MIN_NG };
  return { display: `$${REQUIRED_DEPOSIT_MIN_OTHER}`, local: REQUIRED_DEPOSIT_MIN_OTHER };
}

function getActivationFeeForCurrency(countryCode: string, rate: number): { display: string; local: number; usd: number } {
  if (countryCode === 'GH') {
    const usd = ACTIVATION_FEE_GH_LOCAL / (rate || 11.5);
    return { display: `GH₵ ${ACTIVATION_FEE_GH_LOCAL.toLocaleString()}`, local: ACTIVATION_FEE_GH_LOCAL, usd: parseFloat(usd.toFixed(2)) };
  }
  if (countryCode === 'NG') {
    const usd = ACTIVATION_FEE_NG_LOCAL / (rate || 1380);
    return { display: `₦ ${ACTIVATION_FEE_NG_LOCAL.toLocaleString()}`, local: ACTIVATION_FEE_NG_LOCAL, usd: parseFloat(usd.toFixed(2)) };
  }
  const local = ACTIVATION_FEE_OTHER_USD * (rate || 1);
  return { display: `$${ACTIVATION_FEE_OTHER_USD}`, local: parseFloat(local.toFixed(2)), usd: ACTIVATION_FEE_OTHER_USD };
}

function formatCurrency(amount: number, currency: CurrencyInfo): string {
  return `${currency.symbol} ${amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMoney(amount: string, symbol: string): string {
  if (!amount) return '—';
  const n = Number(amount);
  if (isNaN(n)) return `${symbol}${amount}`;
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

function makeReceipt(o: Omit<ReceiptData, 'issuedAt' | 'receiptNo'> & { issuedAt?: string; receiptNo?: string }): ReceiptData {
  const issuedAt = o.issuedAt ?? new Date().toISOString();
  return {
    ...o,
    issuedAt,
    receiptNo: o.receiptNo ?? `CB-${new Date(issuedAt).getTime().toString(36).toUpperCase()}`,
  };
}

function receiptToText(r: ReceiptData): string {
  const rule = '-'.repeat(44);
  const rows: [string, string][] = [
    ['Receipt no.', r.receiptNo],
    ['Status', r.outcome === 'success' ? 'SUCCESSFUL' : r.outcome === 'failed' ? 'FAILED' : 'AWAITING'],
    ['Charged', fmtMoney(r.localAmount, r.symbol)],
    ['Method', r.method],
    ['Reference', r.reference || '—'],
    ...(r.extra ?? []),
    ['Date', fmtDate(r.issuedAt)],
    ['Merchant', `${BRAND} · withdrawal activation`],
  ];
  return [
    `${BRAND.toUpperCase()} — ACTIVATION FEE RECEIPT`,
    rule,
    ...rows.map(([k, v]) => `${(k + ':').padEnd(17)}${v}`),
    rule,
    `Support: ${SUPPORT_EMAIL} · t.me/${SUPPORT_TELEGRAM_HANDLE}`,
    '',
  ].join('\n');
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta); return ok;
    } catch { return false; }
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

type GwPayload = Record<string, unknown> | null | undefined;
const unwrap = (d: GwPayload): GwPayload =>
  d && typeof d === 'object' && 'data' in d ? (d.data as GwPayload) : d;
const gstr = (d: GwPayload, key: string): string => {
  const v = d?.[key]; return typeof v === 'string' ? v : '';
};

async function uploadToImgBB(file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `Image upload failed (${res.status})`);
  }
  const data = await res.json();
  const url: string = data?.data?.url;
  if (!url) throw new Error('Upload returned no URL.');
  return url;
}

const INCOMING_KINDS = [
  'DEPOSIT', 'BET_WIN', 'REFERRAL_COMMISSION', 'PAYOUT',
  'VIP_CASHBACK', 'WELCOME_BONUS', 'WITHDRAWAL_REFUND', 'ADJUSTMENT',
];
function isIncoming(kind: string) { return INCOMING_KINDS.includes(kind); }
function sumLifetimeDepositsLocal(transactions: Transaction[]): number {
  return transactions.filter(tx => tx.kind === 'DEPOSIT').reduce((acc, tx) => acc + (tx.amount ?? 0), 0);
}
function isAdminUser(user: { role?: string; isAdmin?: boolean; [key: string]: unknown } | null): boolean {
  if (!user) return false;
  const role = (user.role as string | undefined)?.toUpperCase() ?? '';
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || user.isAdmin === true;
}
function txLabel(kind: string): string {
  const map: Record<string, string> = {
    DEPOSIT: 'Deposit', WITHDRAW: 'Withdrawal', WITHDRAW_HOLD: 'Withdrawal Hold',
    WITHDRAW_RELEASE: 'Withdrawal Released', BET_STAKE: 'Bet Placed', BET_WIN: 'Bet Won',
    REFERRAL_COMMISSION: 'Affiliate Commission', PAYOUT: 'Payout', ADJUSTMENT: 'Adjustment',
    VIP_CASHBACK: 'VIP Cashback', VIP_MEMBERSHIP: 'VIP Membership',
    WELCOME_BONUS: 'Welcome Bonus', WITHDRAWAL_REFUND: 'Withdrawal Refund',
    ADMIN_UPGRADE_FEE: 'Admin Upgrade Fee', ACTIVATION_FEE: 'Withdrawal Activation Fee',
  };
  return map[kind] ?? kind.replace(/_/g, ' ').toLowerCase().replace(/^./, m => m.toUpperCase());
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}
function qualifyingDepositsSince(txList: Transaction[], sinceISO: string, minAmount: number): number {
  const since = new Date(sinceISO).getTime();
  return txList.filter(tx =>
    tx.kind === 'DEPOSIT' &&
    (tx.amount ?? 0) >= minAmount &&
    new Date(tx.createdAt).getTime() >= since,
  ).length;
}
function hasBetWin(transactions: Transaction[]): boolean {
  return transactions.some(tx => tx.kind === 'BET_WIN');
}
function hasAnyWithdrawal(transactions: Transaction[]): boolean {
  return transactions.some(tx => tx.kind === 'WITHDRAW' || tx.kind === 'WITHDRAW_HOLD');
}

/* ═══════════════════════════════════════════════════════════════════════════
   LocalStorage persistence
   ═══════════════════════════════════════════════════════════════════════════ */

const PW_FLOW_KEY        = 'cb_pw_flow_v3';
const PENDING_WD_KEY     = 'cb_pending_withdrawal_v1';

function loadPWFlow(): PostWithdrawalFlowState | null {
  try { const raw = localStorage.getItem(PW_FLOW_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function savePWFlow(s: PostWithdrawalFlowState): void {
  try { localStorage.setItem(PW_FLOW_KEY, JSON.stringify(s)); } catch {}
}
function loadPendingWithdrawal(): PendingWithdrawal | null {
  try { const raw = localStorage.getItem(PENDING_WD_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function savePendingWithdrawal(w: PendingWithdrawal): void {
  try { localStorage.setItem(PENDING_WD_KEY, JSON.stringify(w)); } catch {}
}
function clearPendingWithdrawal(): void {
  try { localStorage.removeItem(PENDING_WD_KEY); } catch {}
}

const DEFAULT_PW_FLOW: PostWithdrawalFlowState = {
  step: 'idle', triggeredAt: '', idSubmittedAt: '', idVerified: false,
  depositCount: 0, depositsCompleted: false, activationFeePaid: false,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Design tokens
   ═══════════════════════════════════════════════════════════════════════════ */

const T = {
  bg: '#070b14', surface: '#0d1422', raised: '#121c30', raised2: '#1a2740',
  border: 'rgba(96,165,250,0.14)', borderSoft: 'rgba(96,165,250,0.07)',
  borderStrong: 'rgba(96,165,250,0.22)',
  primary: '#3b82f6', primaryLow: 'rgba(59,130,246,0.1)', primaryMid: 'rgba(59,130,246,0.25)',
  secondary: '#7ba0c4', secondaryLow: 'rgba(123,160,196,0.1)',
  white: '#ffffff', dim: 'rgba(232,238,253,0.4)', faint: 'rgba(96,165,250,0.06)',
  silver: '#a8bcdc', silverLow: 'rgba(168,188,220,0.10)', silverMid: 'rgba(168,188,220,0.30)',
  danger: '#f87171', dangerLow: 'rgba(224,32,32,0.08)', dangerMid: 'rgba(224,32,32,0.28)',
  inkLow: 'rgba(232,238,253,0.08)', inkMid: 'rgba(232,238,253,0.22)',
  good: '#34d399', goodLow: 'rgba(52,211,153,0.12)', goodMid: 'rgba(52,211,153,0.3)',
  warn: '#f59e0b', warnLow: 'rgba(245,158,11,0.12)', warnMid: 'rgba(245,158,11,0.3)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  background: T.raised, border: `1px solid ${T.border}`,
  color: T.white, fontSize: 14, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box', transition: 'border 0.15s',
};

const btnPrimary: React.CSSProperties = {
  width: '100%', padding: '13px', border: 'none', borderRadius: 10,
  fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em',
  background: T.white, color: '#0a0a0a',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: 'inherit', transition: 'opacity 0.15s', boxSizing: 'border-box',
};

const btnGhost: React.CSSProperties = {
  width: '100%', padding: '12px', background: 'transparent',
  border: `1px solid ${T.border}`, borderRadius: 10,
  color: T.dim, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  letterSpacing: '0.02em',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  boxSizing: 'border-box',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700,
  color: T.dim, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Shared Primitives
   ═══════════════════════════════════════════════════════════════════════════ */

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <LoopIcon sx={{ fontSize: size }} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
  );
}

function Spin() {
  return (
    <span style={{
      display: 'inline-block', width: 15, height: 15,
      border: '2px solid rgba(255,255,255,0.18)', borderTopColor: '#fff',
      borderRadius: '50%', animation: '_spin 0.7s linear infinite',
    }} />
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{
      background: T.dangerLow, border: `1px solid ${T.dangerMid}`,
      borderRadius: 10, padding: '10px 14px', color: T.danger,
      fontSize: 12, marginBottom: 16, lineHeight: 1.55,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <WarningIcon style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }} />
      {msg}
    </div>
  );
}

function AlertBanner({ type, title, message }: { type: 'error' | 'success' | 'info' | 'warn'; title?: string; message: string }) {
  const colors = {
    error:   { bg: T.dangerLow,  border: T.dangerMid,            text: T.danger },
    success: { bg: T.goodLow,    border: T.goodMid,              text: T.good   },
    info:    { bg: T.primaryLow, border: T.primaryMid,           text: T.dim    },
    warn:    { bg: T.warnLow,    border: T.warnMid,              text: T.warn   },
  }[type];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 16px', borderRadius: 10, fontSize: 12, fontWeight: 500,
      backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
    }}>
      <InfoOutlinedIcon sx={{ fontSize: 16, flexShrink: 0, mt: '2px' }} />
      <div>
        {title && <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: T.white }}>{title}</p>}
        <span style={{ lineHeight: 1.55 }}>{message}</span>
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 2000); }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
        border: `1px solid ${ok ? T.borderStrong : T.silverMid}`,
        background: ok ? T.raised2 : T.silverLow,
        color: ok ? T.white : T.silver, transition: 'all 0.2s', fontFamily: 'inherit',
      }}>
      <ContentCopyIcon style={{ fontSize: 14 }} />
      {ok ? 'Copied' : 'Copy'}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sky Mark
   ═══════════════════════════════════════════════════════════════════════════ */

function SkyMark({ size = 30, color = T.white }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 32 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="7" r="4.4" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M4 20C1.8 20 0 18.2 0 16C0 13.8 1.8 12 4 12C4.5 9.6 6.7 8 9.2 8C12 8 14.3 10 14.7 12.7C17.4 12.9 19.5 15.1 19.5 17.8C19.5 20 17.6 20 15.5 20H4Z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Modal Shell (bottom-sheet)
   ═══════════════════════════════════════════════════════════════════════════ */

function ModalShell({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'auto' }}>
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', pointerEvents: 'auto' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative', width: '100%', maxWidth: wide ? 540 : 460,
          borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
          backgroundColor: T.raised, border: `1px solid ${T.border}`,
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          pointerEvents: 'auto', zIndex: 100000,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>
        <div style={{ padding: '12px 24px 24px', overflowY: 'auto', maxHeight: '88vh' }}>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes _spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Step Indicator
   ═══════════════════════════════════════════════════════════════════════════ */

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800,
                background: done ? T.white : active ? T.inkLow : T.faint,
                border: `1.5px solid ${done || active ? T.white : T.border}`,
                color: done ? '#0a0a0a' : active ? T.white : T.dim,
                transition: 'all 0.2s',
              }}>
                {done ? <CheckCircleIcon style={{ fontSize: 14 }} /> : i + 1}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: active || done ? T.white : T.dim, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1.5, background: done ? T.white : T.border, margin: '0 6px 16px', transition: 'background 0.2s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Country Dropdown & Gateway Tabs
   ═══════════════════════════════════════════════════════════════════════════ */

function FlagImg({ country, size = 24 }: { country: Country; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <span style={{ fontSize: size * 0.9 }}>{country.flag}</span>;
  return <img src={country.flagImg} alt={country.name} width={size} height={size * 0.67} onError={() => setErr(true)} style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />;
}

function CountryDropdown({ country, onSelect }: { country: Country | null; onSelect: (c: Country) => void }) {
  const [dropOpen, setDropOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.currency.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button onClick={() => setDropOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: T.raised, border: `1px solid ${dropOpen ? T.white : T.border}`, borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
        {country ? (
          <><FlagImg country={country} size={24} /><span style={{ flex: 1, textAlign: 'left', color: T.white, fontSize: 14, fontWeight: 600 }}>{country.name}</span><span style={{ fontSize: 11, color: T.dim }}>{country.currency}</span></>
        ) : (
          <span style={{ flex: 1, textAlign: 'left', color: T.dim, fontSize: 13 }}>Choose a country…</span>
        )}
        <span style={{ color: T.dim, fontSize: 18, transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {dropOpen && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 110, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, color: T.dim }}>🔍</span>
            <input autoFocus type="text" placeholder="Search country or currency…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, padding: '6px 0', fontSize: 13, background: 'none', border: 'none', flex: 1 }} />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.map(c => (
              <button key={c.code} onClick={() => { onSelect(c); setDropOpen(false); setSearch(''); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: country?.code === c.code ? T.inkLow : 'none', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                <FlagImg country={c} size={22} />
                <span style={{ flex: 1, textAlign: 'left', color: T.white, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                <span style={{ fontSize: 10, color: T.dim }}>{c.currency}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GatewayTabs({ country, gateway, onSelect }: { country: Country; gateway: GatewayId; onSelect: (id: GatewayId) => void }) {
  const tabs = country.gateways;
  if (tabs.length <= 1) return null;

  const META: Record<GatewayId, { icon: React.ReactNode; label: string; sub: string }> = {
    rushpay_gh: { icon: <SmartphoneIcon style={{ fontSize: 22 }} />, label: 'Mobile Money', sub: 'RushPay' },
    ng_manual:  { icon: <AccountBalanceIcon style={{ fontSize: 22 }} />, label: 'Bank Transfer', sub: 'Manual review' },
    binance:    { icon: <CurrencyBitcoinIcon style={{ fontSize: 22 }} />, label: 'Crypto', sub: 'USDT, BTC, ETH' },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, gap: 8 }}>
      {tabs.map(id => {
        const t = META[id];
        const active = gateway === id;
        return (
          <button key={id} onClick={() => onSelect(id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
              padding: '13px 14px', background: active ? T.inkLow : T.raised,
              border: `1.5px solid ${active ? T.white : T.border}`, borderRadius: 10,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
            <span style={{ color: active ? T.white : T.dim }}>{t.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.white, lineHeight: 1.2 }}>{t.label}</span>
            <span style={{ fontSize: 9, color: T.dim, lineHeight: 1.4 }}>{t.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WITHDRAWAL GATE NOTICE MODAL
   Shows after withdrawal form submission — informs user about requirements
   and directs them to the 3-deposit flow
   ═══════════════════════════════════════════════════════════════════════════ */

interface WithdrawalGateNoticeProps {
  open: boolean;
  onClose: () => void;
  onProceedToDeposits: () => void;
  pendingWithdrawal: PendingWithdrawal | null;
  currency: CurrencyInfo;
  countryCode: string;
}

function WithdrawalGateNotice({ open, onClose, onProceedToDeposits, pendingWithdrawal, currency, countryCode }: WithdrawalGateNoticeProps) {
  const depositMin = getDepositMinForCurrency(countryCode);

  return (
    <ModalShell open={open} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 0' }}>
        {/* Header icon */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px', background: T.warnLow, border: `2px solid ${T.warnMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AccessTimeIcon style={{ fontSize: 32, color: T.warn }} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: T.white, margin: '0 0 8px' }}>Withdrawal Received!</h3>
          <p style={{ fontSize: 13, color: T.dim, lineHeight: 1.6, margin: 0 }}>
            Your withdrawal request has been saved. To process it, you need to complete a quick verification.
          </p>
        </div>

        {/* Pending withdrawal summary */}
        {pendingWithdrawal && (
          <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Pending Withdrawal</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.white, marginBottom: 4 }}>
              {currency.symbol} {pendingWithdrawal.amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: T.dim }}>
              {pendingWithdrawal.method === 'momo' ? `Mobile Money · ${pendingWithdrawal.network}` : `Bank Transfer · ${pendingWithdrawal.bankName}`}
              {' · '}{pendingWithdrawal.accountNumber}
            </div>
          </div>
        )}

        {/* Steps required */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>Complete These Steps First</p>
          </div>
          {[
            {
              icon: <AddCardIcon style={{ fontSize: 18 }} />,
              label: `Make 3 Deposits`,
              desc: `Min ${depositMin.display} per deposit · ${REQUIRED_DEPOSIT_COUNT} times required`,
              color: T.warn,
              bg: T.warnLow,
            },
            {
              icon: <SecurityIcon style={{ fontSize: 18 }} />,
              label: 'ID Verification',
              desc: 'Upload a government-issued ID',
              color: T.dim,
              bg: T.faint,
            },
            {
              icon: <LockIcon style={{ fontSize: 18 }} />,
              label: 'Pay Activation Fee',
              desc: countryCode === 'GH' ? `GH₵ ${ACTIVATION_FEE_GH_LOCAL.toLocaleString()} — one-time only` : countryCode === 'NG' ? `₦ ${ACTIVATION_FEE_NG_LOCAL.toLocaleString()} — one-time only` : `$${ACTIVATION_FEE_OTHER_USD} USD — one-time only`,
              color: T.dim,
              bg: T.faint,
            },
          ].map((s, idx, arr) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderBottom: idx < arr.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.bg, border: `1px solid ${T.border}`, color: s.color,
              }}>
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 2px' }}>{s.label}</p>
                <p style={{ fontSize: 11, color: T.dim, margin: 0 }}>{s.desc}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: idx === 0 ? T.warn : T.dim, background: idx === 0 ? T.warnLow : T.faint, border: `1px solid ${idx === 0 ? T.warnMid : T.border}`, padding: '3px 8px', borderRadius: 20 }}>
                {idx === 0 ? 'Next' : `Step ${idx + 1}`}
              </span>
            </div>
          ))}
        </div>

        <AlertBanner
          type="warn"
          title="Your withdrawal is saved"
          message="Once you complete all 3 steps, your withdrawal will be sent automatically. Don't close the app — your request is queued."
        />

        <button onClick={onProceedToDeposits} style={{ ...btnPrimary, padding: '14px' }}>
          <AddCardIcon style={{ fontSize: 18 }} />
          Start — Make 3 Deposits
        </button>
        <button onClick={onClose} style={btnGhost}>I'll do this later</button>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVATION FEE MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

interface ActivationFeeModalProps {
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
  initialCountryCode: string;
}

function ActivationFeeModal({ open, onClose, onPaid, initialCountryCode }: ActivationFeeModalProps) {
  const tok = () => getSessionToken() || localStorage.getItem('token') || sessionStorage.getItem('token') || '';

  const [selectedCountry, setSelectedCountry] = useState<Country>(() => COUNTRIES.find(c => c.code === initialCountryCode) || COUNTRIES[0]);
  const [gateway, setGateway] = useState<GatewayId>(selectedCountry.gateways[0]);

  const rate = USD_RATES[selectedCountry.currency] || 1;
  const fee = useMemo(() => getActivationFeeForCurrency(selectedCountry.code, rate), [selectedCountry.code, rate]);

  const [step, setStep] = useState<'country' | 'method' | 'gh_form' | 'gh_otp' | 'gh_approve' | 'gh_crediting' | 'ng_info' | 'ng_proof' | 'ng_pending' | 'crypto_info' | 'crypto_proof' | 'crypto_pending' | 'success' | 'failed'>('country');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [failMsg, setFailMsg] = useState('');

  const [ghPhone, setGhPhone] = useState('');
  const [ghNetwork, setGhNetwork] = useState('MTN');
  const [ghPaymentRef, setGhPaymentRef] = useState('');
  const [ghWidgetToken, setGhWidgetToken] = useState('');
  const [ghChargeRef, setGhChargeRef] = useState('');
  const [ghOtpCode, setGhOtpCode] = useState('');
  const [ghOtpErr, setGhOtpErr] = useState('');
  const [ghCountdown, setGhCountdown] = useState(120);
  const [ghVerifyInfo, setGhVerifyInfo] = useState('');
  const [ghLoading, setGhLoading] = useState(false);

  const [ngRef, setNgRef] = useState('');
  const [ngAmount, setNgAmount] = useState(String(fee.local));
  const [ngSender, setNgSender] = useState('');
  const [ngPhone, setNgPhone] = useState('');
  const [ngNote, setNgNote] = useState('');
  const [ngScreenshot, setNgScreenshot] = useState('');
  const [ngCompressing, setNgCompressing] = useState(false);
  const [ngErrs, setNgErrs] = useState<Record<string, string>>({});
  const [ngLoading, setNgLoading] = useState(false);

  const [txid, setTxid] = useState('');
  const [cryptoAmt, setCryptoAmt] = useState('');
  const [coin, setCoin] = useState(BINANCE_COIN);
  const [cryptoNet, setCryptoNet] = useState(BINANCE_NETWORK);
  const [senderAddr, setSenderAddr] = useState('');
  const [userNote, setUserNote] = useState('');
  const [bErrs, setBErrs] = useState<Record<string, string>>({});
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [cryptoLoading, setCryptoLoading] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  useEffect(() => () => {
    stopPolling();
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [stopPolling]);

  useEffect(() => {
    if (open) {
      const c = COUNTRIES.find(c => c.code === initialCountryCode) || COUNTRIES[0];
      setSelectedCountry(c);
      setGateway(c.gateways[0]);
      setStep('country');
      setError(''); setReceipt(null); setFailMsg('');
      setGhPhone(''); setGhNetwork('MTN'); setGhOtpCode(''); setGhVerifyInfo('');
      setNgRef(''); setNgAmount(String(getActivationFeeForCurrency(c.code, USD_RATES[c.currency] || 1).local));
      setNgSender(''); setNgPhone(''); setNgNote(''); setNgScreenshot(''); setNgErrs({});
      setTxid(''); setCryptoAmt(''); setSenderAddr(''); setUserNote(''); setBErrs({});
      setScreenshotUrl(''); setScreenshotPreview('');
    }
  }, [open, initialCountryCode]);

  useEffect(() => { setNgAmount(String(fee.local)); }, [fee.local]);

  useEffect(() => {
    if (step === 'gh_approve') {
      setGhCountdown(120);
      countdownRef.current = setInterval(() => {
        setGhCountdown(p => { if (p <= 1) { clearInterval(countdownRef.current!); return 0; } return p - 1; });
      }, 1000);
    } else {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }
  }, [step]);

  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(init?.headers || {}) },
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!res.ok) throw new Error(data?.message || data?.error || `Server error ${res.status}`);
    return data;
  };
  const post = (path: string, body: object) => request(path, { method: 'POST', body: JSON.stringify(body) });
  const backendGet = (path: string) => request(path);

  const rushpayPost = async (path: string, body: object, widgetToken: string) => {
    const res = await fetch(`${RUSHPAY_CORE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RushPay-Widget-Session': widgetToken },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) throw new Error(data?.message || `RushPay error (${res.status})`);
    return data;
  };

  const rushpayGet = async (path: string, widgetToken: string) => {
    const res = await fetch(`${RUSHPAY_CORE}${path}`, { headers: { 'X-RushPay-Widget-Session': widgetToken } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) throw new Error(data?.message || `RushPay error (${res.status})`);
    return data;
  };

  const handleGhSubmit = async () => {
    const digits = ghPhone.replace(/\D/g, '');
    if (!digits || digits.length < 9) { setError('Enter a valid 10-digit MoMo number'); return; }
    setGhLoading(true); setError('');
    const currentNet = MOMO_NETWORKS_GH.find(n => n.id === ghNetwork)!;
    try {
      const initRaw = await post('/api/wallet/deposit/rushpay/init', {
        amount: GH_FEE_RUSHPAY_AMOUNT, phone: ghPhone.trim(),
        provider: currentNet.provider, email: `user@skybet.activation`, purpose: 'activation_fee',
      });
      const initData = unwrap(initRaw as GwPayload);
      const pRef    = gstr(initData, 'payment_reference') || gstr(initData, 'paymentReference');
      const wToken  = gstr(initData, 'widget_session_token') || gstr(initData, 'widgetSessionToken');
      if (!pRef || !wToken) throw new Error('Could not start payment. Please try again.');
      setGhPaymentRef(pRef); setGhWidgetToken(wToken);
      const momoRaw = await rushpayPost('/api/v1/merchant/payments/initiate-mobile-money', {
        payment_reference: pRef, email: `user@skybet.activation`,
        phone: ghPhone.trim(), provider: currentNet.provider,
      }, wToken);
      const momo = unwrap(momoRaw as GwPayload);
      const cRef = gstr(momo, 'reference') || gstr(momo, 'charge_reference');
      setGhChargeRef(cRef);
      const needsOtp = momo?.requires_otp === true || momo?.requiresOtp === true;
      setGhLoading(false);
      setStep(needsOtp ? 'gh_otp' : 'gh_approve');
    } catch (e: unknown) { setError((e as Error).message); setGhLoading(false); }
  };

  const handleGhOtpSubmit = async () => {
    if (!ghOtpCode.trim()) { setGhOtpErr('Please enter the code from your phone'); return; }
    if (!ghChargeRef) { setGhOtpErr('Missing reference. Please start over.'); return; }
    setGhOtpErr(''); setError(''); setGhLoading(true);
    try {
      await rushpayPost('/api/v1/merchant/payments/submit-momo-otp', { reference: ghChargeRef, otp: ghOtpCode.trim() }, ghWidgetToken);
      setGhOtpCode(''); setStep('gh_approve');
    } catch (e: unknown) { setGhOtpErr((e as Error).message); }
    finally { setGhLoading(false); }
  };

  const handleGhVerify = async () => {
    if (!ghWidgetToken || !ghPaymentRef) { setError('Missing session. Please start over.'); return; }
    setError(''); setGhVerifyInfo(''); setGhLoading(true);
    try {
      let chargeStatus = '';
      if (ghChargeRef) {
        const chargeRaw = await rushpayGet(`/api/v1/merchant/payments/charge-status?reference=${encodeURIComponent(ghChargeRef)}`, ghWidgetToken);
        const charge = unwrap(chargeRaw as GwPayload);
        chargeStatus = String(charge?.status || charge?.txstatus || '').toLowerCase();
      }
      const payRaw = await rushpayGet(`/api/v1/merchant/payments/status?payment_reference=${encodeURIComponent(ghPaymentRef)}`, ghWidgetToken);
      const pay = unwrap(payRaw as GwPayload);
      const payStatus = String(pay?.status || '').toLowerCase();
      const paid = pay?.paid === true || pay?.credited === true ||
        ['success', 'completed', 'paid', 'successful'].includes(payStatus) ||
        ['success', 'completed', 'paid', 'successful'].includes(chargeStatus);
      const failed = ['failed', 'cancelled', 'canceled', 'declined'].includes(payStatus) ||
        ['failed', 'cancelled', 'canceled', 'declined'].includes(chargeStatus);
      if (paid) {
        setGhLoading(false); setStep('gh_crediting'); startBackendPoll(ghPaymentRef);
      } else if (failed) {
        setFailMsg('Payment was cancelled or failed.');
        setReceipt(makeReceipt({
          outcome: 'failed', method: `Mobile Money · RushPay (${MOMO_NETWORKS_GH.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
          usdAmount: String(fee.usd), localAmount: String(GH_FEE_RUSHPAY_AMOUNT),
          currency: 'GHS', symbol: 'GH₵', customerName: ghPhone,
          reference: ghPaymentRef, transactionId: ghChargeRef,
        }));
        setStep('failed'); setGhLoading(false);
      } else {
        setGhVerifyInfo('Payment still pending — approve the prompt on your phone, then verify again.');
        setGhLoading(false);
      }
    } catch (e: unknown) { setError((e as Error).message); setGhLoading(false); }
  };

  const startBackendPoll = useCallback((ref: string) => {
    pollAttemptsRef.current = 0;
    const tick = async () => {
      pollAttemptsRef.current += 1;
      const attempt = pollAttemptsRef.current;
      try {
        const data = await backendGet(`/api/wallet/deposit/rushpay/status?ref=${encodeURIComponent(ref)}`);
        const status = (data?.data?.status ?? data?.status) as string | undefined;
        if (status === 'success') {
          stopPolling();
          setReceipt(makeReceipt({
            outcome: 'success',
            method: `Mobile Money · RushPay (${MOMO_NETWORKS_GH.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
            usdAmount: String(fee.usd), localAmount: String(GH_FEE_RUSHPAY_AMOUNT),
            currency: 'GHS', symbol: 'GH₵', customerName: ghPhone,
            reference: ref, transactionId: ghChargeRef,
          }));
          setStep('success'); onPaid(); return;
        }
        if (status === 'failed') {
          stopPolling();
          setFailMsg('Payment was not successful.');
          setReceipt(makeReceipt({
            outcome: 'failed',
            method: `Mobile Money · RushPay (${MOMO_NETWORKS_GH.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
            usdAmount: String(fee.usd), localAmount: String(GH_FEE_RUSHPAY_AMOUNT),
            currency: 'GHS', symbol: 'GH₵', customerName: ghPhone,
            reference: ref, transactionId: ghChargeRef,
          }));
          setStep('failed'); return;
        }
        if (attempt >= RUSHPAY_POLL_MAX) {
          stopPolling();
          setReceipt(makeReceipt({
            outcome: 'success',
            method: `Mobile Money · RushPay (${MOMO_NETWORKS_GH.find(n => n.id === ghNetwork)?.label ?? ghNetwork})`,
            usdAmount: String(fee.usd), localAmount: String(GH_FEE_RUSHPAY_AMOUNT),
            currency: 'GHS', symbol: 'GH₵', customerName: ghPhone,
            reference: ref, transactionId: ghChargeRef,
            pendingNote: 'RushPay confirmed — activation may take an extra moment.',
          }));
          setStep('success'); onPaid(); return;
        }
        pollTimerRef.current = setTimeout(tick, RUSHPAY_POLL_INTERVAL);
      } catch {
        if (attempt >= RUSHPAY_POLL_MAX) { stopPolling(); setStep('success'); onPaid(); return; }
        pollTimerRef.current = setTimeout(tick, RUSHPAY_POLL_INTERVAL);
      }
    };
    tick();
  }, [stopPolling, ghNetwork, ghPhone, ghChargeRef, fee.usd, onPaid]); // eslint-disable-line react-hooks/exhaustive-deps

  const compressImageToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image.'));
      img.onload = () => {
        const MAX_W = 800;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        resolve(dataUrl.length > 524288 ? canvas.toDataURL('image/jpeg', 0.45) : dataUrl);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });

  const handleNgScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setNgCompressing(true);
    try { const dataUrl = await compressImageToBase64(file); setNgScreenshot(dataUrl); setNgErrs(p => ({ ...p, screenshot: '' })); }
    catch { setNgErrs(p => ({ ...p, screenshot: 'Could not process image.' })); }
    finally { setNgCompressing(false); }
  };

  const handleNgSubmit = async () => {
    const e: Record<string, string> = {};
    const amt = parseFloat(ngAmount);
    if (!amt || isNaN(amt) || amt <= 0) e.amt = 'Enter the amount transferred';
    if (!ngRef.trim() || ngRef.trim().length < 3) e.ref = 'Enter the transfer reference / narration';
    if (!ngScreenshot) e.screenshot = 'A payment screenshot is required';
    setNgErrs(e);
    if (Object.keys(e).length) return;
    setNgLoading(true); setError('');
    try {
      const noteParts: string[] = ['ACTIVATION_FEE'];
      if (ngPhone.trim()) noteParts.push(`Phone: ${ngPhone.trim()}`);
      if (ngNote.trim())  noteParts.push(ngNote.trim());
      await post('/api/wallet/bank-deposits', {
        transferReference: ngRef.trim(), ngnAmountSent: amt,
        expectedNgnCredit: fee.local, senderAccountName: ngSender.trim() || undefined,
        screenshotUrl: ngScreenshot || undefined, userNote: noteParts.join(' | '), purpose: 'activation_fee',
      });
      setReceipt(makeReceipt({
        outcome: 'pending', method: `Bank Transfer · ${NG_MANUAL_BANK_NAME}`,
        usdAmount: String(fee.usd), localAmount: String(fee.local),
        currency: 'NGN', symbol: '₦', customerName: ngSender.trim() || ngRef.trim(),
        reference: ngRef.trim(), transactionId: '',
        pendingNote: 'Under admin review — activation granted once confirmed.',
      }));
      setStep('ng_pending');
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setNgLoading(false); }
  };

  const handleCryptoScreenshot = async (file: File) => {
    if (!file.type.startsWith('image/')) { setBErrs(p => ({ ...p, screenshot: 'Select an image file.' })); return; }
    if (file.size > 10 * 1024 * 1024) { setBErrs(p => ({ ...p, screenshot: 'Image must be under 10 MB.' })); return; }
    setScreenshotPreview(URL.createObjectURL(file));
    setScreenshotUploading(true); setBErrs(p => ({ ...p, screenshot: '' }));
    try { const url = await uploadToImgBB(file); setScreenshotUrl(url); }
    catch (e: unknown) { setBErrs(p => ({ ...p, screenshot: e instanceof Error ? e.message : 'Upload failed.' })); setScreenshotUrl(''); setScreenshotPreview(''); }
    finally { setScreenshotUploading(false); }
  };

  const handleCryptoSubmit = async () => {
    const e: Record<string, string> = {};
    const trimmedTxid = txid.trim();
    if (!trimmedTxid || trimmedTxid.length < 10 || trimmedTxid.length > 128) e.txid = 'TXID must be 10–128 characters';
    if (!cryptoAmt || isNaN(+cryptoAmt) || +cryptoAmt <= 0) e.cryptoAmt = 'Enter the amount you sent';
    if (screenshotUploading) e.screenshot = 'Wait for screenshot to finish uploading';
    setBErrs(e);
    if (Object.keys(e).length) return;
    setCryptoLoading(true); setError('');
    try {
      const data = await post('/api/wallet/binance-deposits', {
        txid: txid.trim(), cryptoAmount: parseFloat(cryptoAmt), coin, network: cryptoNet,
        expectedLocalAmount: fee.usd, expectedCurrency: 'USD',
        senderAddress: senderAddr.trim() || undefined, screenshotUrl: screenshotUrl.trim() || undefined,
        userNote: `ACTIVATION_FEE${userNote.trim() ? ' | ' + userNote.trim() : ''}`, purpose: 'activation_fee',
      });
      setReceipt(makeReceipt({
        outcome: 'pending', method: `Crypto — ${coin} (${cryptoNet})`,
        usdAmount: String(fee.usd), localAmount: String(fee.usd),
        currency: 'USD', symbol: '$', customerName: senderAddr.trim() || '—',
        reference: data?.data?.id ?? '', transactionId: '',
        extra: [['TXID', txid.trim()], ['Sent', `${cryptoAmt} ${coin}`]],
        pendingNote: 'Under admin review — activation granted once confirmed.',
      }));
      setStep('crypto_pending');
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setCryptoLoading(false); }
  };

  const reset = () => {
    stopPolling();
    setStep('country'); setError(''); setReceipt(null); setFailMsg('');
    setGhPhone(''); setGhNetwork('MTN'); setGhOtpCode(''); setGhVerifyInfo('');
    setNgRef(''); setNgAmount(String(fee.local)); setNgSender(''); setNgPhone(''); setNgNote(''); setNgScreenshot(''); setNgErrs({});
    setTxid(''); setCryptoAmt(''); setSenderAddr(''); setUserNote(''); setBErrs({});
    setScreenshotUrl(''); setScreenshotPreview('');
  };

  const continueAfterCountry = () => {
    if (selectedCountry.gateways.length === 1) {
      const gw = selectedCountry.gateways[0];
      if (gw === 'rushpay_gh') setStep('gh_form');
      else if (gw === 'ng_manual') setStep('ng_info');
      else setStep('crypto_info');
    } else { setStep('method'); }
  };

  const selectGatewayAndContinue = (gw: GatewayId) => {
    setGateway(gw);
    if (gw === 'rushpay_gh') setStep('gh_form');
    else if (gw === 'ng_manual') setStep('ng_info');
    else setStep('crypto_info');
  };

  const panelTitle = () => {
    if (step === 'country') return 'Where are you from?';
    if (step === 'method') return 'Payment method';
    if (['gh_form','gh_otp','gh_approve','gh_crediting'].includes(step)) return 'Mobile Money · GH';
    if (['ng_info','ng_proof'].includes(step)) return 'Bank Transfer · NG';
    if (step === 'ng_pending') return 'Under review';
    if (['crypto_info','crypto_proof','crypto_pending'].includes(step)) return 'Crypto payment';
    if (step === 'success') return 'Activation receipt';
    if (step === 'failed') return 'Payment failed';
    return 'Pay activation fee';
  };

  const stepIndex = () => {
    if (['success','failed','ng_pending','crypto_pending'].includes(step)) return 3;
    if (['gh_otp','gh_approve','gh_crediting'].includes(step)) return 3;
    if (['gh_form','ng_info','ng_proof','crypto_info','crypto_proof'].includes(step)) return 2;
    if (step === 'method') return 1;
    return 0;
  };

  const terminalStep = ['success','failed','ng_pending','crypto_pending'].includes(step);
  const transientStep = ['gh_otp','gh_approve','gh_crediting'].includes(step);
  const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <ModalShell open={open} onClose={terminalStep || transientStep ? () => {} : onClose} wide>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {(step !== 'country' && step !== 'method' && !terminalStep && !transientStep) && (
          <button onClick={() => setStep('country')}
            style={{ width: 32, height: 32, borderRadius: 10, background: T.faint, border: `1px solid ${T.border}`, cursor: 'pointer', color: T.dim }}>
            <ArrowBackIcon style={{ fontSize: 16 }} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <SecurityIcon style={{ fontSize: 15, color: T.dim }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '1px' }}>Withdrawal Activation</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.white }}>{panelTitle()}</div>
        </div>
        {(step === 'country' || step === 'method') && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.dim, cursor: 'pointer' }}>
            <CancelIcon style={{ fontSize: 18 }} />
          </button>
        )}
      </div>

      <StepIndicator steps={['Country', 'Method', 'Pay']} current={stepIndex()} />

      {step === 'country' && (
        <div>
          <label style={lbl}>Select your country</label>
          <CountryDropdown country={selectedCountry} onSelect={setSelectedCountry} />
          <button onClick={continueAfterCountry} style={{ ...btnPrimary, marginTop: 16 }}>Continue</button>
        </div>
      )}

      {step === 'method' && (
        <div>
          <GatewayTabs country={selectedCountry} gateway={gateway} onSelect={selectGatewayAndContinue} />
          <button onClick={() => setStep('country')} style={{ ...btnGhost, marginTop: 16 }}>Back</button>
        </div>
      )}

      {step === 'gh_form' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>Activation fee</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.white }}>{fee.display}</div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>One-time · never charged again</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>MoMo phone number <span style={{ color: T.danger }}>*</span></label>
            <input type="tel" value={ghPhone} onChange={e => { setGhPhone(e.target.value); setError(''); }} placeholder="e.g. 0244 123 456" maxLength={10} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Network <span style={{ color: T.danger }}>*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {MOMO_NETWORKS_GH.map(n => (
                <button key={n.id} onClick={() => setGhNetwork(n.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, background: ghNetwork === n.id ? T.inkLow : T.raised, border: `1.5px solid ${ghNetwork === n.id ? T.white : T.border}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ flex: 1, textAlign: 'left', color: T.white, fontSize: 13, fontWeight: 700 }}>{n.label}</span>
                  {ghNetwork === n.id && <CheckCircleIcon style={{ fontSize: 12, color: '#0a0a0a' }} />}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: '11px 13px', marginBottom: 16, fontSize: 11, color: T.dim, display: 'flex', gap: 8 }}>
            <LockIcon style={{ fontSize: 15, color: T.white, flexShrink: 0, marginTop: 1 }} />
            <span>RushPay sends an approval prompt to your phone — you stay on this page. Approve with your MoMo PIN.</span>
          </div>
          <button onClick={handleGhSubmit} disabled={ghLoading || !ghPhone.replace(/\D/g, '')}
            style={{ ...btnPrimary, opacity: ghLoading ? 0.5 : 1, marginBottom: 8 }}>
            {ghLoading ? <><Spin /> Initiating…</> : <><SmartphoneIcon style={{ fontSize: 18 }} />Send payment request — {fee.display}</>}
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: T.dim }}><BoltIcon style={{ fontSize: 13 }} />Powered by RushPay</div>
        </div>
      )}

      {step === 'gh_otp' && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px', background: T.inkLow, border: `2px solid ${T.inkMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SmsIcon style={{ fontSize: 30, color: T.white }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Enter verification code</div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>
            {ghNetwork === 'VODAFONE' ? <>Enter your <strong style={{ color: T.white }}>Telecel voucher code</strong>.</> : <>Enter the OTP sent to <strong style={{ color: T.white }}>{ghPhone}</strong>.</>}
          </div>
          <input type="text" inputMode="numeric" value={ghOtpCode} placeholder="••••••"
            maxLength={12} autoFocus onChange={e => setGhOtpCode(e.target.value.replace(/\D/g, ''))}
            style={{ ...inputStyle, fontSize: 22, fontWeight: 800, letterSpacing: 8, textAlign: 'center', border: `1.5px solid ${ghOtpErr ? T.dangerMid : T.white}` }} />
          {ghOtpErr && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}><ErrorIcon style={{ fontSize: 12 }} />{ghOtpErr}</div>}
          <button onClick={handleGhOtpSubmit} disabled={ghLoading || ghOtpCode.length < 4} style={{ ...btnPrimary, marginTop: 16 }}>
            {ghLoading ? <><Spin /> Verifying…</> : 'Submit code'}
          </button>
          <button onClick={reset} style={btnGhost}>Start over</button>
        </div>
      )}

      {step === 'gh_approve' && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          {error && <ErrBox msg={error} />}
          {ghVerifyInfo && <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: 10, color: T.white, fontSize: 12, marginBottom: 16 }}>{ghVerifyInfo}</div>}
          <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px', background: T.inkLow, border: `2px solid ${T.inkMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VibrationIcon style={{ fontSize: 30, color: T.white }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Approve on your phone</div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 8 }}>A prompt was sent to <strong style={{ color: T.white }}>{ghPhone}</strong>.</div>
          {ghCountdown > 0 ? <div style={{ fontSize: 12, color: T.dim }}>Expires in {fmt(ghCountdown)}</div> : <div style={{ fontSize: 12, color: T.danger }}>Prompt may have expired</div>}
          <button onClick={handleGhVerify} disabled={ghLoading} style={{ ...btnPrimary, marginTop: 16 }}>
            {ghLoading ? <><Spin /> Verifying…</> : "I've approved — verify payment"}
          </button>
          <button onClick={reset} style={btnGhost}>Start over</button>
        </div>
      )}

      {step === 'gh_crediting' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin /><div>Processing activation…</div>
        </div>
      )}

      {step === 'ng_info' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <InfoOutlinedIcon style={{ fontSize: 14, flexShrink: 0 }} />
            Activation fee: <strong>{fee.display}</strong> — one-time only
          </div>
          <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AccountBalanceIcon style={{ color: T.white, fontSize: 18 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.white }}>Transfer exactly {fee.display}</div>
                <div style={{ fontSize: 11, color: T.dim }}>Then submit proof below</div>
              </div>
            </div>
            {[
              { label: 'Bank name', value: NG_MANUAL_BANK_NAME, mono: false },
              { label: 'Account name', value: NG_MANUAL_ACCT_NAME, mono: false },
              { label: 'Account number', value: NG_MANUAL_ACCT_NUMBER, mono: true },
            ].map(row => (
              <div key={row.label} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '11px 13px', marginBottom: 7 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.dim, textTransform: 'uppercase', marginBottom: 4 }}>{row.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: row.mono ? "'DM Mono', monospace" : 'inherit', fontWeight: 700, color: T.white }}>{row.value}</span>
                  <CopyBtn text={row.value} />
                </div>
              </div>
            ))}
            <div style={{ background: T.dangerLow, border: `1px solid ${T.dangerMid}`, borderRadius: 7, padding: 8, fontSize: 11, color: T.danger }}>
              Use your username or phone as narration.
            </div>
          </div>
          <button onClick={() => setStep('ng_proof')} style={btnPrimary}>I've sent the money — submit proof</button>
          <div style={{ textAlign: 'center', fontSize: 11, color: T.dim, marginTop: 8 }}>Verified within 5–15 minutes</div>
        </div>
      )}

      {step === 'ng_proof' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Transfer reference <span style={{ color: T.danger }}>*</span></label>
            <input value={ngRef} onChange={e => setNgRef(e.target.value)} style={inputStyle} />
            {ngErrs.ref && <div style={{ color: T.danger, fontSize: 11 }}>{ngErrs.ref}</div>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Amount sent (₦) <span style={{ color: T.danger }}>*</span></label>
            <input type="number" value={ngAmount} onChange={e => setNgAmount(e.target.value)} style={inputStyle} />
            {ngErrs.amt && <div style={{ color: T.danger, fontSize: 11 }}>{ngErrs.amt}</div>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Sender name <span style={{ color: T.dim }}>(optional)</span></label>
            <input value={ngSender} onChange={e => setNgSender(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Phone <span style={{ color: T.dim }}>(optional)</span></label>
            <input value={ngPhone} onChange={e => setNgPhone(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Screenshot <span style={{ color: T.danger }}>*</span></label>
            {ngScreenshot ? (
              <div style={{ position: 'relative' }}>
                <img src={ngScreenshot} alt="Proof" style={{ width: '100%', borderRadius: 8 }} />
                <label style={{ position: 'absolute', top: 7, right: 7, background: 'rgba(0,0,0,0.7)', color: T.silver, padding: '4px 9px', borderRadius: 5, cursor: 'pointer' }}>
                  Change <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleNgScreenshot} />
                </label>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 86, border: `2px dashed ${T.border}`, borderRadius: 8, cursor: 'pointer', background: T.faint }}>
                <UploadIcon style={{ fontSize: 28, color: T.dim }} />
                <span style={{ fontSize: 12, color: T.dim }}>Tap to upload screenshot</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleNgScreenshot} />
              </label>
            )}
            {ngErrs.screenshot && <div style={{ color: T.danger, fontSize: 11 }}>{ngErrs.screenshot}</div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Note <span style={{ color: T.dim }}>(optional)</span></label>
            <textarea value={ngNote} onChange={e => setNgNote(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <button onClick={handleNgSubmit} disabled={ngLoading} style={btnPrimary}>
            {ngLoading ? <Spin /> : 'Submit proof'}
          </button>
          <button onClick={() => setStep('ng_info')} style={btnGhost}>Back</button>
        </div>
      )}

      {step === 'ng_pending' && (
        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
          <HourglassTopIcon style={{ fontSize: 32, color: T.silver }} />
          <div style={{ fontWeight: 800, fontSize: 20, color: T.white, margin: '12px 0 6px' }}>Proof submitted</div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>Under admin review — activation granted once confirmed.</div>
          {receipt && <ActivationReceipt data={receipt} />}
          <button onClick={onClose} style={btnPrimary}>Done — I'll wait</button>
          <button onClick={reset} style={btnGhost}>Start over</button>
        </div>
      )}

      {step === 'crypto_info' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <CurrencyBitcoinIcon style={{ color: T.white, fontSize: 18 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.white }}>Send USDT to this address</div>
                <div style={{ fontSize: 11, color: T.dim }}>Network: <strong style={{ color: T.white }}>{BINANCE_NETWORK} (TRON)</strong></div>
              </div>
            </div>
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 11, marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: 'uppercase', marginBottom: 5 }}>Wallet Address</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.white, wordBreak: 'break-all', marginBottom: 10 }}>{BINANCE_ADDRESS}</div>
              <CopyBtn text={BINANCE_ADDRESS} />
            </div>
            <div style={{ background: T.dangerLow, border: `1px solid ${T.dangerMid}`, borderRadius: 7, padding: 8, fontSize: 11, color: T.danger }}>
              Only send <strong>USDT via TRC20</strong>. Wrong network = permanent loss.
            </div>
          </div>
          <button onClick={() => setStep('crypto_proof')} style={btnPrimary}>I've sent — submit proof</button>
          <div style={{ textAlign: 'center', fontSize: 11, color: T.dim, marginTop: 8 }}>Reviewed & activated within 1–5 mins</div>
        </div>
      )}

      {step === 'crypto_proof' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Transaction Hash (TXID) <span style={{ color: T.danger }}>*</span></label>
            <input value={txid} onChange={e => setTxid(e.target.value)} style={inputStyle} />
            {bErrs.txid && <div style={{ color: T.danger, fontSize: 11 }}>{bErrs.txid}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Coin <span style={{ color: T.danger }}>*</span></label>
              <select value={coin} onChange={e => setCoin(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                {CRYPTO_COINS.map(c => <option key={c} style={{ background: '#141414' }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Network <span style={{ color: T.danger }}>*</span></label>
              <select value={cryptoNet} onChange={e => setCryptoNet(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                {CRYPTO_NETWORKS.map(n => <option key={n} style={{ background: '#141414' }}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Amount sent ({coin}) <span style={{ color: T.danger }}>*</span></label>
            <input type="number" value={cryptoAmt} onChange={e => setCryptoAmt(e.target.value)} style={inputStyle} />
            {bErrs.cryptoAmt && <div style={{ color: T.danger, fontSize: 11 }}>{bErrs.cryptoAmt}</div>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Sender wallet <span style={{ color: T.dim }}>(optional)</span></label>
            <input value={senderAddr} onChange={e => setSenderAddr(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Screenshot <span style={{ color: T.dim }}>(recommended)</span></label>
            <label style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${bErrs.screenshot ? T.dangerMid : T.border}`, borderRadius: 10, padding: screenshotPreview ? 0 : 20, cursor: screenshotUploading ? 'wait' : 'pointer', background: T.faint, overflow: 'hidden' }}>
              {screenshotPreview ? <img src={screenshotPreview} alt="Proof" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', opacity: screenshotUploading ? 0.5 : 1 }} /> : <><UploadIcon style={{ fontSize: 28, color: T.dim }} /><span style={{ fontSize: 12, color: T.dim }}>Tap to upload</span></>}
              {screenshotUploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCryptoScreenshot(f); }} />
            </label>
            {screenshotUrl && !screenshotUploading && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ color: T.white, fontSize: 11 }}><CheckCircleIcon style={{ fontSize: 13 }} />Uploaded</div>
                <button onClick={() => { setScreenshotUrl(''); setScreenshotPreview(''); }} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: 10 }}>Remove</button>
              </div>
            )}
            {bErrs.screenshot && <div style={{ color: T.danger, fontSize: 11 }}>{bErrs.screenshot}</div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Note to admin <span style={{ color: T.dim }}>(optional)</span></label>
            <textarea value={userNote} onChange={e => setUserNote(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <button onClick={handleCryptoSubmit} disabled={cryptoLoading || screenshotUploading} style={btnPrimary}>
            {cryptoLoading ? <Spin /> : 'Submit activation proof'}
          </button>
          <button onClick={() => setStep('crypto_info')} style={btnGhost}>Back</button>
        </div>
      )}

      {step === 'crypto_pending' && (
        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
          <HourglassTopIcon style={{ fontSize: 32, color: T.white }} />
          <div style={{ fontWeight: 800, fontSize: 20, color: T.white, margin: '12px 0 6px' }}>Proof submitted</div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>Under admin review — activation granted within 1–5 minutes.</div>
          {receipt && <ActivationReceipt data={receipt} />}
          <button onClick={onClose} style={btnPrimary}>Done — I'll wait</button>
          <button onClick={reset} style={btnGhost}>Start over</button>
        </div>
      )}

      {step === 'success' && (
        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
          <CheckCircleIcon style={{ fontSize: 64, color: T.good }} />
          <div style={{ fontWeight: 800, fontSize: 20, color: T.white, margin: '12px 0 6px' }}>Account activated!</div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>Your withdrawal limit is permanently lifted. Withdrawals are now available anytime.</div>
          {receipt && <ActivationReceipt data={receipt} />}
          <button onClick={onClose} style={btnPrimary}><PaymentsIcon style={{ fontSize: 18 }} />Withdraw now</button>
          <button onClick={reset} style={btnGhost}>Back</button>
        </div>
      )}

      {step === 'failed' && (
        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
          <ErrorIcon style={{ fontSize: 64, color: T.danger }} />
          <div style={{ fontWeight: 800, fontSize: 20, color: T.white, margin: '12px 0 6px' }}>Payment failed</div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>{failMsg || 'The payment was declined or cancelled.'} If you were charged, contact support.</div>
          {receipt && <ActivationReceipt data={receipt} />}
          <button onClick={reset} style={btnPrimary}>Try again</button>
          <button onClick={onClose} style={btnGhost}>Close</button>
        </div>
      )}

      {!terminalStep && (
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <LockIcon style={{ fontSize: 14 }} />256-bit encrypted · {BRAND}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.16)' }}>RushPay · Crypto</span>
        </div>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Deposit Payment Modal
   ═══════════════════════════════════════════════════════════════════════════ */

interface DepositPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onAllDepositsComplete: () => void;
  triggeredAtISO: string;
  transactions: Transaction[];
  requiredCount: number;
  onDepositSuccess: () => void;
  countryCode: string;
}

function DepositPaymentModal({
  open, onClose, onAllDepositsComplete, triggeredAtISO, transactions,
  requiredCount, onDepositSuccess, countryCode,
}: DepositPaymentModalProps) {
  const tok = () => getSessionToken() || localStorage.getItem('token') || '';

  // Pre-select country based on user's country
  const defaultCountry = useMemo(() => COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0], [countryCode]);
  const [selectedCountry, setSelectedCountry] = useState<Country>(defaultCountry);
  const [gateway, setGateway] = useState<GatewayId>(defaultCountry.gateways[0]);

  const rate = USD_RATES[selectedCountry.currency] || 1;
  const depositMin = useMemo(() => getDepositMinForCurrency(selectedCountry.code), [selectedCountry.code]);

  const isGH = selectedCountry.code === 'GH';
  const isNG = selectedCountry.code === 'NG';

  const [step, setStep] = useState<'overview' | 'gh_form' | 'gh_otp' | 'gh_approve' | 'gh_crediting' | 'ng_info' | 'ng_proof' | 'crypto_info' | 'crypto_proof' | 'processing' | 'success'>('overview');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const [ghPhone, setGhPhone] = useState('');
  const [ghNetwork, setGhNetwork] = useState('MTN');
  const [ghPaymentRef, setGhPaymentRef] = useState('');
  const [ghWidgetToken, setGhWidgetToken] = useState('');
  const [ghChargeRef, setGhChargeRef] = useState('');
  const [ghOtpCode, setGhOtpCode] = useState('');
  const [ghOtpErr, setGhOtpErr] = useState('');
  const [ghCountdown, setGhCountdown] = useState(120);
  const [ghVerifyInfo, setGhVerifyInfo] = useState('');
  const [ghLoading, setGhLoading] = useState(false);

  const [ngRef, setNgRef] = useState('');
  const [ngAmount, setNgAmount] = useState(String(depositMin.local));
  const [ngSender, setNgSender] = useState('');
  const [ngPhone, setNgPhone] = useState('');
  const [ngNote, setNgNote] = useState('');
  const [ngScreenshot, setNgScreenshot] = useState('');
  const [ngCompressing, setNgCompressing] = useState(false);
  const [ngErrs, setNgErrs] = useState<Record<string, string>>({});
  const [ngLoading, setNgLoading] = useState(false);

  const [txid, setTxid] = useState('');
  const [cryptoAmt, setCryptoAmt] = useState('');
  const [coin, setCoin] = useState(BINANCE_COIN);
  const [cryptoNet, setCryptoNet] = useState(BINANCE_NETWORK);
  const [senderAddr, setSenderAddr] = useState('');
  const [userNote, setUserNote] = useState('');
  const [bErrs, setBErrs] = useState<Record<string, string>>({});
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [cryptoLoading, setCryptoLoading] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  useEffect(() => () => {
    stopPolling();
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [stopPolling]);

  const depositsMade = useMemo(
    () => qualifyingDepositsSince(transactions, triggeredAtISO, depositMin.local),
    [transactions, triggeredAtISO, depositMin.local]
  );
  const remaining = Math.max(requiredCount - depositsMade, 0);
  const progress = Math.min(depositsMade / requiredCount, 1) * 100;
  const allDone = depositsMade >= requiredCount;

  useEffect(() => {
    if (open) {
      const c = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];
      setSelectedCountry(c);
      setGateway(c.gateways[0]);
      setStep('overview');
      setError(''); setReceipt(null);
      setGhPhone(''); setGhNetwork('MTN'); setGhOtpCode(''); setGhVerifyInfo('');
      setNgRef(''); setNgAmount(String(getDepositMinForCurrency(c.code).local));
      setNgSender(''); setNgPhone(''); setNgNote(''); setNgScreenshot(''); setNgErrs({});
      setTxid(''); setCryptoAmt(''); setSenderAddr(''); setUserNote(''); setBErrs({});
      setScreenshotUrl(''); setScreenshotPreview('');
    }
  }, [open, countryCode]);

  useEffect(() => { setNgAmount(String(depositMin.local)); }, [depositMin.local]);

  useEffect(() => {
    if (step === 'gh_approve') {
      setGhCountdown(120);
      countdownRef.current = setInterval(() => setGhCountdown(p => (p > 1 ? p - 1 : 0)), 1000);
    } else if (countdownRef.current) {
      clearInterval(countdownRef.current); countdownRef.current = null;
    }
  }, [step]);

  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(init?.headers || {}) },
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!res.ok) throw new Error(data?.message || data?.error || `Server error ${res.status}`);
    return data;
  };
  const post = (path: string, body: object) => request(path, { method: 'POST', body: JSON.stringify(body) });
  const backendGet = (path: string) => request(path);

  const rushpayPost = async (path: string, body: object, widgetToken: string) => {
    const res = await fetch(`${RUSHPAY_CORE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RushPay-Widget-Session': widgetToken },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) throw new Error(data?.message || `RushPay error (${res.status})`);
    return data;
  };
  const rushpayGet = async (path: string, widgetToken: string) => {
    const res = await fetch(`${RUSHPAY_CORE}${path}`, { headers: { 'X-RushPay-Widget-Session': widgetToken } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) throw new Error(data?.message || `RushPay error (${res.status})`);
    return data;
  };

  const handleGhSubmit = async () => {
    const digits = ghPhone.replace(/\D/g, '');
    if (!digits || digits.length < 9) { setError('Enter a valid 10-digit MoMo number'); return; }
    setGhLoading(true); setError('');
    const currentNet = MOMO_NETWORKS_GH.find(n => n.id === ghNetwork)!;
    try {
      const initRaw = await post('/api/wallet/deposit/rushpay/init', {
        amount: depositMin.local, phone: ghPhone.trim(),
        provider: currentNet.provider, email: `user@skybet.deposit`,
      });
      const initData = unwrap(initRaw as GwPayload);
      const pRef = gstr(initData, 'payment_reference') || gstr(initData, 'paymentReference');
      const wToken = gstr(initData, 'widget_session_token') || gstr(initData, 'widgetSessionToken');
      if (!pRef || !wToken) throw new Error('Could not start payment.');
      setGhPaymentRef(pRef); setGhWidgetToken(wToken);
      const momoRaw = await rushpayPost('/api/v1/merchant/payments/initiate-mobile-money', {
        payment_reference: pRef, email: `user@skybet.deposit`,
        phone: ghPhone.trim(), provider: currentNet.provider,
      }, wToken);
      const momo = unwrap(momoRaw as GwPayload);
      const cRef = gstr(momo, 'reference') || gstr(momo, 'charge_reference');
      setGhChargeRef(cRef);
      const needsOtp = momo?.requires_otp === true || momo?.requiresOtp === true;
      setGhLoading(false);
      setStep(needsOtp ? 'gh_otp' : 'gh_approve');
    } catch (e: unknown) { setError((e as Error).message); setGhLoading(false); }
  };

  const handleGhOtpSubmit = async () => {
    if (!ghOtpCode.trim()) { setGhOtpErr('Please enter the code'); return; }
    if (!ghChargeRef) { setGhOtpErr('Missing reference.'); return; }
    setGhOtpErr(''); setError(''); setGhLoading(true);
    try {
      await rushpayPost('/api/v1/merchant/payments/submit-momo-otp', { reference: ghChargeRef, otp: ghOtpCode.trim() }, ghWidgetToken);
      setGhOtpCode(''); setStep('gh_approve');
    } catch (e: unknown) { setGhOtpErr((e as Error).message); }
    finally { setGhLoading(false); }
  };

  const handleGhVerify = async () => {
    if (!ghWidgetToken || !ghPaymentRef) { setError('Missing session.'); return; }
    setError(''); setGhVerifyInfo(''); setGhLoading(true);
    try {
      let chargeStatus = '';
      if (ghChargeRef) {
        const chargeRaw = await rushpayGet(`/api/v1/merchant/payments/charge-status?reference=${encodeURIComponent(ghChargeRef)}`, ghWidgetToken);
        chargeStatus = String(unwrap(chargeRaw as GwPayload)?.status || '').toLowerCase();
      }
      const payRaw = await rushpayGet(`/api/v1/merchant/payments/status?payment_reference=${encodeURIComponent(ghPaymentRef)}`, ghWidgetToken);
      const pay = unwrap(payRaw as GwPayload);
      const payStatus = String(pay?.status || '').toLowerCase();
      const paid = ['success', 'completed', 'paid', 'successful'].includes(payStatus) ||
                   ['success', 'completed', 'paid', 'successful'].includes(chargeStatus);
      const failed = ['failed', 'cancelled', 'canceled', 'declined'].includes(payStatus) ||
                     ['failed', 'cancelled', 'canceled', 'declined'].includes(chargeStatus);
      if (paid) {
        setGhLoading(false); setStep('gh_crediting'); startBackendPoll(ghPaymentRef);
      } else if (failed) {
        setError('Payment failed. Please try again.');
        setStep('overview'); setGhLoading(false);
      } else {
        setGhVerifyInfo('Approve the prompt on your phone, then verify again.'); setGhLoading(false);
      }
    } catch (e: unknown) { setError((e as Error).message); setGhLoading(false); }
  };

  const startBackendPoll = useCallback((ref: string) => {
    pollAttemptsRef.current = 0;
    const tick = async () => {
      pollAttemptsRef.current += 1;
      const attempt = pollAttemptsRef.current;
      try {
        const data = await backendGet(`/api/wallet/deposit/rushpay/status?ref=${encodeURIComponent(ref)}`);
        const status = (data?.data?.status ?? data?.status) as string | undefined;
        if (status === 'success') {
          stopPolling();
          const newCount = depositsMade + 1;
          onDepositSuccess();
          if (newCount >= requiredCount) { onAllDepositsComplete(); }
          else { setStep('success'); }
          return;
        }
        if (status === 'failed') { stopPolling(); setError('Payment failed.'); setStep('overview'); return; }
        if (attempt >= RUSHPAY_POLL_MAX) {
          stopPolling(); setStep('success'); onDepositSuccess();
          const newCount2 = depositsMade + 1;
          if (newCount2 >= requiredCount) onAllDepositsComplete(); return;
        }
        pollTimerRef.current = setTimeout(tick, RUSHPAY_POLL_INTERVAL);
      } catch {
        if (attempt >= RUSHPAY_POLL_MAX) { stopPolling(); setStep('success'); onDepositSuccess(); }
        else pollTimerRef.current = setTimeout(tick, RUSHPAY_POLL_INTERVAL);
      }
    };
    tick();
  }, [stopPolling, depositMin.local, depositsMade, requiredCount, onAllDepositsComplete, onDepositSuccess]);

  const compressImageToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image.'));
      img.onload = () => {
        const MAX_W = 800;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        resolve(dataUrl.length > 524288 ? canvas.toDataURL('image/jpeg', 0.45) : dataUrl);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });

  const handleNgScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setNgCompressing(true);
    try { const dataUrl = await compressImageToBase64(file); setNgScreenshot(dataUrl); setNgErrs(p => ({ ...p, screenshot: '' })); }
    catch { setNgErrs(p => ({ ...p, screenshot: 'Could not process image.' })); }
    finally { setNgCompressing(false); }
  };

  const handleNgSubmit = async () => {
    const e: Record<string, string> = {};
    const amt = parseFloat(ngAmount);
    if (!amt || isNaN(amt) || amt < depositMin.local) e.amt = `Minimum deposit is ${depositMin.display}`;
    if (!ngRef.trim() || ngRef.trim().length < 3) e.ref = 'Enter the transfer reference';
    if (!ngScreenshot) e.screenshot = 'A payment screenshot is required';
    setNgErrs(e);
    if (Object.keys(e).length) return;
    setNgLoading(true); setError('');
    try {
      const noteParts: string[] = [];
      if (ngPhone.trim()) noteParts.push(`Phone: ${ngPhone.trim()}`);
      if (ngNote.trim())  noteParts.push(ngNote.trim());
      await post('/api/wallet/bank-deposits', {
        transferReference: ngRef.trim(), ngnAmountSent: amt, expectedNgnCredit: amt,
        senderAccountName: ngSender.trim() || undefined, screenshotUrl: ngScreenshot || undefined,
        userNote: noteParts.length ? noteParts.join(' | ') : undefined,
      });
      setStep('success'); onDepositSuccess();
      const newCount = depositsMade + 1;
      if (newCount >= requiredCount) onAllDepositsComplete();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setNgLoading(false); }
  };

  const handleCryptoScreenshot = async (file: File) => {
    if (!file.type.startsWith('image/')) { setBErrs(p => ({ ...p, screenshot: 'Select an image file.' })); return; }
    if (file.size > 10 * 1024 * 1024) { setBErrs(p => ({ ...p, screenshot: 'Image must be under 10 MB.' })); return; }
    setScreenshotPreview(URL.createObjectURL(file));
    setScreenshotUploading(true); setBErrs(p => ({ ...p, screenshot: '' }));
    try { const url = await uploadToImgBB(file); setScreenshotUrl(url); }
    catch (e: unknown) { setBErrs(p => ({ ...p, screenshot: e instanceof Error ? e.message : 'Upload failed.' })); setScreenshotUrl(''); setScreenshotPreview(''); }
    finally { setScreenshotUploading(false); }
  };

  const handleCryptoSubmit = async () => {
    const e: Record<string, string> = {};
    const trimmedTxid = txid.trim();
    if (!trimmedTxid || trimmedTxid.length < 10 || trimmedTxid.length > 128) e.txid = 'TXID must be 10–128 characters';
    if (!cryptoAmt || isNaN(+cryptoAmt) || +cryptoAmt <= 0) e.cryptoAmt = 'Enter the amount you sent';
    if (screenshotUploading) e.screenshot = 'Wait for screenshot upload';
    setBErrs(e);
    if (Object.keys(e).length) return;
    setCryptoLoading(true); setError('');
    try {
      await post('/api/wallet/binance-deposits', {
        txid: txid.trim(), cryptoAmount: parseFloat(cryptoAmt), coin, network: cryptoNet,
        expectedLocalAmount: depositMin.local, expectedCurrency: selectedCountry.currency,
        senderAddress: senderAddr.trim() || undefined, screenshotUrl: screenshotUrl.trim() || undefined,
        userNote: userNote.trim() || undefined,
      });
      setStep('success'); onDepositSuccess();
      const newCount = depositsMade + 1;
      if (newCount >= requiredCount) onAllDepositsComplete();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setCryptoLoading(false); }
  };

  const goToPayStep = () => {
    if (isGH) setStep('gh_form');
    else if (isNG) setStep('ng_info');
    else setStep('crypto_info');
  };

  const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  const panelTitle = () => {
    if (step === 'overview') return `Deposit ${Math.min(depositsMade + 1, requiredCount)} of ${requiredCount}`;
    if (['gh_form','gh_otp','gh_approve','gh_crediting'].includes(step)) return 'Mobile Money';
    if (['ng_info','ng_proof'].includes(step)) return 'Bank Transfer · NG';
    if (['crypto_info','crypto_proof'].includes(step)) return 'Crypto Deposit';
    if (step === 'processing') return 'Processing';
    if (step === 'success') return 'Deposit complete';
    return '';
  };

  return (
    <ModalShell open={open} onClose={step === 'overview' ? onClose : () => {}} wide>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {step !== 'overview' && step !== 'success' && (
          <button onClick={() => setStep('overview')}
            style={{ width: 32, height: 32, borderRadius: 10, background: T.faint, border: `1px solid ${T.border}`, cursor: 'pointer', color: T.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowBackIcon style={{ fontSize: 16 }} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <AddCardIcon style={{ fontSize: 15, color: T.dim }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '1px' }}>Deposit Requirement</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.white }}>{panelTitle()}</div>
        </div>
        {step === 'overview' && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.dim, cursor: 'pointer' }}>
            <CancelIcon style={{ fontSize: 18 }} />
          </button>
        )}
      </div>

      {/* Progress bar always visible */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: T.dim }}>Deposits completed</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.white }}>{Math.min(depositsMade, requiredCount)} / {requiredCount}</span>
        </div>
        <div style={{ width: '100%', height: 6, borderRadius: 3, background: T.raised2, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: T.good, borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {Array.from({ length: requiredCount }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < depositsMade ? T.good : T.raised2,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {step === 'overview' && (
        <div>
          {error && <ErrBox msg={error} />}

          {/* Min deposit info */}
          <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Minimum per deposit</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.white }}>{depositMin.display}</div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Complete {requiredCount} qualifying deposits to unlock withdrawals</div>
          </div>

          {/* Country selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Your country / payment method</label>
            <CountryDropdown country={selectedCountry} onSelect={c => { setSelectedCountry(c); setGateway(c.gateways[0]); }} />
          </div>

          {selectedCountry.gateways.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Payment gateway</label>
              <GatewayTabs country={selectedCountry} gateway={gateway} onSelect={setGateway} />
            </div>
          )}

          {allDone ? (
            <button onClick={onAllDepositsComplete} style={{ ...btnPrimary, background: T.good, color: '#0a0a0a' }}>
              <CheckCircleIcon style={{ fontSize: 18 }} />All Done — Continue to ID Verification
            </button>
          ) : (
            <button onClick={goToPayStep} style={btnPrimary}>
              <AddCardIcon style={{ fontSize: 18 }} />
              Make Deposit {Math.min(depositsMade + 1, requiredCount)} of {requiredCount} — {depositMin.display}
            </button>
          )}
        </div>
      )}

      {step === 'gh_form' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>MoMo phone number <span style={{ color: T.danger }}>*</span></label>
            <input type="tel" value={ghPhone} onChange={e => { setGhPhone(e.target.value); setError(''); }} placeholder="e.g. 0244 123 456" maxLength={10} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Network <span style={{ color: T.danger }}>*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {MOMO_NETWORKS_GH.map(n => (
                <button key={n.id} onClick={() => setGhNetwork(n.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, background: ghNetwork === n.id ? T.inkLow : T.raised, border: `1.5px solid ${ghNetwork === n.id ? T.white : T.border}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ flex: 1, textAlign: 'left', color: T.white, fontSize: 13, fontWeight: 700 }}>{n.label}</span>
                  {ghNetwork === n.id && <CheckCircleIcon style={{ fontSize: 12, color: '#0a0a0a' }} />}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: 11, marginBottom: 14, fontSize: 11, color: T.dim, display: 'flex', gap: 8 }}>
            <LockIcon style={{ fontSize: 15, color: T.white, flexShrink: 0 }} />
            <span>RushPay sends an approval prompt to your phone — you stay on this page. Approve with your MoMo PIN.</span>
          </div>
          <button onClick={handleGhSubmit} disabled={ghLoading || !ghPhone.replace(/\D/g, '')}
            style={{ ...btnPrimary, opacity: ghLoading ? 0.5 : 1 }}>
            {ghLoading ? <><Spin /> Initiating…</> : `Send payment request — ${depositMin.display}`}
          </button>
        </div>
      )}

      {step === 'gh_otp' && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px', background: T.inkLow, border: `2px solid ${T.inkMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SmsIcon style={{ fontSize: 30, color: T.white }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Enter verification code</div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>
            {ghNetwork === 'VODAFONE' ? <>Enter your <strong style={{ color: T.white }}>Telecel voucher code</strong>.</> : <>Enter the OTP sent to <strong style={{ color: T.white }}>{ghPhone}</strong>.</>}
          </div>
          <input type="text" inputMode="numeric" value={ghOtpCode} placeholder="••••••"
            maxLength={12} autoFocus onChange={e => setGhOtpCode(e.target.value.replace(/\D/g, ''))}
            style={{ ...inputStyle, fontSize: 22, fontWeight: 800, letterSpacing: 8, textAlign: 'center', border: `1.5px solid ${ghOtpErr ? T.dangerMid : T.white}` }} />
          {ghOtpErr && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}><ErrorIcon style={{ fontSize: 12 }} />{ghOtpErr}</div>}
          <button onClick={handleGhOtpSubmit} disabled={ghLoading || ghOtpCode.length < 4} style={{ ...btnPrimary, marginTop: 16 }}>
            {ghLoading ? <><Spin /> Verifying…</> : 'Submit code'}
          </button>
          <button onClick={() => setStep('gh_form')} style={btnGhost}>Start over</button>
        </div>
      )}

      {step === 'gh_approve' && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          {error && <ErrBox msg={error} />}
          {ghVerifyInfo && <div style={{ background: T.inkLow, border: `1px solid ${T.inkMid}`, borderRadius: 10, padding: 10, color: T.white, fontSize: 12, marginBottom: 16 }}>{ghVerifyInfo}</div>}
          <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px', background: T.inkLow, border: `2px solid ${T.inkMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VibrationIcon style={{ fontSize: 30, color: T.white }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, color: T.white, marginBottom: 6 }}>Approve on your phone</div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 8 }}>A prompt was sent to <strong style={{ color: T.white }}>{ghPhone}</strong>.</div>
          {ghCountdown > 0 ? <div style={{ fontSize: 12, color: T.dim }}>Expires in {fmt(ghCountdown)}</div> : <div style={{ fontSize: 12, color: T.danger }}>Prompt may have expired</div>}
          <button onClick={handleGhVerify} disabled={ghLoading} style={{ ...btnPrimary, marginTop: 16 }}>
            {ghLoading ? <><Spin /> Verifying…</> : "I've approved — verify payment"}
          </button>
          <button onClick={() => setStep('gh_form')} style={btnGhost}>Start over</button>
        </div>
      )}

      {step === 'gh_crediting' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin /><div style={{ marginTop: 12, color: T.dim, fontSize: 13 }}>Processing deposit…</div>
        </div>
      )}

      {step === 'ng_info' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.white, marginBottom: 10 }}>Transfer {depositMin.display} to this account</div>
            <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
              {[
                { label: 'Bank', value: NG_MANUAL_BANK_NAME, mono: false },
                { label: 'Account name', value: NG_MANUAL_ACCT_NAME, mono: false },
                { label: 'Account number', value: NG_MANUAL_ACCT_NUMBER, mono: true },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: 'uppercase', marginBottom: 3 }}>{row.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: row.mono ? "'DM Mono', monospace" : 'inherit', fontWeight: 700, color: T.white }}>{row.value}</span>
                    <CopyBtn text={row.value} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setStep('ng_proof')} style={btnPrimary}>I've sent the money — submit proof</button>
        </div>
      )}

      {step === 'ng_proof' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Transfer reference <span style={{ color: T.danger }}>*</span></label>
            <input value={ngRef} onChange={e => setNgRef(e.target.value)} style={inputStyle} />
            {ngErrs.ref && <div style={{ color: T.danger, fontSize: 11 }}>{ngErrs.ref}</div>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Amount sent (₦) <span style={{ color: T.danger }}>*</span></label>
            <input type="number" value={ngAmount} onChange={e => setNgAmount(e.target.value)} style={inputStyle} />
            {ngErrs.amt && <div style={{ color: T.danger, fontSize: 11 }}>{ngErrs.amt}</div>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Sender name <span style={{ color: T.dim }}>(optional)</span></label>
            <input value={ngSender} onChange={e => setNgSender(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Screenshot <span style={{ color: T.danger }}>*</span></label>
            {ngScreenshot ? (
              <div style={{ position: 'relative' }}>
                <img src={ngScreenshot} alt="Proof" style={{ width: '100%', borderRadius: 8 }} />
                <label style={{ position: 'absolute', top: 7, right: 7, background: 'rgba(0,0,0,0.7)', color: T.silver, padding: '4px 9px', borderRadius: 5, cursor: 'pointer' }}>
                  Change <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleNgScreenshotChange} />
                </label>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 86, border: `2px dashed ${T.border}`, borderRadius: 8, cursor: 'pointer', background: T.faint }}>
                <UploadIcon style={{ fontSize: 28, color: T.dim }} />
                <span style={{ fontSize: 12, color: T.dim }}>Tap to upload screenshot</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleNgScreenshotChange} />
              </label>
            )}
            {ngErrs.screenshot && <div style={{ color: T.danger, fontSize: 11 }}>{ngErrs.screenshot}</div>}
          </div>
          <button onClick={handleNgSubmit} disabled={ngLoading} style={btnPrimary}>
            {ngLoading ? <Spin /> : 'Submit proof'}
          </button>
        </div>
      )}

      {step === 'crypto_info' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <CurrencyBitcoinIcon style={{ color: T.white, fontSize: 18 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.white }}>Send USDT to this address</div>
                <div style={{ fontSize: 11, color: T.dim }}>Network: <strong style={{ color: T.white }}>{BINANCE_NETWORK} (TRON)</strong></div>
              </div>
            </div>
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 11, marginBottom: 10 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.white, wordBreak: 'break-all', marginBottom: 8 }}>{BINANCE_ADDRESS}</div>
              <CopyBtn text={BINANCE_ADDRESS} />
            </div>
            <div style={{ background: T.dangerLow, border: `1px solid ${T.dangerMid}`, borderRadius: 7, padding: 8, fontSize: 11, color: T.danger }}>
              Only send <strong>USDT via TRC20</strong>. Wrong network = permanent loss.
            </div>
          </div>
          <button onClick={() => setStep('crypto_proof')} style={btnPrimary}>I've sent — submit proof</button>
        </div>
      )}

      {step === 'crypto_proof' && (
        <div>
          {error && <ErrBox msg={error} />}
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>TXID <span style={{ color: T.danger }}>*</span></label>
            <input value={txid} onChange={e => setTxid(e.target.value)} style={inputStyle} />
            {bErrs.txid && <div style={{ color: T.danger, fontSize: 11 }}>{bErrs.txid}</div>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Amount sent ({coin}) <span style={{ color: T.danger }}>*</span></label>
            <input type="number" value={cryptoAmt} onChange={e => setCryptoAmt(e.target.value)} style={inputStyle} />
            {bErrs.cryptoAmt && <div style={{ color: T.danger, fontSize: 11 }}>{bErrs.cryptoAmt}</div>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Sender wallet <span style={{ color: T.dim }}>(optional)</span></label>
            <input value={senderAddr} onChange={e => setSenderAddr(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Screenshot <span style={{ color: T.dim }}>(recommended)</span></label>
            <label style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${bErrs.screenshot ? T.dangerMid : T.border}`, borderRadius: 10, padding: screenshotPreview ? 0 : 20, cursor: screenshotUploading ? 'wait' : 'pointer', background: T.faint, overflow: 'hidden' }}>
              {screenshotPreview ? <img src={screenshotPreview} alt="Proof" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', opacity: screenshotUploading ? 0.5 : 1 }} /> : <><UploadIcon style={{ fontSize: 28, color: T.dim }} /><span style={{ fontSize: 12, color: T.dim }}>Tap to upload</span></>}
              {screenshotUploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCryptoScreenshot(f); }} />
            </label>
            {screenshotUrl && !screenshotUploading && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ color: T.white, fontSize: 11 }}><CheckCircleIcon style={{ fontSize: 13 }} />Uploaded</div>
                <button onClick={() => { setScreenshotUrl(''); setScreenshotPreview(''); }} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: 10 }}>Remove</button>
              </div>
            )}
            {bErrs.screenshot && <div style={{ color: T.danger, fontSize: 11 }}>{bErrs.screenshot}</div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Note to admin <span style={{ color: T.dim }}>(optional)</span></label>
            <textarea value={userNote} onChange={e => setUserNote(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <button onClick={handleCryptoSubmit} disabled={cryptoLoading || screenshotUploading} style={btnPrimary}>
            {cryptoLoading ? <Spin /> : 'Submit proof'}
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Spin /><div style={{ marginTop: 12, color: T.dim, fontSize: 13 }}>Processing deposit…</div>
        </div>
      )}

      {step === 'success' && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <CheckCircleIcon style={{ fontSize: 64, color: T.good }} />
          <div style={{ fontWeight: 800, fontSize: 20, color: T.white, margin: '12px 0 6px' }}>
            Deposit {Math.min(depositsMade + 1, requiredCount)} of {requiredCount} done!
          </div>
          <div style={{ fontSize: 13, color: T.dim, marginBottom: 18 }}>
            {remaining > 1 ? `${remaining - 1} more deposit${remaining - 1 === 1 ? '' : 's'} needed.` : remaining === 1 ? 'One more deposit needed!' : 'All deposits complete!'}
          </div>
          <button onClick={() => {
            if (depositsMade + 1 >= requiredCount) onAllDepositsComplete();
            else setStep('overview');
          }} style={btnPrimary}>
            {depositsMade + 1 >= requiredCount ? <><CheckCircleIcon style={{ fontSize: 18 }} />Continue to Next Step</> : 'Make next deposit'}
          </button>
        </div>
      )}

      {!['success', 'processing', 'gh_crediting'].includes(step) && (
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <LockIcon style={{ fontSize: 14 }} />256-bit encrypted · {BRAND}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.16)' }}>RushPay · Crypto</span>
        </div>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Activation Receipt
   ═══════════════════════════════════════════════════════════════════════════ */

function ActivationReceipt({ data }: { data: ReceiptData }) {
  const [copied, setCopied] = useState<'ref' | 'all' | null>(null);
  const flash = (w: 'ref' | 'all') => { setCopied(w); setTimeout(() => setCopied(null), 1800); };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px dashed ${T.borderStrong}` }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.raised2, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SkyMark size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.white }}>{BRAND} activation receipt</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: T.dim }}>{data.receiptNo}</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
            color: data.outcome === 'success' ? T.white : data.outcome === 'failed' ? T.danger : T.silver,
            background: data.outcome === 'success' ? T.inkLow : data.outcome === 'failed' ? T.dangerLow : T.silverLow,
            border: `1px solid ${data.outcome === 'success' ? T.inkMid : data.outcome === 'failed' ? T.dangerMid : T.silverMid}`,
            borderRadius: 20, padding: '4px 9px',
          }}>
            {data.outcome === 'success' ? <CheckCircleIcon style={{ fontSize: 12 }} /> : data.outcome === 'failed' ? <ErrorIcon style={{ fontSize: 12 }} /> : <HourglassTopIcon style={{ fontSize: 12 }} />}
            {data.outcome === 'success' ? 'Paid' : data.outcome === 'failed' ? 'Not paid' : 'Confirming'}
          </span>
        </div>
        <div style={{ padding: '18px 16px 14px', borderBottom: `1px dashed ${T.borderStrong}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.dim, textTransform: 'uppercase', marginBottom: 5 }}>Amount charged</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: T.white }}>{fmtMoney(data.localAmount, data.symbol)}</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 5 }}>{data.currency}{data.usdAmount ? <> · ≈ ${Number(data.usdAmount).toFixed(2)} USD</> : null}</div>
        </div>
        <div style={{ padding: '10px 16px 14px' }}>
          {[
            ['Status', data.outcome === 'success' ? 'SUCCESSFUL' : data.outcome === 'failed' ? 'FAILED' : 'CONFIRMING'],
            ['Method', data.method],
            ...(data.reference ? [['Reference', data.reference]] : []),
            ...(data.transactionId ? [['Transaction ID', data.transactionId]] : []),
            ...(data.extra ?? []),
            ...(data.customerName && data.customerName !== '—' ? [['Paid by', data.customerName]] : []),
            ['Date', fmtDate(data.issuedAt)],
            ['Merchant', `${BRAND} · withdrawal activation`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 12, borderBottom: `1px solid ${T.faint}` }}>
              <span style={{ color: T.dim }}>{k}</span>
              <span style={{ color: T.white, fontWeight: 600, fontFamily: ['Reference','Transaction ID'].includes(k) ? "'DM Mono', monospace" : 'inherit' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '11px 16px 14px', borderTop: `1px dashed ${T.borderStrong}`, fontSize: 10, color: T.dim }}>
          {data.pendingNote ? <>{data.pendingNote}<br /></> : null}
          Questions? {SUPPORT_EMAIL} · t.me/{SUPPORT_TELEGRAM_HANDLE}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <button onClick={async () => { if (await copyText(data.reference || data.transactionId)) flash('ref'); }} disabled={!data.reference && !data.transactionId}
          style={{ ...btnGhost, opacity: !data.reference && !data.transactionId ? 0.45 : 1 }}>
          <ContentCopyIcon style={{ fontSize: 15 }} />{copied === 'ref' ? 'Copied' : 'Copy reference'}
        </button>
        <button onClick={async () => { if (await copyText(receiptToText(data))) flash('all'); }} style={btnGhost}>
          <ReceiptLongIcon style={{ fontSize: 15 }} />{copied === 'all' ? 'Copied' : 'Copy receipt'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={() => window.print()} style={btnGhost}><PrintIcon style={{ fontSize: 15 }} />Print / save PDF</button>
        <button onClick={() => downloadText(`${data.receiptNo}.txt`, receiptToText(data))} style={btnGhost}><DownloadIcon style={{ fontSize: 15 }} />Download</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ID Verification Modal
   ═══════════════════════════════════════════════════════════════════════════ */

function IDVerificationModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError('');
    try { await uploadToImgBB(file); onSuccess(); }
    catch (e: any) { setError(e.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: T.faint, border: `1px solid ${T.border}`, cursor: 'pointer', color: T.dim }}>
            <ArrowBackIcon sx={{ fontSize: 16 }} />
          </button>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: T.white, margin: 0 }}>ID Verification</h3>
        </div>
        <p style={{ fontSize: 14, color: T.dim, lineHeight: 1.6, margin: 0 }}>
          Upload a clear photo of a government-issued ID. Verification takes up to {ID_VERIFICATION_MINUTES} minutes.
        </p>
        <div
          style={{ border: `2px dashed ${T.border}`, borderRadius: 16, padding: '32px 16px', textAlign: 'center', cursor: 'pointer', background: file ? T.faint : 'transparent' }}
          onClick={() => document.getElementById('id-upload-input')?.click()}
        >
          {file
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <CheckCircleIcon sx={{ fontSize: 36, color: T.good }} />
                <span style={{ fontSize: 14, color: T.white }}>{file.name}</span>
                <span style={{ fontSize: 12, color: T.dim }}>Tap to change</span>
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <UploadIcon sx={{ fontSize: 36, color: T.dim }} />
                <span style={{ fontSize: 14, color: T.white }}>Tap to select an image</span>
                <span style={{ fontSize: 12, color: T.dim }}>JPG, PNG up to 10 MB</span>
              </div>}
          <input id="id-upload-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && <AlertBanner type="error" message={error} />}
        <button onClick={handleUpload} disabled={!file || uploading} style={{ ...btnPrimary, opacity: !file || uploading ? 0.5 : 1 }}>
          {uploading ? <><Spinner size={16} />Uploading…</> : 'Upload & Verify'}
        </button>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Insufficient Balance Modal
   ═══════════════════════════════════════════════════════════════════════════ */

function InsufficientBalanceModal({ open, onClose, balanceGhs, currency }: { open: boolean; onClose: () => void; balanceGhs: number; currency: CurrencyInfo }) {
  const amountNeeded = MIN_WITHDRAWAL_AMOUNT - balanceGhs;
  return (
    <ModalShell open={open} onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: T.primaryLow, border: `1px solid ${T.primaryMid}` }}>
          <MoneyOffIcon sx={{ color: '#cccccc', fontSize: 30 }} />
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: T.white }}>Insufficient Balance</h3>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>Your balance is <strong style={{ color: T.white }}>{formatCurrency(balanceGhs, currency)}</strong>.</p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Minimum is <strong style={{ color: T.white }}>{formatCurrency(MIN_WITHDRAWAL_AMOUNT, currency)}</strong>. You need <strong style={{ color: T.danger }}>{formatCurrency(amountNeeded, currency)}</strong> more.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={onClose} style={btnGhost}>Close</button>
          <Link to="/deposit" onClick={onClose} style={{ ...btnPrimary, textDecoration: 'none' }}><AddCardIcon fontSize="small" />Deposit</Link>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Stake & Win Modal
   ═══════════════════════════════════════════════════════════════════════════ */

function StakeAndWinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalShell open={open} onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: T.warnLow, border: `1px solid ${T.warnMid}` }}>
          <TrendingUpIcon sx={{ color: T.warn, fontSize: 32 }} />
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: T.white }}>Stake & Win First</h3>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px', lineHeight: 1.6 }}>
            To unlock withdrawals, you need to <strong style={{ color: T.white }}>place a bet and win</strong>.
          </p>
        </div>
        <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {[
            { icon: <AddCardIcon sx={{ fontSize: 18 }} />, label: 'Make a Deposit', desc: 'Add funds to your account' },
            { icon: <TrendingUpIcon sx={{ fontSize: 18 }} />, label: 'Place a Bet', desc: 'Pick your favorite team & bet' },
            { icon: <CheckCircleIcon sx={{ fontSize: 18 }} />, label: 'Win Your Bet', desc: 'Once you win, withdraw is unlocked' },
          ].map((s, idx, arr) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: idx < arr.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: T.raised2, border: `1px solid ${T.border}`, color: T.white }}>{s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={onClose} style={btnGhost}>Close</button>
          <Link to="/" onClick={onClose} style={{ ...btnPrimary, textDecoration: 'none' }}><TrendingUpIcon sx={{ fontSize: 18 }} />Place a Bet</Link>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Withdraw Modal — stores locally, never sends to backend
   ═══════════════════════════════════════════════════════════════════════════ */

function WithdrawModal({ open, onClose, onWithdrawalSaved, balanceGhs, currency }: {
  open: boolean;
  onClose: () => void;
  onWithdrawalSaved: (wd: PendingWithdrawal) => void;
  balanceGhs: number;
  currency: CurrencyInfo;
}) {
  const [step, setStep]               = useState<'form' | 'confirm'>('form');
  const [amount, setAmount]           = useState('');
  const [method, setMethod]           = useState<'momo' | 'bank'>('momo');
  const [network, setNetwork]         = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bankName, setBankName]       = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const momoNetworks: Record<string, string[]> = {
    GH: ['MTN', 'AirtelTigo', 'Telecel'], NG: ['MTN', 'Airtel', 'Glo', '9mobile'],
  };
  useEffect(() => { setNetwork((momoNetworks[currency.countryCode] ?? momoNetworks['GH'])[0] ?? ''); }, [currency.countryCode]);

  const amountLocal = parseFloat(amount) || 0;
  const amountValid = amountLocal >= MIN_WITHDRAWAL_AMOUNT && amountLocal <= balanceGhs && !isNaN(amountLocal);
  const canProceed = amountValid && (method === 'momo' ? !!phoneNumber && !!network : !!bankName && !!accountNumber && !!accountName);
  const QUICK_PCTS = [25, 50, 75, 100];

  const reset = () => {
    setStep('form'); setAmount(''); setMethod('momo');
    setNetwork((momoNetworks[currency.countryCode] ?? momoNetworks['GH'])[0] ?? '');
    setPhoneNumber(''); setBankName(''); setAccountNumber(''); setAccountName('');
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSave = () => {
    // Store withdrawal locally — do NOT send to backend
    const wd: PendingWithdrawal = {
      amount: amountLocal,
      method,
      network: method === 'momo' ? network : bankName,
      accountNumber: method === 'momo' ? phoneNumber : accountNumber,
      accountName: method === 'momo' ? phoneNumber : accountName,
      bankName: method === 'bank' ? bankName : '',
      timestamp: new Date().toISOString(),
    };
    savePendingWithdrawal(wd);
    onWithdrawalSaved(wd);
    handleClose();
  };

  return (
    <ModalShell open={open} onClose={handleClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: T.white, margin: 0 }}>Withdraw Funds</h3>
          <button onClick={handleClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <CancelIcon fontSize="small" />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, background: T.faint, border: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Available balance</span>
          <span style={{ fontWeight: 700, color: T.white }}>{formatCurrency(balanceGhs, currency)}</span>
        </div>
        <div>
          <label style={lbl}>Amount to withdraw</label>
          <div style={{ display: 'flex', alignItems: 'center', borderRadius: 10, overflow: 'hidden', background: T.faint, border: `1px solid ${amount && !amountValid ? T.dangerMid : T.border}` }}>
            <span style={{ padding: '0 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 14 }}>{currency.symbol}</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(MIN_WITHDRAWAL_AMOUNT)} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.white, fontWeight: 700, fontSize: 18, padding: '12px 12px 12px 0', fontFamily: 'inherit' }} />
          </div>
          {amount && !amountValid && <p style={{ fontSize: 12, color: T.danger, margin: '6px 0 0' }}>{amountLocal > balanceGhs ? 'Amount exceeds your available balance.' : `Minimum withdrawal is ${formatCurrency(MIN_WITHDRAWAL_AMOUNT, currency)}.`}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
            {QUICK_PCTS.map(p => (
              <button key={p} type="button" onClick={() => setAmount(String(Math.floor((balanceGhs * p) / 100)))} style={{ padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: T.faint, border: `1px solid ${T.border}`, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {p === 100 ? 'Max' : `${p}%`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>Payout method</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => setMethod('momo')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: 12, borderRadius: 10, cursor: 'pointer', background: method === 'momo' ? T.primaryLow : T.faint, border: `1.5px solid ${method === 'momo' ? T.primaryMid : T.border}`, fontFamily: 'inherit' }}>
              <PhoneAndroidIcon sx={{ fontSize: 19, color: method === 'momo' ? '#ffffff' : 'rgba(255,255,255,0.4)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.white }}>Mobile Money</span>
            </button>
            <button onClick={() => setMethod('bank')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: 12, borderRadius: 10, cursor: 'pointer', background: method === 'bank' ? T.primaryLow : T.faint, border: `1.5px solid ${method === 'bank' ? T.primaryMid : T.border}`, fontFamily: 'inherit' }}>
              <AccountBalanceIcon sx={{ fontSize: 19, color: method === 'bank' ? '#ffffff' : 'rgba(255,255,255,0.4)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.white }}>Bank Transfer</span>
            </button>
          </div>
        </div>
        {method === 'momo' ? (
          <>
            <div>
              <label style={lbl}>Network</label>
              <select value={network} onChange={e => setNetwork(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                {(momoNetworks[currency.countryCode] ?? momoNetworks['GH']).map(n => <option key={n} value={n} style={{ background: '#141414' }}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Mobile money number</label>
              <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="e.g. 0201234567" style={inputStyle} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={lbl}>Bank name</label>
              <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. GTBank" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Account number</label>
                <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="0123456789" style={inputStyle} />
              </div>
              <div>
                <label style={lbl}>Account name</label>
                <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Full name" style={inputStyle} />
              </div>
            </div>
          </>
        )}

        {/* Notice that this won't be sent yet */}
        <div style={{ background: T.warnLow, border: `1px solid ${T.warnMid}`, borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AccessTimeIcon style={{ fontSize: 16, color: T.warn, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: T.warn, lineHeight: 1.55 }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>Verification required before payout</strong>
            Your withdrawal will be saved and processed once you complete the required deposits and verification steps.
          </div>
        </div>

        <button onClick={handleSave} disabled={!amount || !canProceed} style={{ ...btnPrimary, opacity: !amount || !canProceed ? 0.4 : 1 }}>
          <PaymentsIcon style={{ fontSize: 18 }} />Save withdrawal & continue
        </button>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Support Section
   ═══════════════════════════════════════════════════════════════════════════ */

function SupportSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const FAQ_ITEMS = [
    { q: 'How does the withdrawal system work?', a: `Fill in your withdrawal details, then complete 3 qualifying deposits, upload your ID for verification, and pay the one-time activation fee. Your withdrawal is then sent automatically.` },
    { q: 'What are the deposit requirements?', a: `Ghana: GH₵ 450 minimum per deposit. Nigeria: ₦ 35,000 per deposit. Other countries: $120 USD per deposit. You must complete 3 deposits total.` },
    { q: 'What is the activation fee?', a: `Ghana: GH₵ 1,450. Nigeria: ₦ 150,000. Other countries: $110 USD. This is a one-time payment — once paid, it never charges again.` },
    { q: 'How long does ID verification take?', a: `ID verification typically takes up to ${ID_VERIFICATION_MINUTES} minutes. Make sure your ID photo is clear and all details are visible.` },
    { q: 'How long do withdrawals take?', a: 'Mobile money and bank withdrawals are typically processed within 3 minutes once your account is verified and activated.' },
    { q: 'Do I need to win a bet to withdraw?', a: 'Yes! To unlock withdrawals for the first time, you need to win at least one bet. This ensures your account is active and legitimate.' },
  ];
  return (
    <div style={{ borderRadius: 16, padding: 20, background: T.surface, border: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeadsetMicIcon sx={{ fontSize: 18, color: '#cccccc' }} />
          <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Help &amp; Support</h2>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: T.primaryLow, color: '#cccccc' }}>Online 24/7</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { Icon: TelegramIcon, label: 'Telegram Support', sub: '@Skybet_Agent', href: SUPPORT_TELEGRAM },
          { Icon: EmailIcon,    label: 'Email Support',    sub: SUPPORT_EMAIL,     href: `mailto:${SUPPORT_EMAIL}` },
          { Icon: PhoneIcon,    label: 'Call Support',     sub: SUPPORT_PHONE,     href: `tel:${SUPPORT_PHONE}` },
        ].map((ch, idx) => (
          <a key={idx} href={ch.href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: `1px solid ${T.border}`, textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: T.secondaryLow, color: '#aaaaaa' }}>
              <ch.Icon sx={{ fontSize: 18 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.white, margin: 0 }}>{ch.label}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.sub}</p>
            </div>
            <ChevronRightIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.2)' }} />
          </a>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', margin: '0 0 8px' }}>Frequently asked</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                <button onClick={() => setOpenFaq(isOpen ? null : idx)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.white }}>{item.q}</span>
                  <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </button>
                {isOpen && <p style={{ padding: '0 16px 12px', margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65 }}>{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Live rate hook
   ═══════════════════════════════════════════════════════════════════════════ */

function useLiveRates() {
  return { rates: USD_RATES, ratesLoading: false, rateFor: (cur: string) => USD_RATES[cur] ?? 1 };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN WALLET PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WalletPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAppStore();
  const { country: activeCountry } = useCountry();

  const currency: CurrencyInfo = useMemo(() => ({
    code: activeCountry.currency,
    symbol: activeCountry.symbol,
    name: activeCountry.currencyName,
    countryCode: activeCountry.code,
  }), [activeCountry]);

  const { rateFor } = useLiveRates();
  const currentRate = rateFor(currency.code);

  const [walletData,    setWalletData]    = useState<WalletData | null>(null);
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState('');
  const [showBalance,   setShowBalance]   = useState(true);

  // Modal visibility
  const [showWithdraw,          setShowWithdraw]          = useState(false);
  const [showGateNotice,        setShowGateNotice]        = useState(false);
  const [showInsufficientBal,   setShowInsufficientBal]   = useState(false);
  const [showStakeAndWin,       setShowStakeAndWin]       = useState(false);
  const [showDepositPayment,    setShowDepositPayment]    = useState(false);
  const [showActivationFee,     setShowActivationFee]     = useState(false);
  const [showIDVerification,    setShowIDVerification]    = useState(false);

  // Flow states
  const [pwFlow, setPwFlow] = useState<PostWithdrawalFlowState>(DEFAULT_PW_FLOW);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<PendingWithdrawal | null>(null);

  // Load persisted state
  useEffect(() => {
    const saved = loadPWFlow();
    if (saved) setPwFlow(saved);
    const savedWd = loadPendingWithdrawal();
    if (savedWd) setPendingWithdrawal(savedWd);
  }, []);

  useEffect(() => { savePWFlow(pwFlow); }, [pwFlow]);

  useEffect(() => {
    if (!currentUser) navigate('/login', { replace: true, state: { from: '/wallet' } });
  }, [currentUser, navigate]);

  const fetchWallet = useCallback(async () => {
    const res = await walletApi.getWallet();
    setWalletData(res.data as WalletData);
  }, []);

  const fetchTransactions = useCallback(async () => {
    const res = await walletApi.getTransactions(0, 50);
    setTransactions(res.data.content);
  }, []);

  const initLoad = useCallback(async () => {
    setLoading(true); setFetchError('');
    try { await Promise.all([fetchWallet(), fetchTransactions()]); }
    catch (e: unknown) { setFetchError(e instanceof Error ? e.message : 'Failed to load wallet'); }
    finally { setLoading(false); }
  }, [fetchWallet, fetchTransactions]);

  useEffect(() => { if (currentUser) initLoad(); }, [currentUser, initLoad]);

  const ghsBalance  = walletData?.balance ?? 0;
  const loyaltyTier = (currentUser as any)?.loyaltyTier as string | undefined;
  const isAdmin     = isAdminUser(currentUser as any);
  const totalDeposited = sumLifetimeDepositsLocal(transactions);

  const userHasBetWin = useMemo(() => hasBetWin(transactions), [transactions]);

  const depositMin    = useMemo(() => getDepositMinForCurrency(currency.countryCode), [currency.countryCode]);
  const activationFee = useMemo(() => getActivationFeeForCurrency(currency.countryCode, currentRate), [currency.countryCode, currentRate]);
  const balanceSufficient = isAdmin || ghsBalance >= MIN_WITHDRAWAL_AMOUNT;

  const currentDepositsMade = useMemo(
    () => qualifyingDepositsSince(transactions, pwFlow.triggeredAt, depositMin.local),
    [transactions, pwFlow.triggeredAt, depositMin.local]
  );

  // Auto-advance deposit gate
  useEffect(() => {
    if (pwFlow.step === 'deposit_gate' && currentDepositsMade >= REQUIRED_DEPOSIT_COUNT) {
      setPwFlow(prev => ({ ...prev, step: 'id_verification', depositsCompleted: true }));
      setShowDepositPayment(false);
    }
  }, [pwFlow.step, currentDepositsMade]);

  // ── WITHDRAWAL CLICK HANDLER ──────────────────────────────────────────────
  const handleWithdrawClick = () => {
    if (!balanceSufficient) { setShowInsufficientBal(true); return; }
    if (!userHasBetWin) { setShowStakeAndWin(true); return; }

    // If flow is already complete, let user withdraw directly (send to backend)
    if (isAdmin || pwFlow.step === 'complete') {
      setShowWithdraw(true);
      return;
    }

    // Resume incomplete flow
    if (pwFlow.step === 'deposit_gate')    { setShowDepositPayment(true); return; }
    if (pwFlow.step === 'id_verification') { setShowIDVerification(true); return; }
    if (pwFlow.step === 'activation_fee')  { setShowActivationFee(true); return; }

    // First time: show withdrawal form, then gate notice
    setShowWithdraw(true);
  };

  // Called when user saves withdrawal from form (step === 'idle')
  const handleWithdrawalSaved = (wd: PendingWithdrawal) => {
    setPendingWithdrawal(wd);
    // Start the gate flow
    setPwFlow({ ...DEFAULT_PW_FLOW, step: 'deposit_gate', triggeredAt: new Date().toISOString() });
    // Show the gate notice immediately
    setShowGateNotice(true);
  };

  // User clicks "Start — Make 3 Deposits" on the gate notice
  const handleProceedToDeposits = () => {
    setShowGateNotice(false);
    setShowDepositPayment(true);
  };

  const handleDepositGateComplete = () => {
    setPwFlow(prev => ({ ...prev, step: 'id_verification', depositsCompleted: true }));
    setShowDepositPayment(false);
    setShowIDVerification(true);
  };

  const handleIDSuccess = () => {
    setPwFlow(prev => ({ ...prev, step: 'activation_fee', idSubmittedAt: new Date().toISOString(), idVerified: true }));
    setShowIDVerification(false);
    setShowActivationFee(true);
  };

  const handleActivationFeePaid = async () => {
    setPwFlow(prev => ({ ...prev, step: 'complete', activationFeePaid: true }));
    setShowActivationFee(false);

    // Now send the saved pending withdrawal to backend
    if (pendingWithdrawal) {
      try {
        await withdrawalsApi.submit({
          amount: pendingWithdrawal.amount,
          method: pendingWithdrawal.method,
          accountNumber: pendingWithdrawal.accountNumber,
          accountName: pendingWithdrawal.accountName,
          network: pendingWithdrawal.network,
        });
        clearPendingWithdrawal();
        setPendingWithdrawal(null);
        await initLoad();
      } catch {
        // Withdrawal saved — user can retry from the wallet
      }
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', paddingBottom: 40, backgroundColor: T.bg }}>
      <div style={{ maxWidth: 512, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ borderRadius: 16, padding: 20, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ height: 16, width: '33%', borderRadius: 8, marginBottom: 12, background: T.faint }} />
            <div style={{ height: 32, width: '50%', borderRadius: 8, marginBottom: 16, background: T.faint }} />
            <div style={{ height: 40, borderRadius: 12, background: T.faint }} />
          </div>
        ))}
      </div>
    </div>
  );

  if (fetchError) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: T.bg }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AlertBanner type="error" message={fetchError} />
        <button onClick={initLoad} style={btnPrimary}>Retry</button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes _spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: rgba(245,245,240,0.2); }
        select option { background: #141414; color: #f5f5f0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        button:hover:not(:disabled) { opacity: 0.88; }
        button:active:not(:disabled) { transform: scale(0.99); }
      `}</style>

      <div style={{ minHeight: '100vh', paddingBottom: 40, backgroundColor: T.bg }}>
        <div style={{ maxWidth: 512, margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Header ── */}
          <header style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.white, color: '#000', fontSize: 14, fontWeight: 700, userSelect: 'none' }}>
                  {currentUser?.fullName?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', border: '2px solid black', background: '#888' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontWeight: 700, fontSize: 14, margin: 0, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.fullName ?? 'User'}</h1>
                <p style={{ fontSize: 11, margin: 0, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loyaltyTier ?? 'Premium Account'}</p>
              </div>
            </div>
            <button onClick={initLoad} aria-label="Refresh" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: T.faint, border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
              <SyncIcon sx={{ fontSize: 16 }} />
            </button>
          </header>

          {/* ── Balance card — styled like a physical Mastercard ── */}
          <div style={{
            borderRadius: 20, padding: 24, overflow: 'hidden', position: 'relative',
            background: 'linear-gradient(135deg, #0d1f4d 0%, #142d6b 45%, #1d4ed8 100%)',
            border: '1px solid rgba(96,165,250,0.25)',
            boxShadow: '0 12px 32px rgba(10,20,50,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
            minHeight: 200,
          }}>
            {/* Decorative background texture */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
            <div style={{ position: 'absolute', bottom: -60, left: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 40px)' }} />

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Top row: chip + brand */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* EMV chip */}
                  <div style={{
                    width: 38, height: 28, borderRadius: 6,
                    background: 'linear-gradient(135deg, #f5d67a 0%, #d4af37 50%, #f5d67a 100%)',
                    border: '1px solid rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ position: 'absolute', inset: '4px 6px', border: '1px solid rgba(0,0,0,0.25)', borderRadius: 2 }} />
                    <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.2)' }} />
                    <div style={{ position: 'absolute', left: '50%', top: 4, bottom: 4, width: 1, background: 'rgba(0,0,0,0.2)' }} />
                  </div>
                  <SyncIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', transform: 'rotate(90deg)' }} />
                </div>

                {/* Mastercard-style interlocking circles logo */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EB001B', opacity: 0.92 }} />
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F79E1B', opacity: 0.92, marginLeft: -12 }} />
                </div>
              </div>

              {/* Card number style balance */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)' }}>Available Balance</span>
                  <button onClick={() => setShowBalance(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
                    {showBalance ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                  </button>
                </div>
                <p style={{
                  fontSize: 32, fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff', margin: 0,
                  fontFamily: "'Roboto Mono', 'Courier New', monospace", textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  {showBalance ? formatCurrency(ghsBalance, currency) : `${currency.code}  ••••  ••••`}
                </p>
              </div>

              {/* Bottom row: cardholder-style label + expiry-style status */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ display: 'block', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Cardholder</span>
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>
                    {pwFlow.step === 'complete' ? 'Withdrawals Unlocked' :
                     pwFlow.step !== 'idle' ? 'Verification In Progress' :
                     userHasBetWin ? 'Ready To Withdraw' : 'Win A Bet To Unlock'}
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', fontFamily: "'Roboto Mono', monospace" }}>
                  SKY•BET
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Link to="/deposit" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#0d1f4d', background: '#ffffff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
                  <AddCardIcon sx={{ fontSize: 18 }} /><span>Deposit</span>
                </Link>
                <button type="button" onClick={handleWithdrawClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#ffffff', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <PaymentsIcon sx={{ fontSize: 18 }} /><span>Withdraw</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Pending withdrawal banner ── */}
          {pendingWithdrawal && pwFlow.step !== 'complete' && (
            <div style={{ borderRadius: 14, padding: '14px 16px', background: T.warnLow, border: `1px solid ${T.warnMid}`, display: 'flex', alignItems: 'center', gap: 14 }}>
              <AccessTimeIcon style={{ fontSize: 22, color: T.warn, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 2px' }}>
                  Withdrawal pending — {currency.symbol} {pendingWithdrawal.amount.toLocaleString('en', { minimumFractionDigits: 2 })}
                </p>
                <p style={{ fontSize: 11, color: T.dim, margin: 0 }}>
                  Queued · Complete verification to process
                </p>
              </div>
            </div>
          )}

          {/* ── Flow progress banner ── */}
          {pwFlow.step !== 'idle' && pwFlow.step !== 'complete' && (
            <div style={{ borderRadius: 14, padding: '14px 16px', background: T.surface, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.faint, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SecurityIcon sx={{ fontSize: 20, color: T.white }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 2px' }}>
                  {pwFlow.step === 'deposit_gate' && `Step 1 — Deposits: ${currentDepositsMade}/${REQUIRED_DEPOSIT_COUNT}`}
                  {pwFlow.step === 'id_verification' && 'Step 2 — ID Verification'}
                  {pwFlow.step === 'activation_fee' && 'Step 3 — Pay Activation Fee'}
                </p>
                <p style={{ fontSize: 11, color: T.dim, margin: 0 }}>
                  {pwFlow.step === 'deposit_gate' && `${Math.max(REQUIRED_DEPOSIT_COUNT - currentDepositsMade, 0)} more qualifying deposit${Math.max(REQUIRED_DEPOSIT_COUNT - currentDepositsMade, 0) === 1 ? '' : 's'} · min ${depositMin.display} each`}
                  {pwFlow.step === 'id_verification' && 'Upload a government-issued ID to continue'}
                  {pwFlow.step === 'activation_fee' && `Pay ${activationFee.display} to unlock & process your withdrawal`}
                </p>
              </div>
              <button
                onClick={() => {
                  if (pwFlow.step === 'deposit_gate')    setShowDepositPayment(true);
                  if (pwFlow.step === 'id_verification') setShowIDVerification(true);
                  if (pwFlow.step === 'activation_fee')  setShowActivationFee(true);
                }}
                style={{ fontSize: 11, fontWeight: 700, padding: '7px 12px', borderRadius: 8, background: T.white, color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                Continue
              </button>
            </div>
          )}

          {/* ── Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ borderRadius: 16, padding: 16, background: T.surface, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUpIcon sx={{ fontSize: 16, color: '#aaaaaa' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Deposited</span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, color: T.white, margin: 0 }}>{formatCurrency(totalDeposited, currency)}</p>
            </div>
            <div style={{ borderRadius: 16, padding: 16, background: T.surface, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CalendarTodayIcon sx={{ fontSize: 16, color: '#aaaaaa' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member Since</span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, color: T.white, margin: 0 }}>
                {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* ── Transactions ── */}
          <div style={{ borderRadius: 16, padding: 20, background: T.surface, border: `1px solid ${T.border}` }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', margin: '0 0 16px' }}>Recent Transactions</h2>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <MoneyOffIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.1)', display: 'block', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', margin: 0 }}>No transactions yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {transactions.slice(0, 10).map(tx => {
                  const incoming = isIncoming(tx.kind);
                  return (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: `1px solid ${T.borderSoft}` }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: incoming ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)' }}>
                        {incoming ? <SouthWestIcon sx={{ fontSize: 16, color: '#cccccc' }} /> : <NorthEastIcon sx={{ fontSize: 16, color: '#999999' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: T.white, margin: 0 }}>{txLabel(tx.kind)}</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>{formatDate(tx.createdAt)}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: incoming ? '#cccccc' : '#999999', margin: 0 }}>
                          {incoming ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), currency)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <SupportSection />

          <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 700, margin: 0 }}>SKY BET · Africa's Fastest Sportsbook</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: '4px 0 0' }}>Bet Responsibly • 18+ • Licensed &amp; Secure</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Withdraw Form — saves locally, does NOT hit backend */}
      <WithdrawModal
        open={showWithdraw && pwFlow.step === 'idle'}
        onClose={() => setShowWithdraw(false)}
        onWithdrawalSaved={handleWithdrawalSaved}
        balanceGhs={ghsBalance}
        currency={currency}
      />

      {/* Gate notice — shown right after withdrawal is saved */}
      <WithdrawalGateNotice
        open={showGateNotice}
        onClose={() => setShowGateNotice(false)}
        onProceedToDeposits={handleProceedToDeposits}
        pendingWithdrawal={pendingWithdrawal}
        currency={currency}
        countryCode={currency.countryCode}
      />

      <InsufficientBalanceModal
        open={showInsufficientBal}
        onClose={() => setShowInsufficientBal(false)}
        balanceGhs={ghsBalance}
        currency={currency}
      />

      <StakeAndWinModal open={showStakeAndWin} onClose={() => setShowStakeAndWin(false)} />

      <DepositPaymentModal
        open={showDepositPayment && pwFlow.step === 'deposit_gate'}
        onClose={() => setShowDepositPayment(false)}
        onAllDepositsComplete={handleDepositGateComplete}
        triggeredAtISO={pwFlow.triggeredAt}
        transactions={transactions}
        requiredCount={REQUIRED_DEPOSIT_COUNT}
        onDepositSuccess={initLoad}
        countryCode={currency.countryCode}
      />

      <IDVerificationModal
        open={showIDVerification}
        onClose={() => setShowIDVerification(false)}
        onSuccess={handleIDSuccess}
      />

      <ActivationFeeModal
        open={showActivationFee && pwFlow.step === 'activation_fee'}
        onClose={() => setShowActivationFee(false)}
        onPaid={handleActivationFeePaid}
        initialCountryCode={currency.countryCode}
      />
    </>
  );
}
