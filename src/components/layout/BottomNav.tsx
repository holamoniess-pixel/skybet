import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import HomeIcon from '@mui/icons-material/Home';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const BRAND_PRIMARY   = '#1d4ed8';
const BRAND_ACCENT    = '#3b82f6';
const BRAND_ACCENT_LT = '#93c5fd';
const BRAND_NAVY      = '#0d1f3c';
const BRAND_NAVY_DEEP = '#080f1e';
const INACTIVE        = 'rgba(148,163,184,0.55)';

const navItems = [
  { to: '/',        label: 'Home',     icon: <HomeIcon fontSize="medium" /> },
  { to: '/casino',  label: 'Casino',   icon: <CasinoRoundedIcon fontSize="medium" /> },
  { to: '/betslip', label: 'Bet Slip', icon: <ReceiptLongIcon fontSize="medium" /> },
  { to: '/account', label: 'Account',  icon: <AccountCircleIcon fontSize="medium" /> },
];

export default function BottomNav() {
  const location = useLocation();
  const betSlip   = useAppStore((s) => s.betSlip);
  const modalOpen = useAppStore((s) => s.modalOpen);

  const activeIndex = navItems.findIndex((item) => item.to === location.pathname);
  const itemCount   = navItems.length;

  return (
    <>
      <style>{`
        @keyframes blobRise {
          0%   { transform: translateY(4px) scale(0.88); opacity: 0.4; }
          60%  { transform: translateY(-14px) scale(1.06); opacity: 1; }
          100% { transform: translateY(-10px) scale(1); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; transform: translateX(-50%) scaleX(1); }
          50%      { opacity: 0.9; transform: translateX(-50%) scaleX(1.2); }
        }
        @keyframes badgeIn {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          70%  { transform: scale(1.3) rotate(4deg);  opacity: 1; }
          100% { transform: scale(1) rotate(0deg);    opacity: 1; }
        }
        @keyframes trackSlide {
          from { opacity: 0; transform: scaleX(0.6); }
          to   { opacity: 1; transform: scaleX(1); }
        }

        .wb-link { -webkit-tap-highlight-color: transparent; user-select: none; }

        /* ── pill wrap ───────────────────────────────── */
        .wb-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 22px;
          transition: transform .25s cubic-bezier(.34,1.56,.64,1),
                      background .25s ease,
                      box-shadow .25s ease,
                      border-radius .35s cubic-bezier(.34,1.56,.64,1);
        }

        /* active: wide pill, lifted */
        .wb-link.is-active .wb-pill {
          width: 64px;
          border-radius: 32px;
          background: ${BRAND_PRIMARY};
          box-shadow:
            0 0 0 3px ${BRAND_NAVY},
            0 0 0 5px rgba(59,130,246,.35),
            0 8px 22px rgba(29,78,216,.55);
          animation: blobRise .45s cubic-bezier(.34,1.56,.64,1) both;
        }

        /* inactive hover (desktop) */
        @media (hover: hover) {
          .wb-link:not(.is-active):hover .wb-pill {
            transform: translateY(-3px);
            background: rgba(59,130,246,.1);
          }
          .wb-link:not(.is-active):hover .wb-label {
            color: ${BRAND_ACCENT_LT} !important;
          }
        }

        /* press */
        .wb-link:active .wb-pill { transform: scale(0.86); transition-duration: .07s; }
        .wb-link.is-active:active .wb-pill { transform: translateY(-10px) scale(0.93); }

        /* glow smear under active icon */
        .wb-glow {
          position: absolute;
          left: 50%; bottom: -2px;
          width: 56px; height: 12px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(59,130,246,.65) 0%, transparent 72%);
          filter: blur(2px);
          animation: glowPulse 2.6s ease-in-out infinite;
        }

        .wb-badge {
          animation: badgeIn .38s cubic-bezier(.34,1.56,.64,1) both;
        }
        .wb-track {
          animation: trackSlide .32s cubic-bezier(.34,1.56,.64,1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .wb-link.is-active .wb-pill,
          .wb-badge, .wb-glow, .wb-track { animation: none !important; }
        }
      `}</style>

      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-[9999] transition-transform duration-300 ease-in-out ${
          modalOpen ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{
          background: `linear-gradient(175deg, ${BRAND_NAVY} 0%, ${BRAND_NAVY_DEEP} 100%)`,
          borderTop: `1px solid rgba(59,130,246,.14)`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -6px 32px rgba(0,0,0,.45)',
          overflow: 'visible',
        }}
      >
        {/* sliding top-edge indicator */}
        <div style={{ position: 'relative', height: 0 }}>
          {activeIndex >= 0 && (
            <div
              key={activeIndex}
              className="wb-track"
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: `${(activeIndex / itemCount) * 100}%`,
                width: `${100 / itemCount}%`,
                display: 'flex',
                justifyContent: 'center',
                transition: 'left .4s cubic-bezier(.34,1.56,.64,1)',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 3,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${BRAND_ACCENT}, ${BRAND_ACCENT_LT})`,
                  boxShadow: `0 0 10px rgba(59,130,246,.8)`,
                  display: 'block',
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
                aria-current={isActive ? 'page' : undefined}
                className={`wb-link relative flex flex-col items-center gap-1 px-2 py-1.5 ${isActive ? 'is-active' : ''}`}
                style={{ color: isActive ? BRAND_ACCENT_LT : INACTIVE }}
              >
                <div style={{ position: 'relative' }}>
                  {isActive && <span className="wb-glow" aria-hidden="true" />}

                  <div className="wb-pill">
                    <span
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        color: isActive ? '#fff' : 'inherit',
                        filter: isActive ? `drop-shadow(0 0 5px rgba(147,197,253,.7))` : 'none',
                      }}
                    >
                      {item.icon}
                    </span>

                    {item.to === '/betslip' && betSlip.length > 0 && (
                      <span
                        key={betSlip.length}
                        className="wb-badge absolute -top-1 -right-1.5 text-white font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5"
                        style={{
                          background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_ACCENT})`,
                          fontSize: '9px',
                          border: `1.5px solid ${BRAND_NAVY}`,
                        }}
                      >
                        {betSlip.length}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className="wb-label leading-none"
                  style={{
                    fontSize: '10px',
                    fontWeight: isActive ? 700 : 400,
                    letterSpacing: isActive ? '0.02em' : '0',
                    transition: 'color .2s ease, font-weight .2s ease',
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