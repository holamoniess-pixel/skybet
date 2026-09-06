import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { COUNTRIES, formatMoney, type CountryConfig } from '../config/countries';
import { suggestCountryCode } from '../utils/country';
import { markVisited } from '../utils/session';

/* ============================================================================
   GUEST LANDING
   ----------------------------------------------------------------------------
   Where a first-time visitor arriving on a direct link ends up. The goal is to
   get someone into the product in one tap instead of putting a registration
   wall in front of a stranger.

   A guest gets:
     - a country (which fixes their currency and stake floor immediately, so
       nothing they see is priced in the wrong money)
     - play credits
     - full run of the sports book and the casino in demo mode

   What they can't do is deposit, withdraw or place real bets. Every one of
   those actions routes into the fill-in registration at /join, which carries
   across whatever they've already told us.
   ========================================================================== */

export default function GuestLandingPage() {
  const navigate = useNavigate();
  const { startGuest, countryCode, setCountry } = useAppStore();

  const [selected, setSelected] = useState<CountryConfig>(
    COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0],
  );
  const [picking, setPicking] = useState(false);
  const [touched, setTouched] = useState(false);

  /* Suggest a country from locale/IP so the common case is zero taps. It's a
     suggestion only — the user can change it here, and changes again at
     registration if they want. */
  useEffect(() => {
    if (touched) return;
    let alive = true;
    void suggestCountryCode().then((code) => {
      if (!alive || touched) return;
      const match = COUNTRIES.find((c) => c.code === code);
      if (match) setSelected(match);
    });
    return () => {
      alive = false;
    };
  }, [touched]);

  const enterAsGuest = () => {
    setCountry(selected.code);
    startGuest(selected.code);
    markVisited();
    navigate('/', { replace: true });
  };

  const goRegister = () => {
    setCountry(selected.code);
    markVisited();
    navigate('/register');
  };

  return (
    <>
      <style>{`
        .cb-guest-wrap {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: 2rem 1.25rem;
          font-family: 'Inter', sans-serif;
          background:
            radial-gradient(circle at 20% 0%, rgba(59, 130, 246,0.18) 0%, rgba(59, 130, 246,0) 55%),
            linear-gradient(165deg, #0d1f3c 0%, #060f1f 100%);
        }
        .cb-guest-card {
          width: 100%; max-width: 460px;
          background: rgba(13,31,60,0.85);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 20px;
          box-shadow: 0 12px 56px rgba(0,0,0,0.6);
          padding: 2rem 1.75rem 1.75rem;
          backdrop-filter: blur(12px);
        }
        .cb-guest-primary {
          width: 100%; padding: 1rem;
          background: #1d4ed8; color: #fff;
          border: none; border-radius: 12px;
          font-size: 0.95rem; font-weight: 700; letter-spacing: 0.03em;
          cursor: pointer; font-family: inherit;
          transition: all 0.2s; min-height: 54px;
        }
        .cb-guest-primary:hover {
          background: #1d4ed8; transform: translateY(-1px);
          box-shadow: 0 8px 26px rgba(29, 78, 216,0.45);
        }
        .cb-guest-secondary {
          width: 100%; padding: 0.9rem;
          background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.75);
          border: 1.5px solid rgba(255,255,255,0.14); border-radius: 12px;
          font-size: 0.88rem; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: all 0.15s;
        }
        .cb-guest-secondary:hover { background: rgba(255,255,255,0.10); color: #fff; }
        .cb-country-btn {
          width: 100%; padding: 0.85rem 1rem;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 12px; color: #fff; cursor: pointer;
          display: flex; align-items: center; gap: 0.65rem;
          font-family: inherit; font-size: 0.9rem; box-sizing: border-box;
        }
        .cb-country-list {
          margin-top: 0.5rem; max-height: 240px; overflow-y: auto;
          border: 1.5px solid rgba(255,255,255,0.12); border-radius: 12px;
          background: #0d1f3c;
        }
        .cb-country-item {
          width: 100%; display: flex; align-items: center; gap: 0.65rem;
          padding: 0.7rem 0.9rem; background: transparent; border: none;
          color: #fff; cursor: pointer; text-align: left;
          font-size: 0.875rem; font-family: inherit;
        }
        .cb-country-item:hover { background: rgba(255,255,255,0.07); }
        @keyframes cbFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cb-guest-card { animation: cbFadeUp 0.35s ease; }
      `}</style>

      <div className="cb-guest-wrap">
        <div className="cb-guest-card">
          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: 56, height: 56, margin: '0 auto 0.9rem',
                borderRadius: 14, background: '#1d4ed8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontStyle: 'italic', fontSize: '1.35rem', color: '#fff',
              }}
            >
              CB
            </div>
            <h1
              style={{
                fontSize: '1.6rem', fontWeight: 900, color: '#fff',
                margin: 0, lineHeight: 1.2,
              }}
            >
              Welcome to SkyBet
            </h1>
            <p
              style={{
                color: 'rgba(255,255,255,0.50)', fontSize: '0.88rem',
                margin: '0.5rem 0 0', lineHeight: 1.5,
              }}
            >
              Look around first — no account needed. Pick where you're playing
              from and we'll set your currency.
            </p>
          </div>

          {/* Country picker */}
          <div style={{ marginBottom: '1.1rem' }}>
            <label
              style={{
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'rgba(255,255,255,0.42)',
                display: 'block', marginBottom: '0.45rem',
              }}
            >
              Your country
            </label>

            <button
              type="button"
              className="cb-country-btn"
              onClick={() => setPicking((v) => !v)}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{selected.flag}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{selected.name}</span>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                {selected.symbol} {selected.currency}
              </span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.4)" strokeWidth="2.5"
                style={{
                  transform: picking ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {picking && (
              <div className="cb-country-list">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className="cb-country-item"
                    style={{
                      background:
                        c.code === selected.code ? 'rgba(59, 130, 246,0.16)' : 'transparent',
                    }}
                    onClick={() => {
                      setSelected(c);
                      setTouched(true);
                      setPicking(false);
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{c.flag}</span>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      {c.symbol}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* What guest mode gives you */}
          <div
            style={{
              background: 'rgba(59, 130, 246,0.08)',
              border: '1px solid rgba(59, 130, 246,0.22)',
              borderRadius: 12, padding: '0.9rem 1rem', marginBottom: '1.25rem',
            }}
          >
            {[
              `${formatMoney(500, selected)} in play credits`,
              'Full sports book and casino in demo mode',
              `Prices in ${selected.currency} · min stake ${formatMoney(selected.minStake, selected)}`,
            ].map((line) => (
              <div
                key={line}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  padding: '0.2rem 0',
                }}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#60a5fa" strokeWidth="3"
                  style={{ marginTop: 3, flexShrink: 0 }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
                  {line}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <button type="button" className="cb-guest-primary" onClick={enterAsGuest}>
              Explore as guest →
            </button>
            <button type="button" className="cb-guest-secondary" onClick={goRegister}>
              Create a full account
            </button>
          </div>

          <p
            style={{
              textAlign: 'center', fontSize: '0.82rem',
              color: 'rgba(255,255,255,0.42)', margin: '1.1rem 0 0',
            }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}
              onClick={markVisited}
            >
              Log in
            </Link>
          </p>

          <p
            style={{
              textAlign: 'center', fontSize: '0.68rem',
              color: 'rgba(255,255,255,0.28)', margin: '0.9rem 0 0', lineHeight: 1.5,
            }}
          >
            18+ only. Guest play uses virtual credits with no cash value.
          </p>
        </div>
      </div>
    </>
  );
}
