import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store';
import { auth } from '../utils/api';
import { saveSession } from './LoginPage';
import { setStoredCountry } from '../utils/session';
import { COUNTRIES, formatMoney, getCountry, type CountryConfig } from '../config/countries';

/* ============================================================================
   FILL-IN REGISTRATION  (/join)
   ----------------------------------------------------------------------------
   The SECOND of the two registration flows.

     /register  — the classic form. Four grouped steps, everything visible,
                  built for someone who arrived intending to sign up.

     /join      — this one. A guest is already inside the product with a
                  country, play credits and possibly a name they typed
                  somewhere. Throwing the full form at them discards all of
                  that and reads as a wall.

   So this asks ONE thing per screen, in plain language, and pre-fills every
   answer it already has from the guest draft. Anything already known is
   skipped outright — a guest who gave a name earlier starts at the email
   question, not at the beginning.

   Both flows hit the same auth.register() endpoint and produce identical
   accounts. The difference is purely how much is asked at once.
   ========================================================================== */

type FieldKey = 'country' | 'name' | 'email' | 'password' | 'phone';

interface FieldDef {
  key: FieldKey;
  question: string;
  sub: string;
}

const FIELDS: FieldDef[] = [
  { key: 'country',  question: "Where are you playing from?", sub: 'This sets your currency and stake limits.' },
  { key: 'name',     question: "What should we call you?",     sub: 'Your name on withdrawals and receipts.' },
  { key: 'email',    question: "What's your email?",           sub: "We'll send confirmations here." },
  { key: 'password', question: 'Pick a password',              sub: 'At least 8 characters.' },
  { key: 'phone',    question: "What's your number?",          sub: 'Used for withdrawals and account recovery.' },
];

function mapRole(r: string): 'user' | 'admin' {
  return ['ADMIN', 'admin', 'SUPER_ADMIN', 'super_admin'].includes(r) ? 'admin' : 'user';
}

const input: React.CSSProperties = {
  width: '100%', padding: '1rem 1.05rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1.5px solid rgba(255,255,255,0.12)',
  borderRadius: 12, fontSize: '1rem', color: '#fff',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

export default function FillInRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, showToast, guest, isGuest, countryCode, setCountry: setStoreCountry, updateGuestDraft, endGuest } =
    useAppStore();

  const draft = guest?.draft ?? {};

  const [country, setCountryLocal] = useState<CountryConfig>(getCountry(guest?.country ?? countryCode));
  const [form, setForm] = useState({
    firstName: draft.firstName ?? '',
    lastName: draft.lastName ?? '',
    email: draft.email ?? '',
    password: '',
    phoneLocal: draft.phone ?? '',
    referralCode: searchParams.get('ref') ?? '',
  });

  /* Start on the first question we don't already have an answer to. A guest
     who gave their name while poking around shouldn't be asked again. */
  const firstUnanswered = () => {
    if (!draft.firstName) return 1;   // country is pre-set from guest mode
    if (!draft.email) return 2;
    return 3;
  };

  const [idx, setIdx] = useState(isGuest ? firstUnanswered() : 0);
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [idx]);

  const field = FIELDS[idx];
  const isLast = idx === FIELDS.length - 1;
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const fullPhone = form.phoneLocal.trim()
    ? `${country.dial}${form.phoneLocal.trim().replace(/^0/, '')}`
    : '';

  const validate = (): string | null => {
    switch (field.key) {
      case 'name':
        if (!form.firstName.trim()) return 'Please enter your first name.';
        if (!form.lastName.trim()) return 'Please enter your last name.';
        return null;
      case 'email':
        if (!/\S+@\S+\.\S+/.test(form.email)) return 'That email doesn\u2019t look right.';
        return null;
      case 'password':
        if (form.password.length < 8) return 'Password must be at least 8 characters.';
        return null;
      case 'phone':
        if (!terms) return 'Please accept the Terms & Conditions.';
        return null;
      default:
        return null;
    }
  };

  /* Persist each answer into the guest draft as it's given, so closing the
     tab halfway through doesn't lose the progress. */
  const saveDraft = () => {
    if (!isGuest) return;
    updateGuestDraft({
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      email: form.email || undefined,
      phone: form.phoneLocal || undefined,
    });
  };

  const next = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    saveDraft();
    if (isLast) void submit();
    else setIdx((i) => i + 1);
  };

  const back = () => {
    setError(null);
    setIdx((i) => Math.max(0, i - 1));
  };

  const submit = async () => {
    setLoading(true);
    try {
      const res = await auth.register({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: fullPhone || undefined,
        country: country.code,
        ref: form.referralCode.trim() || undefined,
      });
      if (!res.success || !res.data?.accessToken) {
        throw new Error(res.message ?? 'Registration failed.');
      }
      const { user: u } = res.data;
      saveSession(res.data, true);
      setStoredCountry(country.code);
      setStoreCountry(country.code);
      endGuest();
      login({
        id: u.id,
        fullName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        phone: u.phone ?? '',
        email: u.email,
        role: mapRole(u.role),
        kycStatus: 'unverified',
        referralCode: '',
      });
      setDone(true);
      showToast('Account created. Welcome to SkyBet!', 'success');
      setTimeout(() => navigate('/'), 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      next();
    }
  };

  if (done) {
    return (
      <div style={wrap}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%', background: '#22c55e',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.1rem',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
            You're in
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.4rem' }}>
            Taking you to the lobby…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .cb-join-input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246,0.18) !important;
        }
        .cb-join-next {
          width: 100%; padding: 1rem; background: #1d4ed8; color: #fff;
          border: none; border-radius: 12px; font-size: 0.95rem; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: all 0.2s; min-height: 54px;
        }
        .cb-join-next:hover:not(:disabled) {
          background: #1d4ed8; transform: translateY(-1px);
          box-shadow: 0 8px 26px rgba(29, 78, 216,0.45);
        }
        .cb-join-next:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes cbSlide {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .cb-join-panel { animation: cbSlide 0.22s ease; }
        @keyframes cbSpin { to { transform: rotate(360deg); } }
        .cb-spin {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%; display: inline-block;
          animation: cbSpin 0.8s linear infinite; margin-right: 8px;
        }
      `}</style>

      <div style={wrap}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* Progress */}
          <div style={{ display: 'flex', gap: 6, marginBottom: '1.6rem' }}>
            {FIELDS.map((f, i) => (
              <div
                key={f.key}
                style={{
                  flex: 1, height: 4, borderRadius: 3,
                  background: i <= idx ? '#3b82f6' : 'rgba(255,255,255,0.12)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          {/* Carried-over context, so it feels continuous rather than a restart */}
          {isGuest && idx === (guest?.draft.firstName ? 1 : 0) && (
            <div style={{
              marginBottom: '1.25rem', padding: '0.8rem 1rem',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 12,
            }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
                Picking up where you left off — your country and settings carry over.
              </p>
            </div>
          )}

          <div className="cb-join-panel" key={field.key}>
            <p style={{
              fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: '#60a5fa', margin: '0 0 0.55rem',
            }}>
              Step {idx + 1} of {FIELDS.length}
            </p>
            <h1 style={{
              fontSize: '1.7rem', fontWeight: 900, color: '#fff',
              margin: 0, lineHeight: 1.18,
            }}>
              {field.question}
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem',
              margin: '0.45rem 0 1.5rem',
            }}>
              {field.sub}
            </p>

            {error && (
              <div style={{
                marginBottom: '1rem', padding: '0.8rem 1rem',
                background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)',
                borderRadius: 10,
              }}>
                <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</span>
              </div>
            )}

            {/* ── The one question on screen ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.35rem' }}>
              {field.key === 'country' && (
                <>
                  <select
                    value={country.code}
                    onChange={(e) => {
                      const c = getCountry(e.target.value);
                      setCountryLocal(c);
                      setStoreCountry(c.code);
                    }}
                    style={{ ...input, cursor: 'pointer' }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} style={{ background: '#0d1f3c' }}>
                        {c.flag}  {c.name}  ({c.symbol} {c.currency})
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.42)', margin: 0 }}>
                    Minimum stake here is{' '}
                    <strong style={{ color: '#bfdbfe' }}>
                      {formatMoney(country.minStake, country)}
                    </strong>
                  </p>
                </>
              )}

              {field.key === 'name' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <input
                    ref={inputRef} className="cb-join-input" style={input}
                    placeholder={country.namePlaceholder[0]} value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    onKeyDown={onKey} autoComplete="given-name"
                  />
                  <input
                    className="cb-join-input" style={input}
                    placeholder={country.namePlaceholder[1]} value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    onKeyDown={onKey} autoComplete="family-name"
                  />
                </div>
              )}

              {field.key === 'email' && (
                <input
                  ref={inputRef} className="cb-join-input" style={input}
                  type="email" placeholder="you@example.com" value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  onKeyDown={onKey} autoComplete="email" inputMode="email"
                />
              )}

              {field.key === 'password' && (
                <div style={{ position: 'relative' }}>
                  <input
                    ref={inputRef} className="cb-join-input"
                    style={{ ...input, paddingRight: '3rem' }}
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters" value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    onKeyDown={onKey} autoComplete="new-password"
                  />
                  <button
                    type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
                    style={{
                      position: 'absolute', right: '0.85rem', top: '50%',
                      transform: 'translateY(-50%)', background: 'none', border: 'none',
                      cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4,
                    }}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              )}

              {field.key === 'phone' && (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '1rem 0.9rem', background: 'rgba(255,255,255,0.08)',
                      border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12,
                      fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)',
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>{country.flag}</span>
                      {country.dial}
                    </div>
                    <input
                      ref={inputRef} className="cb-join-input" style={{ ...input, flex: 1 }}
                      type="tel" placeholder={country.phonePlaceholder} value={form.phoneLocal}
                      onChange={(e) => set('phoneLocal', e.target.value)}
                      onKeyDown={onKey} autoComplete="tel-national" inputMode="tel"
                    />
                  </div>

                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                    cursor: 'pointer', marginTop: '0.4rem',
                  }}>
                    <input
                      type="checkbox" checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                      style={{ marginTop: 3, width: 17, height: 17, accentColor: '#3b82f6', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                      I'm 18 or over and agree to the{' '}
                      <Link to="/terms" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
                        Terms
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                </>
              )}
            </div>

            {/* Actions */}
            <button
              type="button" className="cb-join-next"
              onClick={next} disabled={loading}
            >
              {loading ? (
                <><span className="cb-spin" />Creating your account…</>
              ) : isLast ? (
                'Create my account'
              ) : (
                'Continue →'
              )}
            </button>

            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginTop: '1rem',
            }}>
              {idx > 0 ? (
                <button
                  type="button" onClick={back} disabled={loading}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem',
                    fontFamily: 'inherit', padding: 0,
                  }}
                >
                  ← Back
                </button>
              ) : <span />}

              <Link
                to="/register"
                style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}
              >
                Use the full form instead
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const wrap: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '2rem 1.5rem', fontFamily: "'Inter', sans-serif",
  background:
    'radial-gradient(circle at 20% 0%, rgba(59, 130, 246,0.16) 0%, rgba(59, 130, 246,0) 55%),' +
    'linear-gradient(165deg, #0d1f3c 0%, #060f1f 100%)',
};
