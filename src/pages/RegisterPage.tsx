import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store';
import { auth } from '../utils/api';
import { saveSession } from './LoginPage';
import { setStoredCountry } from '../utils/session';
import {
  COUNTRIES,
  DEFAULT_COUNTRY as DEFAULT_COUNTRY_CONFIG,
  formatMoney,
  type CountryConfig,
} from '../config/countries';
import { suggestCountryCode } from '../utils/country';

/* ─── Country data ────────────────────────────────────────────────────────────
   Sourced from the shared registry in src/config/countries.ts — the SAME list
   that drives currency symbols, stake floors and deposit limits everywhere
   else in the app.
   -------------------------------------------------------------------------- */
type Country = CountryConfig;

const DEFAULT_COUNTRY: Country = DEFAULT_COUNTRY_CONFIG;

/* ─── Referral code persistence ───────────────────────────────────────────────
   Same pattern as the multi-step register flow: a code arriving via `?ref=`
   is captured immediately and persisted, so it survives navigation/reloads
   and is restored automatically if the user browses first and registers
   later. localStorage is the primary store, with an in-memory fallback for
   environments where it's unavailable.
   -------------------------------------------------------------------------- */
const REFERRAL_STORAGE_KEY = 'skybet_referral_code';
let inMemoryReferralFallback: string | null = null;

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__skybet_ls_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function getStoredReferralCode(): string {
  try {
    if (isLocalStorageAvailable()) {
      return window.localStorage.getItem(REFERRAL_STORAGE_KEY) ?? '';
    }
  } catch {
    // fall through to in-memory
  }
  return inMemoryReferralFallback ?? '';
}

function setStoredReferralCode(code: string): void {
  const trimmed = code.trim();
  if (!trimmed) return;
  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, trimmed);
      return;
    }
  } catch {
    // fall through to in-memory
  }
  inMemoryReferralFallback = trimmed;
}

function clearStoredReferralCode(): void {
  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  inMemoryReferralFallback = null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mapRole(r: string): 'user' | 'admin' {
  return ['ADMIN', 'admin', 'SUPER_ADMIN', 'super_admin'].includes(r) ? 'admin' : 'user';
}

function pwStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const m = [
    { score: 1, label: 'Weak',   color: '#ef4444' },
    { score: 2, label: 'Fair',   color: '#f97316' },
    { score: 3, label: 'Good',   color: '#eab308' },
    { score: 4, label: 'Strong', color: '#22c55e' },
  ];
  return m[s - 1] ?? { score: 0, label: '', color: '' };
}

type Errors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword' | 'terms', string>>;

// ─── Country selector ─────────────────────────────────────────────────────────
// NOTE ON THE DROPDOWN FIX:
// The panel was being visually covered by content that renders after it
// (the "You'll play in ..." currency summary box, and further fields below).
// `position: absolute` + a z-index on the panel is only guaranteed to win
// against later siblings if the *positioned ancestor* (this component's root)
// also participates correctly in stacking — but here the real bug is that
// the outer wrapper had no explicit stacking context of its own, so once the
// dropdown was open, the browser was free to paint subsequent normal-flow
// siblings (the currency info box, phone field, etc., all painted later in
// document order) on top of it at the same root stacking level. The fix:
// 1. Give the wrapper `position: relative` + `zIndex` so it establishes its
//    own stacking context that the panel's z-index is evaluated within.
// 2. Raise the panel's z-index well above any other element in the form.
// 3. Use `position: fixed`-safe absolute positioning that isn't clipped by
//    any `overflow: hidden` ancestor — `.wb-reg-card` has none, so absolute
//    positioning relative to the selector wrapper is fine once stacking is
//    correct.
function CountrySelector({ value, onChange, disabled }: { value: Country; onChange: (c: Country) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const ref             = useRef<HTMLDivElement>(null);
  const searchRef       = useRef<HTMLInputElement>(null);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.dial.includes(q) ||
    c.code.toLowerCase().includes(q.toLowerCase())
  );

  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 50); }, [open]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(''); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        // Establish our own stacking context so the open panel's z-index is
        // compared against siblings correctly, and raise it above the rest
        // of the form the moment the dropdown is open.
        zIndex: open ? 9999 : 'auto',
      }}
    >
      <button
        type="button" disabled={disabled} onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.05)',
          border: `1.5px solid ${open ? '#3b82f6' : 'rgba(255,255,255,0.12)'}`, borderRadius: 10,
          fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center',
          gap: '0.6rem', cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: open ? '0 0 0 3px rgba(59, 130, 246,0.18)' : 'none',
          transition: 'all 0.15s', boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{value.flag}</span>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.name}</span>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.40)', flexShrink: 0 }}>{value.dial}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 9999, left: 0, right: 0, top: 'calc(100% + 6px)',
          background: '#0d1f3c', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          maxHeight: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchRef} type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search country…"
                style={{
                  width: '100%', paddingLeft: '2rem', paddingRight: '0.75rem',
                  paddingTop: '0.55rem', paddingBottom: '0.55rem',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                  fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit', color: '#fff',
                }}
              />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0
              ? <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', padding: '1rem' }}>No results</p>
              : filtered.map(c => (
                <button
                  key={c.code} type="button"
                  onClick={() => { onChange(c); setOpen(false); setQ(''); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.85rem',
                    background: c.code === value.code ? 'rgba(59, 130, 246,0.14)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: '0.875rem', color: '#fff', fontFamily: 'inherit',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = c.code === value.code ? 'rgba(59, 130, 246,0.14)' : 'transparent')}
                >
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{c.flag}</span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>{c.dial}</span>
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: '100%', padding: '0.9rem 1rem',
  background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.12)',
  borderRadius: 10, fontSize: '0.9rem', color: '#fff',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
};

function errStyle(hasErr?: boolean): React.CSSProperties {
  return hasErr
    ? { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.14)' }
    : {};
}

function Field({ label, required: req, optional, hint, error, children }: {
  label: string; required?: boolean; optional?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{
        fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.45)',
        display: 'flex', alignItems: 'center', gap: '0.35rem',
      }}>
        {label}
        {req      && <span style={{ color: '#60a5fa' }}>*</span>}
        {optional && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.30)', fontSize: '0.7rem' }}>(optional)</span>}
      </label>
      {children}
      {error
        ? <p className="wb-reg-field-err" style={{ fontSize: '0.72rem', color: '#f87171', margin: '0.15rem 0 0' }}>{error}</p>
        : hint && <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', margin: '0.2rem 0 0' }}>{hint}</p>
      }
    </div>
  );
}

function FocusInput(props: React.InputHTMLAttributes<HTMLInputElement> & { extraStyle?: React.CSSProperties }) {
  const { extraStyle, style, ...rest } = props;
  return (
    <input {...rest} className="wb-reg-input" style={{ ...inputBase, ...extraStyle, ...style }} />
  );
}

// ─── Register page ────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, showToast, setCountry: setStoreCountry } = useAppStore();

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);

  // ── Referral code resolution order (same as the multi-step flow):
  // 1. `?ref=` in the current URL (freshest signal)
  // 2. Whatever was previously stored from an earlier visit
  const urlRef = searchParams.get('ref')?.trim() ?? '';

  // Locked whenever the code was auto-applied — from a fresh link on this
  // visit, or restored from a prior visit. Only editable when the user
  // types a code in by hand with nothing stored and no link.
  const [referralLocked, setReferralLocked] = useState<boolean>(() => !!urlRef || !!getStoredReferralCode());
  const [referralAutoApplied] = useState<boolean>(() => !urlRef && !!getStoredReferralCode());

  const [form, setForm] = useState(() => ({
    firstName: '', lastName: '', phoneLocal: '',
    email: '', password: '', confirmPassword: '',
    referralCode: urlRef || getStoredReferralCode(),
  }));
  const [showPw,  setShowPw]  = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [terms,   setTerms]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [errors,  setErrors]  = useState<Errors>({});
  const [showReferral, setShowReferral] = useState(!!urlRef || !!getStoredReferralCode());

  // Persist a fresh `?ref=` immediately on landing, before the user touches
  // anything, and lock the field for this session.
  useEffect(() => {
    if (urlRef) {
      setStoredReferralCode(urlRef);
      setForm(p => ({ ...p, referralCode: urlRef }));
      setShowReferral(true);
      setReferralLocked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRef]);

  /* Pre-select a likely country so most users never touch the dropdown.
     This is a SUGGESTION ONLY — whatever sits in `country` when the form is
     submitted is what the account is created with, and that choice is what
     drives currency everywhere afterwards. We stop suggesting the moment the
     user touches the selector themselves. */
  const [countryTouched, setCountryTouched] = useState(false);
  useEffect(() => {
    if (countryTouched) return;
    let alive = true;
    void suggestCountryCode().then(code => {
      if (!alive || countryTouched) return;
      const match = COUNTRIES.find(c => c.code === code);
      if (match) setCountry(match);
    });
    return () => { alive = false; };
  }, [countryTouched]);

  const set = (k: keyof typeof form, v: string) => {
    // The referral code is locked once auto-applied — block edits/clears.
    if (k === 'referralCode' && referralLocked) return;

    setForm(p => ({ ...p, [k]: v }));

    if (k === 'referralCode') {
      const trimmed = v.trim();
      if (trimmed) setStoredReferralCode(trimmed);
      else clearStoredReferralCode();
    }

    // Clear the field error the moment the user starts fixing it.
    if (k in errors) setErrors(p => ({ ...p, [k]: undefined }));
  };

  const strength  = pwStrength(form.password);
  const pwMatch   = form.confirmPassword ? form.password === form.confirmPassword : undefined;
  const fullPhone = form.phoneLocal.trim()
    ? `${country.dial}${form.phoneLocal.trim().replace(/^0/, '')}`
    : '';
  const [fp, lp] = country.namePlaceholder;

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.firstName.trim()) e.firstName = 'Enter your first name.';
    if (!form.lastName.trim())  e.lastName  = 'Enter your last name.';
    if (!form.email.trim())               e.email = 'Enter your email address.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.password.length < 8)         e.password = 'At least 8 characters.';
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords don't match.";
    if (!terms) e.terms = 'Accept the Terms & Conditions to continue.';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setError('Please fix the highlighted fields.');
      // Scroll/focus the first invalid field for a fast fix.
      const order: (keyof Errors)[] = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'terms'];
      const firstKey = order.find(k => fieldErrors[k]);
      if (firstKey) {
        document.getElementById(`wb-field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setErrors({});
    setError(null);
    setLoading(true);
    try {
      const res = await auth.register({
        email: form.email.trim(), password: form.password,
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        phone: fullPhone || undefined, country: country.code,
        ref: form.referralCode.trim() || undefined,
      });
      if (!res.success || !res.data?.accessToken) throw new Error(res.message ?? 'Registration failed.');
      const { user: u } = res.data;
      saveSession(res.data, true);

      /* THE country decision. Everything downstream reads this: the currency
         symbol in the header, the stake floor in every casino game, deposit
         and withdrawal minimums, and the games iframe bridge. Persist it
         before login() so the first render after redirect is already correct. */
      setStoredCountry(country.code);
      setStoreCountry(country.code);

      // Registration succeeded and the referral code has been submitted to
      // the server — safe to clear the persisted copy now.
      clearStoredReferralCode();

      login({
        id: u.id,
        fullName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        phone: u.phone ?? '', email: u.email,
        role: mapRole(u.role), kycStatus: 'unverified', referralCode: '',
      });
      showToast('Welcome to SkyBet! 🎉', 'success');
      navigate(res.data.mustSetup2fa ? '/setup-2fa' : '/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
      showToast(msg, 'error');
      // On failure we deliberately do NOT clear the stored referral code —
      // the user may retry or come back later and shouldn't lose attribution.
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .wb-reg-input:focus {
          border-color: #3b82f6 !important;
          background: rgba(255,255,255,0.08) !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246,0.18) !important;
        }
        .wb-reg-input[readonly] {
          cursor: not-allowed;
          color: rgba(255,255,255,0.55) !important;
        }
        .wb-reg-input[readonly]:focus {
          border-color: rgba(255,255,255,0.12) !important;
          background: rgba(255,255,255,0.05) !important;
          box-shadow: none !important;
        }
        .wb-reg-link:hover { text-decoration: underline; }
        .wb-reg-submit:hover:not(:disabled) {
          background: #1d4ed8 !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(29, 78, 216,0.45) !important;
        }
        .wb-reg-submit:active:not(:disabled) { transform: translateY(0); }

        @keyframes wbRegSpin { to { transform: rotate(360deg); } }
        .wb-reg-spin {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          border-radius: 50%; display: inline-block;
          animation: wbRegSpin 0.8s linear infinite;
        }

        @keyframes wbFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .wb-reveal { animation: wbFadeUp 0.4s ease both; }
        .wb-reveal:nth-child(1) { animation-delay: 0.02s; }
        .wb-reveal:nth-child(2) { animation-delay: 0.06s; }
        .wb-reveal:nth-child(3) { animation-delay: 0.10s; }
        .wb-reveal:nth-child(4) { animation-delay: 0.14s; }
        .wb-reveal:nth-child(5) { animation-delay: 0.18s; }
        .wb-reveal:nth-child(6) { animation-delay: 0.22s; }

        @keyframes wbShake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-3px); }
          40%, 60% { transform: translateX(3px); }
        }
        .wb-reg-shake { animation: wbShake 0.4s; }

        @keyframes wbFieldErrIn {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .wb-reg-field-err { animation: wbFieldErrIn 0.18s ease; }

        @keyframes wbExpand {
          from { opacity: 0; max-height: 0; margin-top: 0; }
          to   { opacity: 1; max-height: 120px; margin-top: 0.25rem; }
        }
        .wb-reg-expand { animation: wbExpand 0.25s ease; overflow: hidden; }

        .wb-reg-toggle-link {
          background: none; border: none; cursor: pointer; font-family: inherit;
          color: #60a5fa; font-size: 0.78rem; font-weight: 700; padding: 0;
        }
        .wb-reg-toggle-link:hover { text-decoration: underline; }

        /* ── Single-page shell ── */
        .wb-reg-shell { width: 100%; max-width: 480px; margin: 0 auto; }
        .wb-reg-card {
          background:
            radial-gradient(circle at 15% 0%, rgba(59, 130, 246,0.10) 0%, rgba(59, 130, 246,0) 55%),
            #0d1f3c;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 8px 48px rgba(0,0,0,0.55);
          padding: 2rem 1.85rem 1.85rem;
          /* No overflow:hidden here — required so the open country dropdown
             is never clipped by the card boundary. */
          position: relative;
        }
        .wb-reg-name-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

        @media (max-width: 480px) {
          .wb-reg-card { padding: 1.5rem 1.25rem 1.5rem; border-radius: 16px; }
          .wb-reg-name-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{
        minHeight: 'calc(100vh - 4rem)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2.5rem 1.5rem 3rem', fontFamily: "'Inter', sans-serif",
      }}>
        <div className="wb-reg-shell">
          <div className="wb-reg-card">

            {/* Header */}
            <div className="wb-reveal" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.55rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
                Create your account
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', margin: '0.4rem 0 0' }}>
                Takes less than a minute. One tap from your first bet.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="wb-reg-shake" style={{
                marginBottom: '1.1rem', padding: '0.85rem 1rem',
                background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)',
                borderRadius: 10, display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
              }}>
                <span style={{ color: '#f87171', marginTop: 1 }}>⚠</span>
                <span style={{ color: '#f87171', fontSize: '0.85rem', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} noValidate>

              {/* Name */}
              <div className="wb-reg-name-grid wb-reveal">
                <div id="wb-field-firstName">
                  <Field label="First Name" required error={errors.firstName}>
                    <FocusInput
                      placeholder={fp} value={form.firstName}
                      onChange={e => set('firstName', e.target.value)}
                      autoComplete="given-name"
                      style={errStyle(!!errors.firstName)}
                    />
                  </Field>
                </div>
                <div id="wb-field-lastName">
                  <Field label="Last Name" required error={errors.lastName}>
                    <FocusInput
                      placeholder={lp} value={form.lastName}
                      onChange={e => set('lastName', e.target.value)}
                      autoComplete="family-name"
                      style={errStyle(!!errors.lastName)}
                    />
                  </Field>
                </div>
              </div>

              {/* Email */}
              <div className="wb-reveal" id="wb-field-email">
                <Field label="Email" required error={errors.email}>
                  <FocusInput
                    type="email" placeholder="you@example.com"
                    value={form.email} onChange={e => set('email', e.target.value)}
                    autoComplete="email" inputMode="email"
                    style={errStyle(!!errors.email)}
                  />
                </Field>
              </div>

              {/* Country + phone, combined row */}
              <div className="wb-reveal" style={{ position: 'relative', zIndex: 20 }}>
                <Field label="Country" required>
                  <CountrySelector
                    value={country}
                    onChange={c => { setCountry(c); setCountryTouched(true); set('phoneLocal', ''); }}
                  />
                  <div style={{
                    marginTop: '0.55rem', padding: '0.6rem 0.8rem',
                    background: 'rgba(59, 130, 246,0.08)',
                    border: '1px solid rgba(59, 130, 246,0.22)',
                    borderRadius: 10, display: 'flex', flexWrap: 'wrap',
                    gap: '0.3rem 1rem', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                      You'll play in
                    </span>
                    <strong style={{ fontSize: '0.8rem', color: '#bfdbfe' }}>
                      {country.symbol} {country.currency}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.30)' }}>·</span>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                      Min stake <strong style={{ color: '#bfdbfe' }}>{formatMoney(country.minStake, country)}</strong>
                    </span>
                  </div>
                </Field>
              </div>

              {/* Phone */}
              <div className="wb-reveal">
                <Field label="Phone Number" optional hint="Used for account security and withdrawals.">
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.9rem 0.85rem',
                      background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)',
                      borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
                      color: 'rgba(255,255,255,0.65)', flexShrink: 0, whiteSpace: 'nowrap', userSelect: 'none',
                    }}>
                      <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{country.flag}</span>
                      <span>{country.dial}</span>
                    </div>
                    <FocusInput
                      type="tel"
                      placeholder={country.phonePlaceholder}
                      value={form.phoneLocal}
                      onChange={e => set('phoneLocal', e.target.value)}
                      autoComplete="tel-national" inputMode="tel"
                      extraStyle={{ flex: 1 }}
                    />
                  </div>
                  {fullPhone && (
                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.40)', marginTop: '0.35rem' }}>
                      Full number: <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{fullPhone}</strong>
                    </p>
                  )}
                </Field>
              </div>

              {/* Password */}
              <div className="wb-reveal" id="wb-field-password">
                <Field label="Password" required error={errors.password}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="wb-reg-input"
                      type={showPw ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      autoComplete="new-password"
                      style={{ ...inputBase, paddingRight: '2.8rem', ...errStyle(!!errors.password) }}
                    />
                    <button
                      type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                      style={{
                        position: 'absolute', right: '0.75rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.35)', padding: 4, lineHeight: 1,
                      }}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw
                        ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  {form.password && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: 4, height: 4, marginBottom: '0.3rem' }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{
                            flex: 1, borderRadius: 4,
                            background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.12)',
                            transition: 'background 0.3s',
                          }} />
                        ))}
                      </div>
                      {strength.label && (
                        <p style={{ fontSize: '0.72rem', fontWeight: 600, color: strength.color, margin: 0 }}>
                          {strength.label} password
                        </p>
                      )}
                    </div>
                  )}
                </Field>
              </div>

              {/* Confirm password */}
              <div className="wb-reveal" id="wb-field-confirmPassword">
                <Field label="Confirm Password" required error={errors.confirmPassword}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="wb-reg-input"
                      type={showCPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.confirmPassword}
                      onChange={e => set('confirmPassword', e.target.value)}
                      autoComplete="new-password"
                      style={{
                        ...inputBase, paddingRight: '3.5rem',
                        ...(errors.confirmPassword ? errStyle(true) : form.confirmPassword ? {
                          borderColor: pwMatch ? '#22c55e' : '#ef4444',
                          boxShadow: pwMatch
                            ? '0 0 0 3px rgba(34,197,94,0.14)'
                            : '0 0 0 3px rgba(239,68,68,0.14)',
                        } : {}),
                      }}
                    />
                    <div style={{
                      position: 'absolute', right: '0.75rem', top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                    }}>
                      {form.confirmPassword && (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                          stroke={pwMatch ? '#22c55e' : '#ef4444'} strokeWidth="2.5">
                          {pwMatch
                            ? <polyline points="20 6 9 17 4 12"/>
                            : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                          }
                        </svg>
                      )}
                      <button
                        type="button" onClick={() => setShowCPw(v => !v)} tabIndex={-1}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4, lineHeight: 1 }}
                        aria-label={showCPw ? 'Hide password' : 'Show password'}
                      >
                        {showCPw
                          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                </Field>
              </div>

              {/* Referral toggle */}
              <div className="wb-reveal">
                {!showReferral ? (
                  <button type="button" className="wb-reg-toggle-link" onClick={() => setShowReferral(true)}>
                    + Have a referral code?
                  </button>
                ) : (
                  <div className="wb-reg-expand">
                    <Field label="Referral Code" optional={!referralLocked}>
                      <div style={{ position: 'relative' }}>
                        <FocusInput
                          placeholder="e.g. REF123ABC"
                          value={form.referralCode}
                          onChange={e => set('referralCode', e.target.value.toUpperCase())}
                          autoComplete="off" disabled={loading}
                          readOnly={referralLocked}
                          extraStyle={referralLocked ? { paddingRight: '2.6rem' } : undefined}
                        />
                        {referralLocked && (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"
                            style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        )}
                      </div>
                      {form.referralCode && referralLocked && (
                        <p style={{ fontSize: '0.72rem', color: '#bfdbfe', margin: '0.35rem 0 0' }}>
                          {referralAutoApplied
                            ? 'Referral code restored from your earlier visit and locked in — it can’t be changed or removed.'
                            : 'Referral code applied from your link and locked in — it can’t be changed or removed.'}
                        </p>
                      )}
                    </Field>
                  </div>
                )}
              </div>

              {/* Terms */}
              <div className="wb-reveal" id="wb-field-terms">
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  cursor: 'pointer', userSelect: 'none',
                }}>
                  <div style={{ position: 'relative', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}>
                    <input
                      type="checkbox" checked={terms}
                      onChange={e => { setTerms(e.target.checked); setErrors(p => ({ ...p, terms: undefined })); }}
                      disabled={loading}
                      style={{
                        position: 'absolute', inset: 0, opacity: 0,
                        cursor: 'pointer', width: '100%', height: '100%',
                      }}
                    />
                    <div style={{
                      width: 18, height: 18, borderRadius: 5,
                      background: terms ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${terms ? '#3b82f6' : errors.terms ? '#ef4444' : 'rgba(255,255,255,0.20)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none', transition: 'border-color 0.15s',
                    }}>
                      {terms && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                    I agree to the{' '}
                    <Link to="/terms" className="wb-reg-link" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
                      Terms & Conditions
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="wb-reg-link" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
                      Privacy Policy
                    </Link>
                  </span>
                </label>
                {errors.terms && (
                  <p className="wb-reg-field-err" style={{ fontSize: '0.72rem', color: '#f87171', margin: '0.35rem 0 0 1.9rem' }}>
                    {errors.terms}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="wb-reg-submit wb-reveal"
                style={{
                  padding: '0.95rem',
                  background: '#1d4ed8', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: '0.9rem', fontWeight: 700,
                  fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'all 0.2s', minHeight: 50, marginTop: '0.25rem',
                }}
              >
                {loading ? (
                  <><span className="wb-reg-spin" />Creating account…</>
                ) : (
                  <>
                    Create Account
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Divider + login link */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 1rem' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.30)', letterSpacing: '0.08em' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255,255,255,0.50)', margin: 0 }}>
              Already have an account?{' '}
              <Link to="/login" className="wb-reg-link" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
                Log in →
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
