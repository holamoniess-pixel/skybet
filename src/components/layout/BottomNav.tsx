import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

// ─── Brand system — matches Header.tsx / BetSlipPage.tsx exactly ─────────────
// Slightly deepened / more saturated blue family so the active state reads
// richer without drifting away from brand blue.
const BRAND_PRIMARY      = '#1d4ed8'; // deep blue
const BRAND_ACCENT       = '#3b82f6'; // bright blue
const BRAND_ACCENT_LIGHT = '#60a5fa'; // icy sky-blue highlight (was #60a5fa — a touch cooler & brighter for contrast)
const BRAND_GLOW         = '#3b82f6'; // cyan-leaning blue used only for glow/ring accents
const BRAND_NAVY         = '#0d1f3c';
const BRAND_NAVY_DEEP    = '#0a1628';
const WIN_GOLD           = '#FFD700';

// ─── Nav items ────────────────────────────────────────────────────────────
// Live-matches tab removed; Wallet and Casino added per request.
const navItems = [
  { to: '/',        label: 'Home',    icon: <HomeIcon fontSize="medium" /> },
  { to: '/wallet',  label: 'Wallet',  icon: <AccountBalanceWalletRoundedIcon fontSize="medium" /> },
  { to: '/casino',  label: 'Casino',  icon: <CasinoRoundedIcon fontSize="medium" /> },
  { to: '/betslip', label: 'Bet Slip', icon: <ReceiptLongIcon fontSize="medium" /> },
  { to: '/account', label: 'Account', icon: <AccountCircleIcon fontSize="medium" /> },
];

export default function BottomNav() {
  const location = useLocation();
  const betSlip   = useAppStore((s) => s.betSlip);
  const modalOpen = useAppStore((s) => s.modalOpen);

  const activeIndex = navItems.findIndex((item) => item.to === location.pathname);
  const itemCount = navItems.length;

  return (
    <>
      <style>{`
        /* Active icon lifts into a floating capsule, settles with a soft spring */
        @keyframes wbNavRise {
          0%   { transform: translateY(0) scale(0.9); }
          55%  { transform: translateY(-15px) scale(1.08); }
          100% { transform: translateY(-11px) scale(1); }
        }
        @keyframes wbHaloBreathe {
          0%, 100% { opacity: 0.45; transform: translateX(-50%) scale(1); }
          50%      { opacity: 0.8;  transform: translateX(-50%) scale(1.15); }
        }
        @keyframes wbBadgeIn {
          0%   { transform: scale(0); opacity: 0; }
          65%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wbBadgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246,0.5); }
          50%      { box-shadow: 0 0 0 5px rgba(59, 130, 246,0); }
        }
        @keyframes wbTrackGlide {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .wb-nav-link { -webkit-tap-highlight-color: transparent; }

        .wb-nav-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1),
                      background 0.3s ease,
                      box-shadow 0.3s ease;
        }

        /* Hover — desktop / mouse-capable devices only, no interference on touch */
        @media (hover: hover) {
          .wb-nav-link:not(.is-active):hover .wb-nav-icon-wrap {
            transform: translateY(-4px) scale(1.08);
            background: rgba(59, 130, 246,0.10);
            box-shadow: 0 4px 14px rgba(29, 78, 216,0.28);
          }
          .wb-nav-link:not(.is-active):hover .wb-nav-label {
            color: ${BRAND_ACCENT_LIGHT} !important;
          }
          .wb-nav-link.is-active:hover .wb-nav-icon-wrap {
            transform: translateY(-13px) scale(1.04);
          }
        }

        /* Tactile press feedback for touch and mouse alike */
        .wb-nav-link:active .wb-nav-icon-wrap {
          transform: scale(0.88);
          transition-duration: 0.08s;
        }
        .wb-nav-link.is-active:active .wb-nav-icon-wrap {
          transform: translateY(-11px) scale(0.94);
        }

        .wb-nav-link.is-active .wb-nav-icon-wrap {
          width: 46px;
          height: 46px;
          background: linear-gradient(150deg, ${BRAND_PRIMARY}, ${BRAND_ACCENT} 60%, ${BRAND_GLOW});
          box-shadow: 0 8px 20px rgba(29, 78, 216,0.45), 0 0 0 4px ${BRAND_NAVY};
          animation: wbNavRise 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        /* Soft halo sitting under the elevated active icon */
        .wb-nav-halo {
          position: absolute;
          left: 50%;
          bottom: -6px;
          width: 50px;
          height: 16px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(59, 130, 246,0.5) 0%, rgba(59, 130, 246,0) 75%);
          filter: blur(1px);
          pointer-events: none;
          animation: wbHaloBreathe 2.4s ease-in-out infinite;
        }

        .wb-nav-badge {
          animation: wbBadgeIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both,
                     wbBadgePulse 2.2s ease-in-out 0.5s infinite;
        }

        .wb-nav-track {
          animation: wbTrackGlide 0.3s ease both;
        }

        @media (prefers-reduced-motion: reduce) {
          .wb-nav-link.is-active .wb-nav-icon-wrap,
          .wb-nav-badge,
          .wb-nav-halo,
          .wb-nav-track { animation: none !important; }
        }
      `}</style>

      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-[9999] transition-transform duration-300 ease-in-out ${
          modalOpen ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{
          background: `linear-gradient(180deg, ${BRAND_NAVY} 0%, ${BRAND_NAVY_DEEP} 100%)`,
          borderTop: `1px solid rgba(59, 130, 246,0.18)`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 28px rgba(0,0,0,0.35)',
          overflow: 'visible',
        }}
      >
        {/* Thin sliding underline that tracks the active tab across the top edge */}
        <div style={{ position: 'relative', height: 0 }}>
          {activeIndex >= 0 && (
            <div
              key={activeIndex}
              className="wb-nav-track"
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: `${(activeIndex / itemCount) * 100}%`,
                width: `${100 / itemCount}%`,
                display: 'flex',
                justifyContent: 'center',
                transition: 'left 0.38s cubic-bezier(0.34,1.56,0.64,1)',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${BRAND_ACCENT}, ${BRAND_GLOW})`,
                  boxShadow: `0 0 8px rgba(59, 130, 246,0.7)`,
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`wb-nav-link relative flex flex-col items-center gap-1.5 px-3 py-1.5 rounded-lg ${isActive ? 'is-active' : ''}`}
                style={{ color: isActive ? BRAND_ACCENT_LIGHT : 'rgba(255,255,255,0.45)' }}
              >
                <div className="wb-nav-icon-wrap">
                  {isActive && <span className="wb-nav-halo" aria-hidden="true" />}
                  <span
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      color: isActive ? '#ffffff' : 'inherit',
                      filter: isActive ? `drop-shadow(0 0 6px rgba(59, 130, 246,0.7))` : 'none',
                    }}
                  >
                    {item.icon}
                  </span>

                  {item.to === '/betslip' && betSlip.length > 0 && (
                    <span
                      key={betSlip.length}
                      className="wb-nav-badge absolute -top-1 -right-1.5 text-white font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5"
                      style={{
                        background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GLOW})`,
                        fontSize: '9px',
                        border: `1px solid rgba(255,255,255,0.4)`,
                      }}
                    >
                      {betSlip.length}
                    </span>
                  )}
                </div>

                <span
                  className="wb-nav-label leading-none transition-colors duration-200"
                  style={{
                    fontSize: '10.5px',
                    fontWeight: isActive ? 700 : 500,
                    marginTop: isActive ? '2px' : '0px',
                    transition: 'margin-top 0.3s cubic-bezier(0.34,1.56,0.64,1), color 0.2s ease',
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}