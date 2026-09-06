// SKYBET — Header.tsx
// - All sections left-aligned (max-width 1440px, padding 0 20px)
// - Sport tabs unified with MatchList sport tab logic
// - Google Material Icons (loaded via CDN link tag, used via <span className="material-icons">)
// - Winner Ticker, Main Nav, Sport Nav, Search, Wallet, User Menu all retained
// - Mobile responsive: nothing overflows the viewport on narrow screens

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import { wallet as walletApi } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { useCountry } from '../../hooks/useCountry';

// ─── Types ─────────────────────────────────────────────────────────────────────
type CurrencySymbol = { symbol: string };

// ─── Sport tab keys — must match MatchList exactly ─────────────────────────────
export type SportTab = 'football' | 'basketball' | 'tennis' | 'baseball' | 'nfl' | 'mma';

export const SPORT_TABS: { key: SportTab; label: string; icon: string }[] = [
  { key: 'football',   label: 'Football',   icon: 'sports_soccer'    },
  { key: 'basketball', label: 'Basketball', icon: 'sports_basketball' },
  { key: 'tennis',     label: 'Tennis',     icon: 'sports_tennis'    },
  { key: 'baseball',   label: 'Baseball',   icon: 'sports_baseball'  },
  { key: 'nfl',        label: 'NFL',        icon: 'sports_football'  },
  { key: 'mma',        label: 'MMA',        icon: 'sports_mma'       },
];

/* ─── Currency helpers ─────────────────────────────────────────────────────────
   Removed: a 24-hour localStorage-cached ipapi.co lookup that mapped the
   visitor's IP country to one of exactly three symbols (GH₵ / ₦ / $).

   Two problems. It contradicted the country the user registered with, and
   the 24h cache meant a wrong answer stuck around for a day — logging out and
   back in as a different user didn't clear it. Currency now comes from the
   registration choice via useCountry(), correct on first paint.
   -------------------------------------------------------------------------- */

function formatAmount(balance: number, currency: CurrencySymbol): string {
  return `${currency.symbol}${balance.toFixed(2)}`;
}

// ─── Winner Ticker ─────────────────────────────────────────────────────────────
// Amounts are plain numbers now — the symbol is applied at render time from
// the player's own country, so a Nigerian doesn't see a ticker in cedis.
const TICKER_ITEMS = [
  { user: 'RB***qe', amount:  89_900, game: '1X2 · Serie A'        },
  { user: 'TC***wy', amount: 148_335, game: 'Mines · 3 reveals'    },
  { user: 'TK***zv', amount: 305_505, game: 'O/U 2.5 · Bundesliga' },
  { user: 'MC***f5', amount: 142_135, game: '1X2 · Serie A'        },
  { user: 'HX***lw', amount:  92_225, game: 'O/U 2'                },
  { user: 'PD***xk', amount: 210_450, game: 'Crash · 3.2x'         },
  { user: 'JR***mn', amount:  67_880, game: '1X2 · EPL'            },
];

function WinnerTicker() {
  const { fmt } = useCountry();
  return (
    <div style={{
      background: '#0a1628',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
      height: 32,
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      maxWidth: '100vw',
    }}>
      <style>{`
        @keyframes cb-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .cb-ticker-track {
          display: flex;
          align-items: center;
          gap: 0;
          white-space: nowrap;
          animation: cb-ticker 40s linear infinite;
          will-change: transform;
        }
        .cb-ticker-track:hover { animation-play-state: paused; }
        @media (max-width: 480px) {
          .cb-ticker-item { padding: 0 12px !important; font-size: 0.68rem !important; }
        }
      `}</style>
      <div className="cb-ticker-track">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="cb-ticker-item" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 18px',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.72rem',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#3b82f6', flexShrink: 0, display: 'inline-block',
            }} />
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>WINNER</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>{item.user}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>won</span>
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>{fmt(item.amount)}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>· {item.game}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Nav Tabs ─────────────────────────────────────────────────────────────
const MAIN_TABS = [
  { label: 'Sports',  icon: 'emoji_events',   path: '/'  },
  { label: 'Live',    icon: 'sensors',         path: '/live',    badge: 'IN-PLAY' },
  { label: 'Casino',  icon: 'casino',          path: '/casino'  },
  { label: 'Crash',   icon: 'rocket_launch',   path: '/casino'   },
  { label: 'Dice',    icon: 'casino',          path: '/casino'    },
  { label: 'Virtual', icon: 'bolt',            path: '/casino' },
  { label: 'Jackpot', icon: 'monetization_on', path: '/casino', badge: '900K' },
];

function MainNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
}) {
  return (
    <div className="cb-mainnav" style={{
      background: '#0d1f3c',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      maxWidth: '100vw',
    }}>
      <div className="cb-mainnav-inner" style={{
        display: 'flex',
        alignItems: 'center',
        maxWidth: 1440,
        margin: '0 auto',
        padding: '0 20px',          // ← left-aligned
        minWidth: 'max-content',
      }}>
        {MAIN_TABS.map(tab => (
          <Link
            key={tab.label}
            to={tab.path}
            onClick={() => setActiveTab(tab.label)}
            className="cb-mainnav-tab"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '13px 14px 11px',
              borderBottom: activeTab === tab.label
                ? '2px solid #3b82f6'
                : '2px solid transparent',
              color: activeTab === tab.label ? '#fff' : 'rgba(255,255,255,0.55)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: activeTab === tab.label ? 700 : 500,
              fontSize: '0.82rem',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
              flexShrink: 0,
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (activeTab !== tab.label)
                e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.label)
                e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>{tab.icon}</span>
            {tab.label}
            {tab.badge && (
              <span style={{
                background: tab.badge === 'IN-PLAY' ? '#ef4444' : '#3b82f6',
                color: '#fff',
                fontSize: '0.60rem',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: 4,
                letterSpacing: '0.04em',
              }}>
                {tab.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Sport Nav Pills — unified with MatchList sport tab keys ───────────────────
function SportNav({
  active,
  setActive,
}: {
  active: SportTab;
  setActive: (s: SportTab) => void;
}) {
  return (
    <div style={{
      background: '#0d1f3c',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      maxWidth: '100vw',
    }}>
      <style>{`
        .cb-sport-nav::-webkit-scrollbar { display: none; }
        @media (max-width: 480px) {
          .cb-sport-nav { padding: 8px 12px !important; gap: 5px !important; }
          .cb-sport-pill { padding: 4px 10px !important; font-size: 0.72rem !important; }
        }
      `}</style>
      <div
        className="cb-sport-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: 1440,
          margin: '0 auto',
          padding: '8px 20px',     // ← left-aligned, consistent padding
          minWidth: 'max-content',
        }}
      >
        {SPORT_TABS.map(tab => (
          <button
            key={tab.key}
            className="cb-sport-pill"
            onClick={() => setActive(tab.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 13px',
              borderRadius: 20,
              border: active === tab.key
                ? '1.5px solid #3b82f6'
                : '1.5px solid rgba(255,255,255,0.10)',
              background: active === tab.key
                ? 'rgba(59, 130, 246,0.18)'
                : 'transparent',
              color: active === tab.key ? '#60a5fa' : 'rgba(255,255,255,0.65)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: active === tab.key ? 700 : 500,
              fontSize: '0.78rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            <span className="material-icons" style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Search Bar ────────────────────────────────────────────────────────────────
function SearchBar() {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      background: focused ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)',
      border: focused
        ? '1px solid rgba(59, 130, 246,0.60)'
        : '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8,
      padding: '0 10px',
      gap: 6,
      height: 36,
      transition: 'all 0.15s',
    }}>
      <span className="material-icons" style={{
        fontSize: 16,
        color: 'rgba(255,255,255,0.40)',
        flexShrink: 0,
      }}>search</span>
      <input
        type="text"
        placeholder="Search team, league, market..."
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#fff',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.80rem',
          minWidth: 0,
        }}
      />
    </div>
  );
}

// ─── Wallet Chip ───────────────────────────────────────────────────────────────
function WalletChip({ currency }: { currency: CurrencySymbol | null }) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    walletApi.getWallet()
      .then((res: ApiResponse<Record<string, unknown>>) => {
        const data = res.data as Record<string, unknown>;
        if (typeof data?.balance === 'number') setBalance(data.balance);
      })
      .catch(() => {});
  }, []);

  const displayBalance =
    balance === null || currency === null
      ? '···'
      : formatAmount(balance, currency);

  return (
    <Link
      to="/wallet"
      className="cb-wallet-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 7,
        textDecoration: 'none',
        flexShrink: 1,
        minWidth: 0,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59, 130, 246,0.60)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
    >
      <span className="cb-wallet-amount" style={{
        padding: '6px 12px',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        fontSize: '0.82rem',
        color: '#fff',
        whiteSpace: 'nowrap',
        borderRight: '1px solid rgba(255,255,255,0.10)',
      }}>
        {displayBalance}
      </span>
    </Link>
  );
}

// ─── User Menu ─────────────────────────────────────────────────────────────────
function UserMenu() {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const { user, logout } = useAppStore();
  const navigate = useNavigate();

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 10, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 10, right: window.innerWidth - rect.right });
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const u = user as unknown as Record<string, unknown>;
  const fullName =
    [u?.firstName, u?.lastName].filter(Boolean).join(' ') ||
    (u?.email as string) ||
    'U';
  const initials = fullName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleLogout = () => { logout(); setOpen(false); navigate('/'); };

  const menuItems = [
    { label: 'My Account', to: '/account', icon: 'manage_accounts' },
    { label: 'Wallet',     to: '/wallet',  icon: 'account_balance_wallet' },
    { label: 'Deposit',    to: '/deposit', icon: 'add_circle_outline' },
  ];

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        aria-label="Menu"
        className="cb-user-menu-btn"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
          flexShrink: 0,
          outline: 'none',
          padding: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      >
        <span className="material-icons" style={{ fontSize: 20 }}>menu</span>
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: coords.top,
          right: coords.right,
          minWidth: 224,
          maxWidth: '90vw',
          background: '#0d1f3c',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
          overflow: 'hidden',
          zIndex: 99999,
          animation: 'cbDropIn 0.15s ease-out',
        }}>
          {/* Profile header */}
          <div style={{
            padding: '14px 16px 12px',
            background: '#1a3a6b',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              fontSize: '0.85rem',
              color: '#fff',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                margin: 0,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: '0.88rem',
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {fullName}
              </p>
              <p style={{
                margin: '2px 0 0',
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.74rem',
                color: 'rgba(255,255,255,0.55)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {u?.email as string ?? ''}
              </p>
            </div>
          </div>

          {menuItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 16px',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '0.83rem',
                color: 'rgba(255,255,255,0.85)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59, 130, 246,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="material-icons" style={{ fontSize: 18, color: '#60a5fa' }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '11px 16px',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: '0.83rem',
              color: '#f87171',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span className="material-icons" style={{ fontSize: 18, color: '#f87171' }}>logout</span>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Deposit Button ────────────────────────────────────────────────────────────
function DepositBtn() {
  return (
    <Link
      to="/deposit"
      className="cb-deposit-btn"
      title="Deposit"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: '#1d4ed8',
        border: 'none',
        borderRadius: 7,
        padding: '7px 16px',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 800,
        fontSize: '0.82rem',
        color: '#fff',
        textDecoration: 'none',
        flexShrink: 0,
        letterSpacing: '0.04em',
        transition: 'background 0.15s, transform 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#1d4ed8';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#1d4ed8';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <span className="material-icons" style={{ fontSize: 15 }}>add</span>
      <span className="cb-deposit-label">DEPOSIT</span>
    </Link>
  );
}

// ─── Props exposed to parent (e.g. App or layout) ─────────────────────────────
interface HeaderProps {
  /** Lift active sport up so MatchList can consume it */
  activeSport: SportTab;
  onSportChange: (s: SportTab) => void;
}

// ─── Header ───────────────────────────────────────────────────────────────────
export default function Header({ activeSport, onSportChange }: HeaderProps) {
  const [scrolled, setScrolled]   = useState(false);
  const { symbol: countrySymbol } = useCountry();
  const [currency, setCurrency]   = useState<CurrencySymbol | null>({ symbol: countrySymbol });
  const [activeTab, setActiveTab] = useState('Sports');
  const { user, modalOpen }       = useAppStore();
  const isLoggedIn                = !!user;
  const location                  = useLocation();
  const isHomePage                = location.pathname === '/';

  // Currency is derived synchronously from the registered country.
  useEffect(() => { setCurrency({ symbol: countrySymbol }); }, [countrySymbol]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Whole header is home-page only — render nothing on any other route
  if (!isHomePage) return null;

  return (
    <>
      {/* Load Google Material Icons */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700;1,800;1,900&display=swap');

        /* ── Sticky header wrapper ── */
        .cb-header-wrap {
          position: sticky;
          top: 0;
          z-index: 9997;
          width: 100%;
          max-width: 100vw;
          transform: ${modalOpen ? 'translateY(-100%)' : 'translateY(0)'};
          transition: transform 0.3s ease-in-out;
          box-shadow: ${scrolled ? '0 4px 24px rgba(0,0,0,0.50)' : 'none'};
          box-sizing: border-box;
        }
        .cb-header-wrap * { box-sizing: border-box; }

        /* ── Top bar ── */
        .cb-topbar { background: #0d1f3c; border-bottom: 1px solid rgba(255,255,255,0.06); max-width: 100vw; overflow: visible; }

        .cb-topbar-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 20px;
          height: 60px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 14px;
        }

        /* ── Logo ── */
        .cb-logo-word { font-size: 1.30rem; }
        .cb-logo-sub  { display: block; }
        .cb-logo-gap  { gap: 10px; }

        /* ── Auth buttons ── */
        .cb-btn-join {
          font-family: 'Inter', sans-serif;
          font-weight: 800;
          font-size: 0.82rem;
          letter-spacing: 0.04em;
          color: #1d4ed8;
          background: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 7px;
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.12s;
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
        }
        .cb-btn-join:hover { opacity: 0.88; transform: translateY(-1px); }

        .cb-btn-login {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 0.82rem;
          color: #ffffff;
          background: transparent;
          border: 1.5px solid rgba(255,255,255,0.35);
          padding: 6px 16px;
          border-radius: 7px;
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.15s;
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
        }
        .cb-btn-login:hover { background: rgba(255,255,255,0.10); }

        /* ── Dropdown animation ── */
        @keyframes cbDropIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Hide search on very small screens, and generally shrink the topbar ── */
        @media (max-width: 480px) {
          .cb-topbar-inner {
            height: 52px;
            padding: 0 12px;
            gap: 6px;
            display: flex;        /* flex on mobile — no search so no centering needed */
            min-width: 0;
          }
          .cb-search { display: none !important; }

          /* Let the logo shrink instead of forcing overflow */
          .cb-logo-gap  { gap: 6px !important; }
          .cb-logo-svg  { width: 34px !important; height: 34px !important; }
          .cb-logo-word { font-size: 1.02rem !important; }
          .cb-logo-sub  { display: none !important; } /* drop "AFRICA" subtitle to save width */

          /* Push the right-side controls (Join/Login or Wallet/Deposit/Menu) to the
             far edge so there's clear space between the logo and them, and let them shrink */
          .cb-right-controls {
            margin-left: auto;
            gap: 6px !important;
            min-width: 0;
            flex-shrink: 1;
          }

          /* Compact auth buttons */
          .cb-btn-join  { padding: 6px 12px !important; font-size: 0.74rem !important; }
          .cb-btn-login { padding: 5px 11px !important; font-size: 0.74rem !important; }

          /* Compact wallet chip */
          .cb-wallet-chip  { min-width: 0; }
          .cb-wallet-amount { padding: 5px 8px !important; font-size: 0.72rem !important; }

          /* Deposit button: icon only, no label */
          .cb-deposit-btn   { padding: 7px 9px !important; gap: 0 !important; }
          .cb-deposit-label { display: none !important; }

          /* Slightly smaller menu trigger */
          .cb-user-menu-btn { width: 32px !important; height: 32px !important; }
        }

        @media (max-width: 360px) {
          .cb-logo-svg  { width: 28px !important; height: 28px !important; }
          .cb-logo-word { font-size: 0.88rem !important; }
          .cb-btn-join  { padding: 5px 9px !important; font-size: 0.68rem !important; }
          .cb-btn-login { padding: 4px 8px !important; font-size: 0.68rem !important; }
        }

        /* ── Hide scrollbar on sport/main nav ── */
        .cb-mainnav::-webkit-scrollbar,
        .cb-sport-nav::-webkit-scrollbar { display: none; }
        .cb-mainnav { max-width: 100vw; }

        @media (max-width: 480px) {
          .cb-mainnav-inner { padding: 0 12px !important; }
          .cb-mainnav-tab   { padding: 11px 10px 9px !important; font-size: 0.76rem !important; }
        }
      `}</style>

      <div className="cb-header-wrap">

        {/* ── Top Bar ── */}
        <div className="cb-topbar">
          <div className="cb-topbar-inner">

            {/* Logo — Sky mark */}
            <Link to="/" style={{ textDecoration: 'none', flexShrink: 0, userSelect: 'none', minWidth: 0 }}>
              <div className="cb-logo-gap" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>

                {/* Sky mark — sun + cloud silhouette */}
                <svg className="cb-logo-svg" width="46" height="46" viewBox="0 0 44 44" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <defs>
                    <linearGradient id="cbBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f0f9ff"/>
                      <stop offset="35%"  stopColor="#bfdbfe"/>
                      <stop offset="70%"  stopColor="#3b82f6"/>
                      <stop offset="100%" stopColor="#1d4ed8"/>
                    </linearGradient>
                    <linearGradient id="cbBlueEdge" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#0c4a6e"/>
                      <stop offset="50%"  stopColor="#f0f9ff"/>
                      <stop offset="100%" stopColor="#0c4a6e"/>
                    </linearGradient>
                    <radialGradient id="cbSun" cx="35%" cy="30%" r="75%">
                      <stop offset="0%"  stopColor="#f0f9ff"/>
                      <stop offset="55%" stopColor="#bfdbfe"/>
                      <stop offset="100%" stopColor="#3b82f6"/>
                    </radialGradient>
                    <filter id="cbShadow" x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#0a1628" floodOpacity="0.45"/>
                    </filter>
                  </defs>

                  <g filter="url(#cbShadow)">
                    {/* Sun */}
                    <circle cx="16" cy="15" r="7.5" fill="url(#cbSun)" stroke="url(#cbBlueEdge)" strokeWidth="1.1"/>
                    {/* Sun rays */}
                    <path d="M16 3.5 V1 M25.5 6.5 L27.3 4.7 M4.7 4.7 L6.5 6.5" stroke="#bfdbfe" strokeWidth="1.4" strokeLinecap="round"/>

                    {/* Cloud silhouette */}
                    <path
                      d="M9 33 C4.5 33 1.5 29.6 1.5 26 C1.5 22.4 4.5 19.5 8 19.4
                         C8.9 15.2 12.7 12 17.2 12 C21.9 12 25.8 15.4 26.5 19.9
                         C31 20.2 34.5 23.8 34.5 28.1 C34.5 32.5 30.9 33 27 33 Z"
                      fill="url(#cbBlue)"
                      stroke="url(#cbBlueEdge)"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                      transform="translate(4, 4) scale(0.98)"
                    />
                    {/* Highlight sweep on cloud */}
                    <path d="M11 25 C14 21.5 21 21 25 24.5" stroke="#f0f9ff" strokeOpacity="0.6" strokeWidth="1" strokeLinecap="round" transform="translate(4, 4) scale(0.98)"/>
                  </g>
                </svg>

                {/* Wordmark — SKY + BET on one line */}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
                    <span className="cb-logo-word" style={{
                      fontFamily: "'Arial Black', Arial, sans-serif",
                      fontWeight: 900,
                      fontStyle: 'italic',
                      letterSpacing: '0.02em',
                      color: '#ffffff',
                      textTransform: 'uppercase',
                      lineHeight: 1,
                    }}>SKY</span>
                    <span className="cb-logo-word" style={{
                      fontFamily: "'Arial Black', Arial, sans-serif",
                      fontWeight: 900,
                      fontStyle: 'italic',
                      letterSpacing: '0.02em',
                      color: '#60a5fa',
                      textTransform: 'uppercase',
                      lineHeight: 1,
                    }}>BET</span>
                  </div>
                  <span className="cb-logo-sub" style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '0.50rem',
                    letterSpacing: '0.30em',
                    color: 'rgba(255,255,255,0.38)',
                    textTransform: 'uppercase',
                    marginTop: 3,
                    whiteSpace: 'nowrap',
                  }}>AFRICA</span>
                </div>

              </div>
            </Link>

            {/* Search — centered via grid middle column */}
            <div className="cb-search" style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
              <SearchBar />
            </div>

            {/* Right controls — flush right via grid; margin-left:auto kicks in on mobile flex layout */}
            <div className="cb-right-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, justifyContent: 'flex-end' }}>
              {isLoggedIn ? (
                <>
                  <WalletChip currency={currency} />
                  <DepositBtn />
                  <UserMenu />
                </>
              ) : (
                <>
                  <Link to="/register" className="cb-btn-join">Join Now</Link>
                  <Link to="/login"    className="cb-btn-login">Log In</Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Winner Ticker ── */}
        <WinnerTicker />

        {/* ── Main Nav (Sports / Live / Casino …) ── */}
        <MainNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* ── Sport Pills — shown on Sports tab; keys match MatchList ── */}
        {activeTab === 'Sports' && (
          <SportNav active={activeSport} setActive={onSportChange} />
        )}

      </div>
    </>
  );
}