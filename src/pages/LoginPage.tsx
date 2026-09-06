import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { auth } from '../utils/api';
import type { AuthResponse } from '../utils/api';
import { saveSession as persistSession, setStoredCountry, type StoredUser } from '../utils/session';

/* ─── Session helpers ─────────────────────────────────────────────────────────
   These are now thin re-exports over utils/session, which owns the single
   SkyBet-branded token key. They stay exported from this module because
   RegisterPage and a few older call sites import `saveSession` from here.

   The token key moved:  'accessToken' -> 'skybet_token'
   The user key moved:   'currentUser' -> 'skybet_user'
   Legacy keys are migrated automatically on first load, so existing sessions
   survive the rename.
   ------------------------------------------------------------------------- */
export {
  TOKEN_KEY,
  USER_KEY,
  clearSession,
} from '../utils/session';

export function saveSession(data: AuthResponse, remember: boolean): void {
  persistSession(
    { accessToken: data.accessToken, user: data.user as unknown as StoredUser },
    remember,
  );
}

function mapRole(apiRole: string): 'user' | 'admin' {
  return ['ADMIN', 'admin', 'SUPER_ADMIN', 'super_admin'].includes(apiRole) ? 'admin' : 'user';
}

// ─── Styled input ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.9rem 1rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1.5px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  fontSize: '0.9rem',
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.45)',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { login, showToast, setCountry } = useAppStore();

  const [form, setForm]         = useState({ email: '', password: '' });
  const [showPw, setShowPw]     = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.email.trim() || !form.password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await auth.login({ email: form.email.trim(), password: form.password });
      if (!res.success || !res.data?.accessToken) throw new Error(res.message ?? 'Login failed.');
      const { user: u } = res.data;
      saveSession(res.data, remember);

      // Restore the country the user picked when they registered. Everything
      // downstream — currency symbol, stake floor, deposit limits, the games
      // — reads from this, so it has to be set before we mark them logged in.
      const registeredCountry = (u as { country?: string }).country;
      if (registeredCountry) {
        setStoredCountry(registeredCountry);
        setCountry(registeredCountry);
      }

      login({
        id: u.id,
        fullName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        phone: u.phone ?? '',
        email: u.email,
        role: mapRole(u.role),
        kycStatus: 'verified',
        referralCode: '',
      });
      showToast('Welcome back!', 'success');
      navigate(res.data.mustSetup2fa ? '/setup-2fa' : '/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .wb-login-input:focus {
          border-color: #3b82f6 !important;
          background: rgba(255,255,255,0.08) !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246,0.18) !important;
        }
        .wb-eye-btn:hover { color: #3b82f6 !important; }
        .wb-submit:hover:not(:disabled) {
          background: #1d4ed8 !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(29, 78, 216,0.45) !important;
        }
        .wb-submit:active:not(:disabled) { transform: translateY(0); }
        .wb-link:hover { text-decoration: underline; }
        @keyframes wbSpin { to { transform: rotate(360deg); } }
        .wb-spin {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          display: inline-block;
          animation: wbSpin 0.8s linear infinite;
        }
      `}</style>

      <div style={{
        minHeight: 'calc(100vh - 4rem)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Card */}
          <div style={{
            background: '#0d1f3c',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
            padding: '2rem 2rem 1.75rem',
          }}>

            {/* Heading */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <div style={{ width: 24, height: 3, background: '#3b82f6', borderRadius: 2 }} />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#60a5fa' }}>
                  Member Login
                </span>
              </div>
              <h1 style={{
                fontSize: '1.75rem',
                fontWeight: 900,
                color: '#fff',
                margin: 0,
                lineHeight: 1.15,
                fontFamily: "'Inter', sans-serif",
              }}>
                Welcome back
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '0.875rem', marginTop: '0.35rem', margin: '0.35rem 0 0' }}>
                Sign in to access your account and bets.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div style={{
                marginBottom: '1.25rem',
                padding: '0.85rem 1rem',
                background: 'rgba(248,113,113,0.10)',
                border: '1px solid rgba(248,113,113,0.30)',
                borderRadius: 10,
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'flex-start',
              }}>
                <span style={{ color: '#f87171', fontSize: '0.9rem', marginTop: 1 }}>⚠</span>
                <span style={{ color: '#f87171', fontSize: '0.85rem', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

              {/* Email */}
              <Field label="Email Address">
                <input
                  className="wb-login-input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  autoComplete="email"
                  inputMode="email"
                  disabled={loading}
                  required
                  style={inputStyle}
                />
              </Field>

              {/* Password */}
              <Field label="Password">
                <div style={{ position: 'relative' }}>
                  <input
                    className="wb-login-input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    autoComplete="current-password"
                    disabled={loading}
                    required
                    style={{ ...inputStyle, paddingRight: '2.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    tabIndex={-1}
                    className="wb-eye-btn"
                    style={{
                      position: 'absolute', right: '0.75rem', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4, lineHeight: 1,
                    }}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </Field>

              {/* Remember + Forgot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ position: 'relative', width: 18, height: 18 }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      disabled={loading}
                      style={{
                        position: 'absolute', inset: 0, opacity: 0,
                        cursor: 'pointer', width: '100%', height: '100%',
                      }}
                    />
                    <div style={{
                      width: 18, height: 18, borderRadius: 5,
                      background: remember ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${remember ? '#3b82f6' : 'rgba(255,255,255,0.20)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none',
                    }}>
                      {remember && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="wb-link"
                  style={{ fontSize: '0.82rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="wb-submit"
                style={{
                  width: '100%',
                  padding: '0.95rem',
                  background: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: '0.04em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  minHeight: 50,
                }}
              >
                {loading ? (
                  <><span className="wb-spin" />Signing in…</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                      <polyline points="10 17 15 12 10 7"/>
                      <line x1="15" y1="12" x2="3" y2="12"/>
                    </svg>
                    Log In
                  </>
                )}
              </button>

            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.30)', letterSpacing: '0.08em' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255,255,255,0.50)', margin: 0 }}>
              New to SkyBet?{' '}
              <Link to="/register" className="wb-link" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
                Create an account →
              </Link>
            </p>

          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.5rem' }}>
            {['🔒 Secure', '✓ Licensed', '⚡ Instant Pay'].map(b => (
              <span key={b} style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.30)', letterSpacing: '0.04em' }}>{b}</span>
            ))}
          </div>

        </div>
      </div>
    </>
  );
} 