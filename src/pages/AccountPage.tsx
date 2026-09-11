import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { useCountry } from '../hooks/useCountry';

import { user as userApi, wallet, affiliate, auth } from '../utils/api';
import type { Transaction } from '../utils/api';

import SettingsIcon           from '@mui/icons-material/Settings';
import NotificationsIcon      from '@mui/icons-material/Notifications';
import VerifiedUserIcon       from '@mui/icons-material/VerifiedUser';
import LogoutIcon             from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupAddIcon           from '@mui/icons-material/GroupAdd';
import RefreshIcon            from '@mui/icons-material/Refresh';
import LoopIcon                from '@mui/icons-material/Loop';
import OpenInNewIcon          from '@mui/icons-material/OpenInNew';
import TrendingUpIcon         from '@mui/icons-material/TrendingUp';
import SyncIcon               from '@mui/icons-material/Sync';
import PeopleAltIcon          from '@mui/icons-material/PeopleAlt';
import PaidIcon               from '@mui/icons-material/Paid';
import NorthEastIcon          from '@mui/icons-material/NorthEast';
import SouthWestIcon          from '@mui/icons-material/SouthWest';
import MoneyOffIcon           from '@mui/icons-material/MoneyOff';
import VisibilityIcon         from '@mui/icons-material/Visibility';
import VisibilityOffIcon      from '@mui/icons-material/VisibilityOff';
import HeadsetMicIcon         from '@mui/icons-material/HeadsetMic';

// ---------------------------------------------------------------------------
// Premium monochrome design tokens
// ---------------------------------------------------------------------------
const T = {
  bg: '#070b14',
  bg2: '#0d1422',
  card: '#121c30',
  cardHover: '#1a2740',
  border: '#1e2d4a',
  text: '#FFFFFF',
  textSecondary: '#a8bcdc',
  textMuted: '#7ba0c4',
  btnPrimary: '#3b82f6',
  btnPrimaryText: '#FFFFFF',
  btnSecondaryBorder: 'rgba(96,165,250,0.25)',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  accent: '#60a5fa',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getUserInitials(fullName: string): string {
  const parts = fullName.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const CREDIT_KINDS = new Set([
  'DEPOSIT', 'BET_WIN', 'REFERRAL_COMMISSION', 'VIP_CASHBACK',
  'WELCOME_BONUS', 'WITHDRAWAL_REFUND',
]);

function isCredit(kind: string) { return CREDIT_KINDS.has(kind); }

function txLabel(kind: string): string {
  const map: Record<string, string> = {
    DEPOSIT: 'Deposit', WITHDRAW: 'Withdrawal', WITHDRAW_HOLD: 'Withdrawal Hold',
    WITHDRAW_RELEASE: 'Withdrawal Released', BET_STAKE: 'Bet Placed', BET_WIN: 'Bet Won',
    REFERRAL_COMMISSION: 'Affiliate Commission', PAYOUT: 'Payout', ADJUSTMENT: 'Adjustment',
    VIP_CASHBACK: 'VIP Cashback', VIP_MEMBERSHIP: 'VIP Membership',
    WELCOME_BONUS: 'Welcome Bonus', WITHDRAWAL_REFUND: 'Withdrawal Refund',
    ADMIN_UPGRADE_FEE: 'Admin Upgrade Fee',
  };
  return map[kind] ?? kind.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------
function Spinner() {
  return <LoopIcon fontSize="small" className="animate-spin shrink-0" />;
}

function Skeleton({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ backgroundColor: T.cardHover }} />;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none"
      style={{ width: 44, height: 24, backgroundColor: checked ? T.success : T.cardHover }}
    >
      <span
        className="inline-block w-[18px] h-[18px] rounded-full bg-white shadow-md transform transition-transform duration-200"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(3px)' }}
      />
    </button>
  );
}

function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-[20px] transition-all duration-200 hover:-translate-y-0.5 ${className}`}
      style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, ...style }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ icon, text, action }: { icon?: React.ReactNode; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textMuted }}>{text}</h2>
      </div>
      {action}
    </div>
  );
}

function StatPill({ icon, label, value, color = T.text }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-2xl p-3 text-center transition-all duration-200 hover:-translate-y-0.5"
      style={{ backgroundColor: T.bg2, border: `1px solid ${T.border}` }}
    >
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-[9px] mb-0.5" style={{ color: T.textMuted }}>{label}</p>
      <p className="text-[11px] font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented scroll-spy nav
// ---------------------------------------------------------------------------
type SectionId = 'overview' | 'referrals' | 'preferences';

function SegmentedScrollNav({
  items,
  activeId,
  onSelect,
}: {
  items: { id: SectionId; label: string; icon: React.ReactNode }[];
  activeId: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = btnRefs.current[activeId];
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({ left: elRect.left - containerRect.left + container.scrollLeft, width: elRect.width });
    }
  }, [activeId, items]);

  return (
    <div
      ref={containerRef}
      className="relative flex gap-1 px-1.5 py-1.5 rounded-full overflow-x-auto no-scrollbar"
      style={{ backgroundColor: T.bg2, border: `1px solid ${T.border}` }}
    >
      <div
        className="absolute top-1.5 bottom-1.5 rounded-full transition-all duration-300 ease-out"
        style={{
          left: indicator.left,
          width: indicator.width,
          backgroundColor: T.card,
          border: `1px solid ${T.btnSecondaryBorder}`,
        }}
      />
      {items.map((item) => (
        <button
          key={item.id}
          ref={(el) => { btnRefs.current[item.id] = el; }}
          onClick={() => onSelect(item.id)}
          className="relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors duration-200"
          style={{ color: activeId === item.id ? T.text : T.textMuted }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AccountPage
// ---------------------------------------------------------------------------
export default function AccountPage() {
  const { user, logout, setAdminModalOpen } = useAppStore();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const { country, fmt: formatCurrency, currency: currencyCode, currencyName, symbol } = useCountry();
  const [currencyLoading, setCurrencyLoading] = useState(true);

  // Data
  const [profileData, setProfileData]           = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading]     = useState(true);
  const [walletData, setWalletData]             = useState<Record<string, unknown> | null>(null);
  const [walletLoading, setWalletLoading]       = useState(true);
  const [transactions, setTransactions]         = useState<Transaction[]>([]);
  const [affiliateBalance, setAffiliateBalance] = useState<{ balance: number; totalReferrals?: number; lifetimeCommission?: number } | null>(null);
  const [showBalance, setShowBalance]           = useState(true);
  const [showAffBalance, setShowAffBalance]     = useState(true);

  // Preferences
  const [notifications, setNotifications] = useState({ push: true, sms: false, email: true });
  const [depositLimit, setDepositLimit]   = useState('');
  const [sessionLimit, setSessionLimit]   = useState('');

  // Section refs for scroll-spy + smooth scroll
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    overview: null, referrals: null, preferences: null,
  });
  const suppressSpyRef = useRef(false);

  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);

  useEffect(() => {
    setCurrencyLoading(true);
  }, []);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await userApi.me();
      if (res.success && res.data) {
        setProfileData(res.data);
      }
    } catch { /* silently fall back */ }
    finally { setProfileLoading(false); }
  }, []);

  const fetchWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const [walletRes, txRes, affRes] = await Promise.all([
        wallet.getWallet(),
        wallet.getTransactions(0, 6),
        affiliate.getBalance(),
      ]);
      if (walletRes.success) setWalletData(walletRes.data);
      if (txRes.success)     setTransactions(txRes.data.content);
      if (affRes.success) {
        const d = affRes.data as Record<string, unknown>;
        if (typeof d.balance === 'number')
          setAffiliateBalance({
            balance: d.balance,
            totalReferrals: typeof d.totalReferrals === 'number' ? d.totalReferrals : undefined,
            lifetimeCommission: typeof d.lifetimeCommission === 'number' ? d.lifetimeCommission : undefined,
          });
      }
    } catch { /* silently fail */ }
    finally { setWalletLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchProfile();
    fetchWallet();
  }, [user, fetchProfile, fetchWallet]);

  const isAdminEarly = ['ADMIN', 'SUPER_ADMIN'].includes(
    (((profileData?.role as string) ?? user?.role ?? '') as string).toUpperCase()
  );
  const navItems = useMemo(() => {
    const items: { id: SectionId; label: string; icon: React.ReactNode }[] = [
      { id: 'overview',    label: 'Overview',    icon: <TrendingUpIcon sx={{ fontSize: 16 }} /> },
    ];
    if (isAdminEarly) {
      items.push({ id: 'referrals', label: 'Referrals', icon: <GroupAddIcon sx={{ fontSize: 16 }} /> });
    }
    items.push({ id: 'preferences', label: 'Settings', icon: <SettingsIcon sx={{ fontSize: 16 }} /> });
    return items;
  }, [isAdminEarly]);

  // Scroll-spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressSpyRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.getAttribute('data-section-id') as SectionId | null;
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: '-15% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    navItems.forEach((item) => {
      const el = sectionRefs.current[item.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [navItems]);

  const scrollToSection = (id: SectionId) => {
    suppressSpyRef.current = true;
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => { suppressSpyRef.current = false; }, 700);
  };

  if (!user) return null;

  // Derived values
  const apiFirstName = (profileData?.firstName as string) ?? '';
  const apiLastName  = (profileData?.lastName  as string) ?? '';
  const apiEmail     = (profileData?.email     as string) ?? user.email;
  const apiRole      = (profileData?.role      as string) ?? user.role;
  const displayName  = [apiFirstName, apiLastName].filter(Boolean).join(' ') || user.fullName;
  const roleLabel    = apiRole.replace('_', ' ');
  const isAdmin      = isAdminEarly;
  const loyaltyTier  = (user as unknown as Record<string, unknown>)?.loyaltyTier as string | undefined;

  const walletBalanceGhs: number =
    typeof walletData?.balance === 'number'
      ? (walletData.balance as number)
      : typeof walletData?.availableBalance === 'number'
      ? (walletData.availableBalance as number)
      : 0;

  const affBalanceGhs         = affiliateBalance?.balance ?? 0;
  const affLifetimeGhs        = affiliateBalance?.lifetimeCommission ?? 0;
  const affTotalReferrals     = affiliateBalance?.totalReferrals ?? 0;
  const balanceReady          = !currencyLoading;

  // Handlers
  const handleLogout = async () => {
    try { await auth.logout(); } catch { /* ignore */ }
    logout();
    navigate('/');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    backgroundColor: T.bg2, border: `1px solid ${T.border}`,
    color: T.text, fontSize: 15, outline: 'none',
  };

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: T.bg }}>

      {/* ═══ MOBILE HERO HEADER (hidden on lg+) ═══ */}
      <div className="lg:hidden" style={{ backgroundColor: T.bg2, borderBottom: `1px solid ${T.border}` }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3.5 px-4 pt-5 pb-4">
            <div className="relative shrink-0">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold select-none"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}
              >
                {getUserInitials(displayName)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: T.bg2, backgroundColor: T.success }} />
            </div>

            <div className="flex-1 min-w-0">
              {profileLoading ? (
                <div className="space-y-2">
                  <Skeleton w="w-32" h="h-5" />
                  <Skeleton w="w-44" h="h-3.5" />
                </div>
              ) : (
                <>
                  <h1 className="font-bold text-base leading-tight truncate" style={{ color: T.text }}>{displayName}</h1>
                  <p className="text-xs truncate mt-0.5" style={{ color: T.textMuted }}>{apiEmail}</p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }}
              >
                {loyaltyTier ?? roleLabel}
              </span>
              <button
                onClick={() => { fetchProfile(); fetchWallet(); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                style={{ backgroundColor: T.card, color: T.textMuted, border: `1px solid ${T.border}` }}
              >
                <SyncIcon fontSize="small" />
              </button>
            </div>
          </div>

          {/* Sticky sliding-pill scroll-spy nav (mobile) */}
          <div className="px-4 pb-3">
            <SegmentedScrollNav items={navItems} activeId={activeSection} onSelect={scrollToSection} />
          </div>
        </div>
      </div>

      {/* ═══ DESKTOP LAYOUT: sidebar + single scrolling content column ═══ */}
      <div className="lg:max-w-5xl lg:mx-auto lg:pt-10 lg:px-6 lg:grid lg:grid-cols-[272px_1fr] lg:gap-6 lg:items-start">

        {/* Sidebar (lg+ only) */}
        <aside className="hidden lg:block lg:sticky lg:top-10 space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative shrink-0">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold select-none"
                  style={{ backgroundColor: T.bg2, border: `1px solid ${T.border}`, color: T.text }}
                >
                  {getUserInitials(displayName)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ borderColor: T.card, backgroundColor: T.success }} />
              </div>
              <div className="flex-1 min-w-0">
                {profileLoading ? (
                  <div className="space-y-1.5">
                    <Skeleton w="w-24" h="h-4" />
                    <Skeleton w="w-32" h="h-3" />
                  </div>
                ) : (
                  <>
                    <p className="font-bold text-sm truncate" style={{ color: T.text }}>{displayName}</p>
                    <p className="text-[11px] truncate" style={{ color: T.textMuted }}>{apiEmail}</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                style={{ backgroundColor: T.bg2, color: T.text, border: `1px solid ${T.border}` }}
              >
                {loyaltyTier ?? roleLabel}
              </span>
              <button
                onClick={() => { fetchProfile(); fetchWallet(); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                style={{ backgroundColor: T.bg2, color: T.textMuted, border: `1px solid ${T.border}` }}
              >
                <SyncIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
          </Card>

          {/* Scroll-spy nav list */}
          <Card className="overflow-hidden">
            {navItems.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-left transition-all duration-200"
                style={{
                  borderBottom: idx < navItems.length - 1 ? `1px solid ${T.border}` : 'none',
                  borderLeft: activeSection === item.id ? `3px solid ${T.text}` : '3px solid transparent',
                  backgroundColor: activeSection === item.id ? T.bg2 : 'transparent',
                  color: activeSection === item.id ? T.text : T.textSecondary,
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            {isAdmin && (
              <button
                onClick={() => setAdminModalOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-left transition-colors"
                style={{ borderTop: `1px solid ${T.border}`, borderLeft: '3px solid transparent', color: T.textSecondary }}
              >
                <AdminPanelSettingsIcon sx={{ fontSize: 18 }} />
                Admin Panel
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-left transition-colors"
              style={{ borderTop: `1px solid ${T.border}`, borderLeft: '3px solid transparent', color: T.danger }}
            >
              <LogoutIcon sx={{ fontSize: 18 }} />
              Sign Out
            </button>
          </Card>

          <p className="text-center text-[10px] font-medium" style={{ color: T.textMuted }}>
            WinningBet · Bet Responsibly · 18+
          </p>
        </aside>

        {/* Content column */}
        <div className="px-4 pt-4 lg:px-0 lg:pt-0 max-w-lg mx-auto lg:max-w-none lg:mx-0 space-y-10">

          {/* ══════════════════ OVERVIEW ══════════════════ */}
          <div
            ref={(el) => { sectionRefs.current.overview = el; }}
            data-section-id="overview"
            className="space-y-4 scroll-mt-28"
          >
            {/* Main Balance Card */}
            <div
              className="rounded-[20px] p-5 overflow-hidden relative"
              style={{ background: `linear-gradient(135deg, ${T.bg} 0%, ${T.bg2} 60%, ${T.card} 100%)`, border: `1px solid ${T.border}` }}
            >
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-[0.06]" style={{ backgroundColor: T.accent }} />
              <div className="absolute -bottom-12 -left-4 w-32 h-32 rounded-full opacity-[0.04]" style={{ backgroundColor: T.accent }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <AccountBalanceWalletIcon sx={{ fontSize: 16 }} style={{ color: T.textSecondary }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
                      Main Wallet · {currencyCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowBalance(v => !v)} className="transition-colors" style={{ color: T.textMuted }}>
                      {showBalance ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                    </button>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: T.success }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: T.success }} />
                    </span>
                  </div>
                </div>
                <p className="text-4xl font-black tracking-tight mt-2 mb-6" style={{ color: T.text }}>
                  {walletLoading || !balanceReady
                    ? <span className="inline-block h-10 w-48 rounded-xl animate-pulse" style={{ backgroundColor: T.cardHover }} />
                    : showBalance ? formatCurrency(walletBalanceGhs) : `${currencyCode} ••••`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to="/deposit"
                    className="flex items-center justify-center py-3.5 px-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.97] hover:scale-[1.02]"
                    style={{ backgroundColor: T.btnPrimary, color: T.btnPrimaryText }}
                  >
                    Deposit
                  </Link>
                  <Link
                    to="/wallet"
                    className="flex items-center justify-center py-3.5 px-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.97]"
                    style={{ backgroundColor: 'transparent', color: T.textSecondary, border: `1px solid ${T.btnSecondaryBorder}` }}
                  >
                    Full Wallet
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <Card className="p-5">
              <SectionLabel
                text="Recent Activity"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchWallet}
                      className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                      style={{ backgroundColor: T.bg2, color: T.textMuted }}
                    >
                      <RefreshIcon sx={{ fontSize: 15 }} />
                    </button>
                    <Link to="/wallet" className="text-[11px] font-bold hover:underline" style={{ color: T.text }}>
                      View all
                    </Link>
                  </div>
                }
              />

              {walletLoading || !balanceReady ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-3.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <Skeleton w="w-9 h-9 rounded-full shrink-0" h="h-9" />
                    <div className="flex-1 space-y-2">
                      <Skeleton w="w-28" h="h-4" />
                      <Skeleton w="w-20" h="h-3" />
                    </div>
                    <Skeleton w="w-20" h="h-5" />
                  </div>
                ))
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <MoneyOffIcon sx={{ fontSize: 40 }} className="mx-auto mb-3" style={{ color: T.border }} />
                  <p className="text-sm" style={{ color: T.textMuted }}>No transactions yet.</p>
                </div>
              ) : (
                transactions.map((tx, idx) => {
                  const credit = isCredit(tx.kind);
                  const isLast = idx === transactions.length - 1;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-3.5" style={!isLast ? { borderBottom: `1px solid ${T.border}` } : {}}>
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: credit ? 'rgba(34,197,94,0.12)' : T.bg2 }}
                      >
                        {credit
                          ? <SouthWestIcon sx={{ fontSize: 16 }} style={{ color: T.success }} />
                          : <NorthEastIcon sx={{ fontSize: 16 }} style={{ color: T.text }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: T.text }}>{txLabel(tx.kind)}</p>
                        <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{formatDate(tx.createdAt)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold tabular-nums" style={{ color: credit ? T.success : T.text }}>
                          {credit ? '+' : '-'}{formatCurrency(tx.amount)}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                          Bal: {formatCurrency(tx.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </Card>

            {/* KYC */}
            <Card className="p-5">
              <SectionLabel icon={<VerifiedUserIcon sx={{ fontSize: 16 }} style={{ color: T.text }} />} text="KYC Verification" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: T.text }}>Identity Verification</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: T.textMuted }}>
                    {user.kycStatus === 'verified'
                      ? 'Your identity has been verified.'
                      : user.kycStatus === 'pending'
                      ? 'Verification is in progress.'
                      : 'Verify your identity to unlock all features.'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-xl"
                    style={
                      user.kycStatus === 'verified'
                        ? { backgroundColor: 'rgba(34,197,94,0.15)', color: T.success }
                        : user.kycStatus === 'pending'
                        ? { backgroundColor: 'rgba(245,158,11,0.15)', color: T.warning }
                        : { backgroundColor: T.bg2, color: T.textMuted }
                    }
                  >
                    {user.kycStatus.charAt(0).toUpperCase() + user.kycStatus.slice(1)}
                  </span>
                  {user.kycStatus === 'unverified' && (
                    <button
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
                      style={{ backgroundColor: T.btnPrimary, color: T.btnPrimaryText }}
                    >
                      Start KYC
                    </button>
                  )}
                </div>
              </div>
            </Card>

            {/* Region & Currency */}
            <Card className="p-5">
              <SectionLabel
                icon={<span style={{ fontSize: 15 }}>{country.flag}</span>}
                text="Region & Currency"
              />
              <div className="space-y-2.5">
                {[
                  { label: 'Country',            value: `${country.flag}  ${country.name}` },
                  { label: 'Currency',           value: `${symbol}  ${currencyCode} — ${currencyName}` },
                  { label: 'Minimum stake',      value: formatCurrency(country.minStake) },
                  { label: 'Maximum stake',      value: formatCurrency(country.maxStake) },
                  { label: 'Minimum deposit',    value: formatCurrency(country.minDeposit) },
                  { label: 'Minimum withdrawal', value: formatCurrency(country.minWithdrawal) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: `1px solid ${T.border}` }}
                  >
                    <span className="text-xs font-medium" style={{ color: T.textMuted }}>
                      {label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: T.text }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <p className="text-[11px] leading-relaxed mb-2" style={{ color: T.textMuted }}>
                  Deposit methods available in {country.name}:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {country.paymentMethods.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                      style={{ background: T.bg2, color: T.textSecondary, border: `1px solid ${T.border}` }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[10px] mt-3 leading-relaxed" style={{ color: T.textMuted }}>
                Your currency is set by the country you chose when you registered.
                Contact support if you need it changed — it affects your wallet,
                stake limits and payout methods.
              </p>
            </Card>

            {/* Support */}
            <Card className="p-5">
              <SectionLabel icon={<HeadsetMicIcon sx={{ fontSize: 16 }} style={{ color: T.text }} />} text="Support" />
              <div className="grid grid-cols-2 gap-2">
                {['Live Chat', 'FAQs', 'Email Support'].map((label) => (
                  <button
                    key={label}
                    className="py-2.5 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
                    style={{ backgroundColor: T.bg2, color: T.textSecondary, border: `1px solid ${T.border}` }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* ══════════════════ REFERRALS (admin only) ══════════════════ */}
          {isAdmin && (
            <div
              ref={(el) => { sectionRefs.current.referrals = el; }}
              data-section-id="referrals"
              className="scroll-mt-28"
            >
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>Referral Earnings</p>
                  <button onClick={() => setShowAffBalance(v => !v)} className="transition-colors" style={{ color: T.textMuted }}>
                    {showAffBalance ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                  </button>
                </div>

                <p className="text-3xl font-black mb-4" style={{ color: T.text }}>
                  {walletLoading || !balanceReady
                    ? <span className="inline-block h-9 w-40 rounded-xl animate-pulse" style={{ backgroundColor: T.cardHover }} />
                    : showAffBalance ? formatCurrency(affBalanceGhs) : `${currencyCode} ••••`}
                </p>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <StatPill icon={<PaidIcon sx={{ fontSize: 18 }} style={{ color: T.text }} />} label="Total Earned" value={walletLoading || !balanceReady ? '…' : formatCurrency(affLifetimeGhs)} />
                  <StatPill icon={<PeopleAltIcon sx={{ fontSize: 18 }} style={{ color: T.success }} />} label="Referrals" value={walletLoading ? '…' : String(affTotalReferrals)} color={T.success} />
                  <StatPill icon={<AccountBalanceWalletIcon sx={{ fontSize: 18 }} style={{ color: T.text }} />} label="Available" value={walletLoading || !balanceReady ? '…' : formatCurrency(affBalanceGhs)} />
                </div>

                <Link
                  to="/affiliate"
                  className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                  style={{ backgroundColor: T.bg2, color: T.textSecondary, border: `1px solid ${T.border}` }}
                >
                  <OpenInNewIcon fontSize="small" />
                  Manage Referrals
                </Link>
              </Card>
            </div>
          )}

          {/* ══════════════════ PREFERENCES ══════════════════ */}
          <div
            ref={(el) => { sectionRefs.current.preferences = el; }}
            data-section-id="preferences"
            className="space-y-4 scroll-mt-28"
          >
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
                <NotificationsIcon sx={{ fontSize: 16 }} style={{ color: T.text }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textMuted }}>Notifications</span>
              </div>
              {(
                [
                  { key: 'push',  label: 'Push Notifications',  sub: 'In-app alerts & updates' },
                  { key: 'sms',   label: 'SMS Alerts',          sub: 'Text messages to your phone' },
                  { key: 'email', label: 'Email Notifications', sub: 'Updates sent to your inbox' },
                ] as const
              ).map(({ key, label, sub }, idx, arr) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-5 py-3.5 gap-3"
                  style={idx < arr.length - 1 ? { borderBottom: `1px solid ${T.border}` } : {}}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: T.text }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{sub}</p>
                  </div>
                  <Toggle checked={notifications[key]} onChange={() => setNotifications((p) => ({ ...p, [key]: !p[key] }))} />
                </div>
              ))}
            </Card>

            <Card className="p-5">
              <SectionLabel icon={<VerifiedUserIcon sx={{ fontSize: 16 }} style={{ color: T.text }} />} text="Responsible Gambling" />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: T.textMuted }}>
                    {`Daily Deposit Limit (${currencyCode})`}
                  </label>
                  <input
                    type="number"
                    value={depositLimit}
                    onChange={(e) => setDepositLimit(e.target.value)}
                    placeholder="No limit set"
                    style={inputStyle}
                    min="0"
                    disabled={currencyLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: T.textMuted }}>Session Time Limit (minutes)</label>
                  <input
                    type="number"
                    value={sessionLimit}
                    onChange={(e) => setSessionLimit(e.target.value)}
                    placeholder="No limit set"
                    style={inputStyle}
                    min="0"
                  />
                </div>
                <button
                  className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.97]"
                  style={{ backgroundColor: T.btnPrimary, color: T.btnPrimaryText }}
                >
                  Save Limits
                </button>
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '0.75rem' }}>
                  <button
                    className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                    style={{ color: T.danger, backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    Self-Exclusion
                  </button>
                </div>
              </div>
            </Card>

            {/* Mobile-only admin CTA + sign out */}
            <div className="lg:hidden space-y-3">
              {isAdmin && (
                <button
                  onClick={() => setAdminModalOpen(true)}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                  style={{ backgroundColor: T.btnPrimary, color: T.btnPrimaryText }}
                >
                  <AdminPanelSettingsIcon fontSize="small" />
                  Open Admin Panel
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                style={{ color: T.danger, backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <LogoutIcon fontSize="small" />
                Sign Out
              </button>
              <p className="text-center text-[10px] font-medium pb-2" style={{ color: T.textMuted }}>
                WinningBet · Bet Responsibly · 18+
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}