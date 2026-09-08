import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Info, Lock, TrendingUp } from 'lucide-react';
import { useAppStore } from '../store';
import { useCountry } from '../hooks/useCountry';
import { getToken as getSessionToken } from '../utils/session';

/* ── Direct HTTP integration — no api.ts wrapper ─────────────────────────
   Talks straight to the backend with fetch(). Endpoints:
     GET  /api/users/me                        -> { user, wallet: { balance, currency } }
     GET  /api/geo/currency                     -> { currency|code, symbol, rate|usdRate }
     POST /api/games/aviator/play               { stake }               -> { id }
     POST /api/games/aviator/cashout            { roundId, cashoutAt }  -> { payout, multiplier, walletBalance }
     GET  /api/games/aviator/current            -> { state, multiplier?, crashPoint?, hash, serverSeed?, clientSeed, countdownSecondsRemaining }
     GET  /api/games/aviator/history?limit=15   -> [{ result: { crashPoint } }]

   Every controller on the backend wraps its body in ApiResponse<T>
   (`{ success, data, message }`), so `http()` unwraps `.data` for you and
   throws using `.message` on a non-2xx response.

   Auth token: see getAccessToken() below for how the JWT is attached.

   NOTE on the "id" returned by POST /play: the backend now generates a
   unique per-bet id (not a shared round id), so a user can hold more than
   one concurrent bet slip in the same round (this UI has two bet panels).
   The field is still called "id"/"roundId" on the wire for backward
   compatibility — treat it as an opaque bet identifier, not literally the
   round's id.
   ------------------------------------------------------------------------ */

const API_BASE = 'https://predatorbackend-production.up.railway.app'; // same-origin; set to e.g. import.meta.env.VITE_API_URL if the API lives on a different host

/* Confirmed against LoginPage.tsx: TOKEN_KEY = 'accessToken', and saveSession()
   always writes it to localStorage (even on the sessionStorage/"don't remember
   me" branch, there's a trailing `localStorage.setItem(TOKEN_KEY, ...)` too) —
   so localStorage is reliably where the token lives regardless of the
   "remember me" choice. If that constant's value ever changes, update the
   key string below to match. */
function getAccessToken(): string | null {
  // Unified SkyBet key — see src/utils/session.ts. This used to read
  // 'accessToken' directly, which broke the moment the key was renamed.
  return getSessionToken();
}

// Thrown when the backend/proxy answers 429. The /current poller uses this
// to back off exponentially instead of continuing to hit the limiter every
// tick — that was the cause of an earlier 429 storm, which in turn made the
// countdown/crash sequence appear to freeze (poll() was silently swallowing
// every failed request and never updating state).
class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super('Rate limited (429)');
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // sends the httpOnly refreshToken cookie along, harmless on non-refresh calls
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 429) {
    // Proxies/rate-limiters in front of the API often reply with a
    // plain-text or HTML body here, not JSON — don't try to res.json() it.
    const retryAfterHeader = res.headers.get('Retry-After');
    const parsed = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : NaN;
    throw new RateLimitError(Number.isFinite(parsed) ? parsed : 2000);
  }

  let body: unknown = null;
  try { body = await res.json(); } catch { /* empty body, e.g. some 204s */ }
  const envelope = body as { success?: boolean; data?: T; message?: string } | null;

  if (!res.ok) {
    throw new Error(envelope?.message ?? `Request failed (${res.status})`);
  }
  return (envelope?.data ?? (body as T));
}

const httpGet = <T,>(path: string) => http<T>(path, { method: 'GET' });
const httpPost = <T,>(path: string, body: unknown) => http<T>(path, { method: 'POST', body: JSON.stringify(body) });

/* =========================================================================
   AVIATOR — real-money, auth-gated integration
   ------------------------------------------------------------------------
   Wired 1:1 against:
     POST /api/games/aviator/play      { stake }                -> { id }
     POST /api/games/aviator/cashout   { roundId, cashoutAt }    -> { payout, multiplier, walletBalance }
     GET  /api/games/aviator/current                            -> { state, multiplier?, crashPoint?, hash, serverSeed?, clientSeed, countdownSecondsRemaining }
     GET  /api/games/aviator/history?limit=15                   -> [{ result: { crashPoint } }]

   MINIMUM STAKE — BY DESIGN, ENFORCED CLIENT-SIDE ONLY:
     Product decision: the $10 USD floor is a client-side/UX rule, not a
     server-enforced one. The server (AviatorRoundService.placeBet) only
     rejects a non-positive stake — it does not know or care about the
     USD-pegged minimum. This component is the single source of truth for
     that floor, so:
       - minStake is always derived fresh from MIN_STAKE_USD * live FX rate
       - it's recalculated any time the FX rate updates (see the effect
         below that clamps existing panel amounts up to the new minStake)
       - it's re-validated at the moment a bet is placed, using the current
         currencyRef value (not a stale closure), so a bet typed before an
         FX refresh can't slip under the floor
     Do not move this check server-side — that's an explicit, separate
     decision already made. If the business ever wants a hard server floor
     too, that's a distinct change to AviatorRoundService, not this file.

   WHAT THIS FILE DELIBERATELY DOES NOT DO:
     - It does not generate, seed, or predict the crash point. That is
       entirely server-side (CrashPointGenerator + AviatorRoundService).
     - It does not compute payouts authoritatively — the multiplier shown
       during RUNNING is a local animation reconciled by polling
       /current; the actual payout on cashout comes back from the server
       response and is what's credited to the wallet.

   BET SUBMISSION — placed immediately on click, NOT deferred to round
   start:
     Bets used to be "armed" on click and only actually POSTed to /play
     once the client's local countdown hit 0, inside beginRound(). That
     was a race: the local countdown is only approximately synced to the
     server's real WAITING window (via polling), so the client could call
     /play a beat after the server had already flipped to RUNNING, which
     the server correctly rejects with "Betting is closed for this round"
     (422). Bets are now submitted the instant the user clicks BET, any
     time during WAITING — see placeBetNow(). beginRound() now does
     nothing but start the local animation, and is itself only ever
     triggered by the poller observing state === 'RUNNING' from the
     server — never by the local timer. This removes the race entirely:
     nothing the client does to start a round or place a bet is based on
     a local guess about server timing anymore.

   POLLING — adaptive cadence + backoff (see http()'s RateLimitError):
     - RUNNING_POLL_MS: fast poll while a round is actually live, so
       CRASHED is caught promptly.
     - WAITING_POLL_MS: relaxed poll otherwise.
     - On a 429, the poll loop backs off exponentially up to
       MAX_POLL_BACKOFF_MS instead of continuing to hit the limiter.
     - hasSyncedRef gates the local countdown display so it doesn't show
       a guessed number before the client has heard from the server at
       least once.
   ========================================================================= */

const GROWTH_RATE = 0.00006;        // must mirror AviatorRoundService.GROWTH_RATE
const RUNNING_POLL_MS = 500;        // poll fast while a round is live, to catch CRASHED quickly
const WAITING_POLL_MS = 1500;       // no need to hammer the server while nothing is happening
const MAX_POLL_BACKOFF_MS = 10_000; // ceiling for exponential backoff after a 429
const CRASH_HOLD_MS = 2800;
const MAX_MULTIPLIER = 50;         // must mirror AviatorRoundService.MAX_MULTIPLIER (display/cashout cap)


interface Point { x: number; y: number; }
interface Star { x: number; y: number; r: number; a: number; }
interface Cloud { x: number; y: number; w: number; h: number; speed: number; alpha: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; }
interface Shockwave { x: number; y: number; r: number; alpha: number; active: boolean; }
interface BetPanel {
  armed: boolean;
  amount: number;
  roundId: string | null;
  placing: boolean;
  cashedOut: boolean;
  cashingOut: boolean;
  cashoutMult: number;
  payout: number;
  auto: boolean;
  autoVal: number;
  error: string | null;
}
interface PlaneState {
  x: number; y: number; angle: number; flyElapsed: number; trail: Point[]; opacity: number;
}
interface Dims { w: number; h: number; runwayY: number; }
type Phase = 'WAITING' | 'RUNNING' | 'CRASHED';
interface Fairness { serverSeed?: string; clientSeed?: string; hash?: string; }

interface AviatorGameProps { onExit?: () => void; }

function defaultBetPanel(amount = 10): BetPanel {
  return {
    armed: false, amount, roundId: null, placing: false,
    cashedOut: false, cashingOut: false, cashoutMult: 0, payout: 0,
    auto: false, autoVal: 2.0, error: null,
  };
}

// ---------------------------------------------------------------------------
// Canvas drawing (purely visual)
// ---------------------------------------------------------------------------
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#170b2e'); sky.addColorStop(0.45, '#3c1361');
  sky.addColorStop(0.75, '#83308f'); sky.addColorStop(1, '#c94f7c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.8, h * 0.15, 0, w * 0.8, h * 0.15, w * 0.6);
  glow.addColorStop(0, 'rgba(255,215,0,0.10)'); glow.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
}
function drawStars(ctx: CanvasRenderingContext2D, stars: Star[]): void {
  stars.forEach((s) => {
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,235,190,${s.a})`; ctx.fill();
  });
}
function drawClouds(ctx: CanvasRenderingContext2D, clouds: Cloud[]): void {
  clouds.forEach((c) => {
    ctx.save(); ctx.globalAlpha = c.alpha;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f3d9e8'; ctx.fill(); ctx.restore();
  });
}
function drawRunway(ctx: CanvasRenderingContext2D, w: number, h: number, runwayY: number): void {
  ctx.fillStyle = 'rgba(30,14,40,0.75)'; ctx.fillRect(0, runwayY + 10, w, h - runwayY - 10);
  ctx.strokeStyle = 'rgba(255,215,0,0.14)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, runwayY + 11); ctx.lineTo(w, runwayY + 11); ctx.stroke();
  ctx.setLineDash([22, 14]); ctx.strokeStyle = 'rgba(255,215,0,0.22)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, runwayY + 20); ctx.lineTo(w, runwayY + 20); ctx.stroke();
  ctx.setLineDash([]);
}
function drawGraph(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 2) return;
  ctx.save(); ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = 'rgba(255,196,0,0.55)'; ctx.lineWidth = 2.2;
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10; ctx.stroke();
  ctx.shadowBlur = 0; ctx.restore();
}
function drawTrail(ctx: CanvasRenderingContext2D, trail: Point[]): void {
  for (let i = 1; i < trail.length; i++) {
    const t = i / trail.length;
    ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y);
    ctx.strokeStyle = `rgba(230,57,70,${t * 0.5})`; ctx.lineWidth = t * 4; ctx.stroke();
  }
}
function drawExplosion(ctx: CanvasRenderingContext2D, particles: Particle[], shockwave: Shockwave): void {
  if (shockwave.active) {
    ctx.save(); ctx.beginPath(); ctx.arc(shockwave.x, shockwave.y, Math.max(0, shockwave.r), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,200,80,${Math.max(0, shockwave.alpha)})`; ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(255,150,40,0.8)'; ctx.shadowBlur = 18; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(shockwave.x, shockwave.y, Math.max(0, shockwave.r * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,230,150,${Math.max(0, shockwave.alpha * 0.5)})`; ctx.fill(); ctx.restore();
  }
  particles.forEach((p) => {
    const t = p.life / p.maxLife; const alpha = Math.max(0, 1 - t);
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.4, p.size * (1 - t * 0.6)), 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 9; ctx.fill(); ctx.restore();
  });
}
function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, angle: number, crashed: boolean): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  ctx.shadowColor = crashed ? 'rgba(255,120,40,0.85)' : 'rgba(255,209,102,0.5)';
  ctx.shadowBlur = crashed ? 26 : 14;
  ctx.beginPath(); ctx.moveTo(62, 0);
  ctx.quadraticCurveTo(46, -3, 24, -5); ctx.quadraticCurveTo(14, -6, 6, -7);
  ctx.quadraticCurveTo(-4, -22, -18, -40); ctx.quadraticCurveTo(-24, -44.5, -28, -38);
  ctx.quadraticCurveTo(-30.5, -26, -34, -15); ctx.quadraticCurveTo(-38, -9, -42, -7);
  ctx.quadraticCurveTo(-45, -6.5, -46.5, -6);
  ctx.quadraticCurveTo(-50, -14, -54, -24); ctx.quadraticCurveTo(-58, -28.5, -60.5, -22);
  ctx.quadraticCurveTo(-60.5, -14, -56.5, -6); ctx.quadraticCurveTo(-59.5, -2, -60.5, 0);
  ctx.quadraticCurveTo(-59.5, 3, -54.5, 6); ctx.quadraticCurveTo(-30, 8.5, -6, 7.5);
  ctx.quadraticCurveTo(20, 6.5, 44, 3); ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(-60, -12, 62, 8);
  if (crashed) { bodyGrad.addColorStop(0, '#231015'); bodyGrad.addColorStop(0.5, '#7c2a18'); bodyGrad.addColorStop(1, '#d4623a'); }
  else { bodyGrad.addColorStop(0, '#7c1420'); bodyGrad.addColorStop(0.45, '#e63946'); bodyGrad.addColorStop(0.78, '#ff7a80'); bodyGrad.addColorStop(1, '#fff2e6'); }
  ctx.fillStyle = bodyGrad; ctx.fill();
  ctx.strokeStyle = crashed ? 'rgba(255,150,90,0.55)' : 'rgba(255,215,0,0.7)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(50, -1.2); ctx.quadraticCurveTo(10, -2.6, -20, -2.8); ctx.quadraticCurveTo(-40, -3, -52, -4);
  ctx.strokeStyle = crashed ? 'rgba(255,190,140,0.45)' : 'rgba(255,215,0,0.85)'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.save(); ctx.translate(20, -4); ctx.rotate(-0.08);
  const glassGrad = ctx.createLinearGradient(-8, -4, 8, 4);
  glassGrad.addColorStop(0, 'rgba(18,26,44,0.92)'); glassGrad.addColorStop(0.5, 'rgba(130,205,255,0.55)'); glassGrad.addColorStop(1, 'rgba(18,26,44,0.92)');
  ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 4.3, 0, 0, Math.PI * 2); ctx.fillStyle = glassGrad; ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.55)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
  if (!crashed) {
    const g = ctx.createRadialGradient(-58, 0, 0, -58, 0, 20);
    g.addColorStop(0, 'rgba(255,205,120,0.95)'); g.addColorStop(0.5, 'rgba(255,120,90,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(-58, 0, 20, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.restore();
}

export default function AviatorGame({ onExit }: AviatorGameProps) {
  const navigate = useNavigate();
  const { user, showToast } = useAppStore();

  // ── Wallet (real balance only) ───────────────────────────────────────
  const [balance, setBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);

  const refreshWallet = useCallback(async () => {
    if (!user) return;
    setWalletLoading(true);
    try {
      // UserController.me() returns { user, wallet: { balance, currency } }
      const data = await httpGet<Record<string, unknown>>('/api/users/me');
      const wallet = data?.wallet as Record<string, unknown> | undefined;
      const bal = Number(wallet?.balance ?? 0);
      setBalance(Number.isFinite(bal) ? bal : 0);
    } catch {
      showToast?.('Could not load your balance. Refresh to try again.', 'error');
    } finally {
      setWalletLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => { void refreshWallet(); }, [refreshWallet]);

  /* ── Currency & stake floor: from the REGISTERED country ──────────────
     This replaced a live-FX block that polled /api/geo/currency every five
     minutes and converted a $10 USD floor into local money. Two problems
     with that: the floor moved under the player mid-session whenever a rate
     refreshed, and /api/geo/currency is IP-based, so it contradicted the
     country the player actually registered with.

     Now the minimum is a flat per-country number from the shared registry
     (parity rule: 1 cedi = 1 naira), so it is stable, predictable and the
     same value the games bridge and the bet slip enforce. */
  const { country, fmt, minStake, stakeSteps } = useCountry();
  const currency = useMemo(
    () => ({ code: country.currency, symbol: country.symbol }),
    [country],
  );
  const currencyRef = useRef(currency);
  useEffect(() => { currencyRef.current = currency; }, [currency]);
  const minStakeRef = useRef(minStake);
  useEffect(() => { minStakeRef.current = minStake; }, [minStake]);

  const quickAmounts = useMemo(() => stakeSteps.slice(0, 4), [stakeSteps]);

  // If the country changes (rare mid-session, but possible on a fresh login
  // in another tab), pull any idle panel up to the new floor.
  useEffect(() => {
    setPanels((prev) => prev.map((p) => (p.armed || p.roundId ? p : { ...p, amount: Math.max(minStake, p.amount) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minStake]);

  // ── Round state (server is the source of truth for phase/multiplier/crash) ─
  const [phase, setPhase] = useState<Phase>('WAITING');
  const [countdown, setCountdown] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [history, setHistory] = useState<number[]>([]);
  const [fairness, setFairness] = useState<Fairness>({});
  const [revealedCrash, setRevealedCrash] = useState<number | null>(null);
  const [fairnessOpen, setFairnessOpen] = useState<boolean>(false);
  const [panels, setPanels] = useState<BetPanel[]>([defaultBetPanel(), defaultBetPanel()]);

  const [screenFlash, setScreenFlash] = useState<boolean>(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panelsRef = useRef<BetPanel[]>(panels);
  useEffect(() => { panelsRef.current = panels; }, [panels]);

  const phaseRef = useRef<Phase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const startTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Adaptive poll delay, mutated by the poll loop itself (fast while
  // RUNNING, relaxed while WAITING, backed off on a 429).
  const pollBackoffRef = useRef<number>(WAITING_POLL_MS);
  // Set true after the first successful /current response. The local
  // countdown display waits for this before showing a number, so it never
  // shows a guessed value before syncing with the server at least once.
  const hasSyncedRef = useRef<boolean>(false);

  // ── Canvas refs ──────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dimsRef = useRef<Dims>({ w: 0, h: 0, runwayY: 0 });
  const planeScaleRef = useRef<number>(1);
  const planeRef = useRef<PlaneState>({ x: 0, y: 0, angle: 0, flyElapsed: 0, trail: [], opacity: 1 });
  const graphPointsRef = useRef<Point[]>([]);
  const starsRef = useRef<Star[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwaveRef = useRef<Shockwave>({ x: 0, y: 0, r: 0, alpha: 0, active: false });

  // ── Audio (cosmetic only) ───────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ensureAudioCtx = useCallback((): AudioContext | null => {
    if (!audioCtxRef.current) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctor();
      } catch { audioCtxRef.current = null; }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
    return audioCtxRef.current;
  }, []);

  const playExplosionSound = useCallback(() => {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.setValueAtTime(140, now); osc.frequency.exponentialRampToValueAtTime(28, now + 0.42);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, now); oscGain.gain.exponentialRampToValueAtTime(0.9, now + 0.015); oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc.connect(oscGain).connect(ctx.destination); osc.start(now); osc.stop(now + 0.7);
    const bufferSize = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.6);
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass'; noiseFilter.frequency.setValueAtTime(2200, now); noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.5);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now); noiseGain.gain.exponentialRampToValueAtTime(0.55, now + 0.01); noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination); noise.start(now); noise.stop(now + 0.5);
  }, [ensureAudioCtx]);

  const spawnExplosion = useCallback((x: number, y: number) => {
    const colors = ['#ffd700', '#ffb700', '#ff8c00', '#ff5a3c', '#ff2e2e', '#fff2c8'];
    const count = 40;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const speed = Math.random() * 5.5 + 2.2;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, maxLife: Math.random() * 28 + 42, size: Math.random() * 4 + 2, color: colors[Math.floor(Math.random() * colors.length)] });
    }
    particlesRef.current = particles;
    shockwaveRef.current = { x, y, r: 4, alpha: 0.9, active: true };
  }, []);

  const genStars = useCallback((w: number, h: number) => {
    const arr: Star[] = [];
    for (let i = 0; i < 90; i++) arr.push({ x: Math.random() * w, y: Math.random() * h * 0.65, r: Math.random() * 1.2 + 0.3, a: Math.random() * 0.8 + 0.1 });
    starsRef.current = arr;
  }, []);
  const genClouds = useCallback((w: number, h: number) => {
    const arr: Cloud[] = [];
    for (let i = 0; i < 5; i++) arr.push({ x: Math.random() * w, y: Math.random() * h * 0.5 + 10, w: Math.random() * 90 + 50, h: Math.random() * 28 + 14, speed: Math.random() * 0.2 + 0.08, alpha: Math.random() * 0.1 + 0.04 });
    cloudsRef.current = arr;
  }, []);
  const resetPlane = useCallback(() => {
    const { w, runwayY } = dimsRef.current;
    planeRef.current = { x: w * 0.08, y: runwayY, angle: 0, flyElapsed: 0, trail: [], opacity: 1 };
  }, []);
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    canvas.width = w; canvas.height = h;
    const runwayY = h * 0.82;
    dimsRef.current = { w, h, runwayY };
    planeScaleRef.current = Math.max(0.55, Math.min(1, w / 640));
    genStars(w, h); genClouds(w, h); resetPlane();
  }, [genStars, genClouds, resetPlane]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  const drawStatic = useCallback((crashed: boolean) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { w, h, runwayY } = dimsRef.current;
    ctx.clearRect(0, 0, w, h);
    drawBackground(ctx, w, h); drawStars(ctx, starsRef.current); drawClouds(ctx, cloudsRef.current);
    drawRunway(ctx, w, h, runwayY); drawGraph(ctx, graphPointsRef.current);
    const p = planeRef.current;
    ctx.globalAlpha = crashed ? p.opacity : 1;
    drawPlane(ctx, p.x, p.y, planeScaleRef.current, p.angle, crashed);
    ctx.globalAlpha = 1;
    if (crashed) drawExplosion(ctx, particlesRef.current, shockwaveRef.current);
  }, []);
  useEffect(() => { drawStatic(false); }, [drawStatic]);

  // ── Server-authoritative crash sequence ─────────────────────────────
  const runCrashSequence = useCallback((crashPointRaw: number, fairnessReveal?: Fairness) => {
    const crashPoint = Math.min(crashPointRaw, MAX_MULTIPLIER); // display cap only; server already enforced this
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setPhase('CRASHED'); phaseRef.current = 'CRASHED';
    setMultiplier(crashPoint);
    setRevealedCrash(crashPoint);
    setHistory((h) => [crashPoint, ...h].slice(0, 15));
    if (fairnessReveal) setFairness((f) => ({ ...f, ...fairnessReveal }));
    planeRef.current.opacity = 1;

    spawnExplosion(planeRef.current.x, planeRef.current.y);
    playExplosionSound();
    setScreenFlash(true);
    if (flashTimeoutRef.current !== null) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setScreenFlash(false), 160);

    setPanels((prev) => prev.map((p) => (p.roundId && !p.cashedOut ? { ...p, error: null } : p)));

    let fadeRaf = 0;
    const fade = () => {
      planeRef.current.opacity = Math.max(0, planeRef.current.opacity - 0.02);
      particlesRef.current = particlesRef.current
        .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.16, vx: p.vx * 0.98, life: p.life + 1 }))
        .filter((p) => p.life < p.maxLife);
      if (shockwaveRef.current.active) {
        const sw = shockwaveRef.current;
        shockwaveRef.current = { ...sw, r: sw.r + 6.5, alpha: sw.alpha - 0.045 };
        if (shockwaveRef.current.alpha <= 0) shockwaveRef.current.active = false;
      }
      drawStatic(true);
      const stillAnimating = planeRef.current.opacity > 0 || particlesRef.current.length > 0 || shockwaveRef.current.active;
      if (stillAnimating) fadeRaf = requestAnimationFrame(fade);
    };
    fadeRaf = requestAnimationFrame(fade);

    setTimeout(() => {
      cancelAnimationFrame(fadeRaf);
      setPanels([defaultBetPanel(minStake), defaultBetPanel(minStake)]);
      graphPointsRef.current = [];
      particlesRef.current = [];
      shockwaveRef.current = { x: 0, y: 0, r: 0, alpha: 0, active: false };
      resetPlane();
      drawStatic(false);
      setPhase('WAITING'); phaseRef.current = 'WAITING';
      void refreshWallet();
    }, CRASH_HOLD_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawStatic, playExplosionSound, resetPlane, refreshWallet, spawnExplosion]);

  // ── Cashout — server verifies against the true crash point ─────────
  const doCashout = useCallback(async (i: number, multOverride?: number) => {
    const panel = panelsRef.current[i];
    if (!panel.roundId || panel.cashedOut || panel.cashingOut) return;
    const mult = Math.min(multOverride !== undefined ? multOverride : multiplier, MAX_MULTIPLIER);

    setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, cashingOut: true } : p)));
    try {
      const data = await httpPost<Record<string, unknown>>('/api/games/aviator/cashout', {
        roundId: panel.roundId,
        cashoutAt: mult,
      });
      const payout = Number(data?.payout ?? 0);
      const confirmedMult = Number(data?.multiplier ?? mult);
      setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, cashingOut: false, cashedOut: true, cashoutMult: confirmedMult, payout } : p)));
      if (typeof data?.walletBalance === 'number') setBalance(data.walletBalance as number);
      else void refreshWallet();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Cashout failed.';
      setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, cashingOut: false, error: msg } : p)));
      showToast?.(msg, 'error');
    }
  }, [multiplier, refreshWallet, showToast]);

  // ── RAF loop: smooth local animation, reconciled by the poller below ──
  function runLoop(ts: number): void {
    if (phaseRef.current !== 'RUNNING') return;
    const startTs = startTsRef.current ?? ts;
    const elapsed = ts - startTs;
    const mult = Math.min(Math.max(1.0, Math.exp(GROWTH_RATE * elapsed)), MAX_MULTIPLIER);
    setMultiplier(mult);

    panelsRef.current.forEach((p, i) => {
      if (p.roundId && !p.cashedOut && !p.cashingOut && p.auto && mult >= Math.min(p.autoVal, MAX_MULTIPLIER)) void doCashout(i, mult);
    });

    const { w, h, runwayY } = dimsRef.current;
    const p = planeRef.current;
    p.flyElapsed = elapsed;
    const TAXI = 1200, LIFTOFF = 2400;
    const scale = planeScaleRef.current;

    if (elapsed < TAXI) {
      const t = elapsed / TAXI, e = t * t;
      p.x = w * 0.08 + e * (w * 0.36); p.y = runwayY + Math.sin(elapsed * 0.03) * 1.5; p.angle = 0;
    } else if (elapsed < LIFTOFF) {
      const t = (elapsed - TAXI) / (LIFTOFF - TAXI), e = t * t;
      p.x = w * 0.44 + e * w * 0.24; p.y = runwayY - e * h * 0.42; p.angle = -e * 0.16;
    } else {
      const t2 = (elapsed - LIFTOFF) / 1000;
      p.x = Math.min(w * 0.68 + t2 * 16, w * 0.84);
      p.y = Math.max(runwayY - h * 0.42 - t2 * 12 + Math.sin(elapsed * 0.002) * 4, h * 0.1);
      p.angle = Math.max(-0.2, -0.16 - t2 * 0.004);
    }

    const tx = p.x - Math.cos(p.angle) * 56 * scale;
    const ty = p.y - Math.sin(p.angle) * 56 * scale;
    p.trail.push({ x: tx, y: ty }); if (p.trail.length > 40) p.trail.shift();
    graphPointsRef.current.push({ x: tx, y: ty }); if (graphPointsRef.current.length > 300) graphPointsRef.current.shift();

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      drawBackground(ctx, w, h); drawStars(ctx, starsRef.current); drawClouds(ctx, cloudsRef.current);
      drawRunway(ctx, w, h, runwayY); drawGraph(ctx, graphPointsRef.current); drawTrail(ctx, p.trail);
      drawPlane(ctx, p.x, p.y, scale, p.angle, false);
    }
    rafRef.current = requestAnimationFrame((next) => runLoopRef.current(next));
  }
  const runLoopRef = useRef<(ts: number) => void>(() => {});
  runLoopRef.current = runLoop;

  const beginRoundRef = useRef<() => void>(() => {});
  // beginRound ONLY starts the local animation now — it no longer places
  // bets (those go out immediately on click via placeBetNow, below), and
  // it is only ever invoked from the poller observing state === 'RUNNING'
  // from the server, never from a local timer guess.
  const beginRound = useCallback(() => {
    phaseRef.current = 'RUNNING'; setPhase('RUNNING'); setMultiplier(1.0);
    startTsRef.current = performance.now();
    graphPointsRef.current = []; resetPlane(); planeRef.current.flyElapsed = 0;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame((ts) => runLoopRef.current(ts));
  }, [resetPlane]);
  useEffect(() => { beginRoundRef.current = beginRound; }, [beginRound]);

  // Places a bet immediately, during WAITING — this is the fix for the
  // "Betting is closed for this round" 422: the old flow waited until the
  // client's local countdown hit 0 before ever calling /play, which could
  // lose the race against the server's own fixed WAITING window. Now the
  // bet goes out the instant the user clicks, any time WAITING is open.
  const placeBetNow = useCallback(async (i: number) => {
    // Flat per-country floor — no FX, so this can't drift between the moment
    // the user typed an amount and the moment the bet is submitted.
    const liveMin = minStakeRef.current;
    const amount = panelsRef.current[i].amount;
    if (amount < liveMin) {
      setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, error: `Minimum bet is ${fmt(liveMin)}` } : p)));
      return;
    }
    setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, placing: true, armed: true, error: null } : p)));
    try {
      const playData = await httpPost<{ id?: string }>('/api/games/aviator/play', { stake: amount });
      const roundId = playData?.id ?? null;
      setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, placing: false, roundId } : p)));
      void refreshWallet();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not place bet.';
      setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, placing: false, armed: false, error: msg } : p)));
      showToast?.(msg, 'error');
    }
  }, [refreshWallet, showToast]);

  // ── Round phase + countdown: driven by GET /current, not guessed locally ─
  // Self-rescheduling loop (setTimeout, not setInterval) so the delay can
  // adapt: fast while RUNNING, relaxed while WAITING, and backed off
  // exponentially whenever the server/proxy answers 429.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      pollRef.current = setTimeout(() => { void poll(); }, delayMs);
    };

    const poll = async () => {
      try {
        const data = await httpGet<Record<string, unknown>>('/api/games/aviator/current');
        // A successful response means we're back in sync — reset backoff
        // and let the local countdown display trust its numbers from now on.
        pollBackoffRef.current = WAITING_POLL_MS;
        hasSyncedRef.current = true;

        if (!data) { scheduleNext(WAITING_POLL_MS); return; }
        const state = data.state as Phase | undefined;

        if (state === 'WAITING' && phaseRef.current !== 'WAITING') {
          // server has already rolled over to a fresh round (e.g. after this
          // client's own CRASHED hold finished, or on first load)
          setPanels([defaultBetPanel(minStake), defaultBetPanel(minStake)]);
          graphPointsRef.current = [];
          resetPlane();
          drawStatic(false);
          setPhase('WAITING'); phaseRef.current = 'WAITING';
        }
        if (state === 'WAITING') {
          const c = typeof data.countdownSecondsRemaining === 'number' ? data.countdownSecondsRemaining : countdown;
          setCountdown(c);
        }
        // The server, not a local timer, decides when a round actually
        // starts — this is the only place the RUNNING animation is
        // triggered from.
        if (state === 'RUNNING' && phaseRef.current !== 'RUNNING') {
          beginRoundRef.current();
        }

        const crashPoint = typeof data.crashPoint === 'number' ? data.crashPoint : undefined;
        const seed = typeof data.serverSeed === 'string' ? data.serverSeed : undefined;
        const clientSeed = typeof data.clientSeed === 'string' ? data.clientSeed : undefined;
        const hash = typeof data.hash === 'string' ? data.hash : undefined;
        if (seed || clientSeed || hash) setFairness((f) => ({ ...f, serverSeed: seed ?? f.serverSeed, clientSeed: clientSeed ?? f.clientSeed, hash: hash ?? f.hash }));

        if (state === 'CRASHED' && phaseRef.current !== 'CRASHED') {
          runCrashSequence(crashPoint ?? multiplier, { serverSeed: seed, clientSeed, hash });
        }

        // Fast-poll only while a round is actually live; ease off otherwise.
        scheduleNext(phaseRef.current === 'RUNNING' ? RUNNING_POLL_MS : WAITING_POLL_MS);
      } catch (e) {
        if (e instanceof RateLimitError) {
          // Back off exponentially instead of retrying at the same fast
          // cadence every tick — this is what previously caused a 429 storm.
          pollBackoffRef.current = Math.min(
            Math.max(pollBackoffRef.current * 2, e.retryAfterMs),
            MAX_POLL_BACKOFF_MS,
          );
        }
        scheduleNext(pollBackoffRef.current);
      }
    };

    void poll();
    return () => { cancelled = true; if (pollRef.current !== null) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Local countdown: purely cosmetic tick-down. Actual round start is
  // driven entirely by the poller detecting state === 'RUNNING' above, so
  // nothing here can race the server or trigger a premature bet.
  useEffect(() => {
    if (!user) return;
    if (phase !== 'WAITING') return;
    const iv = setInterval(() => {
      if (!hasSyncedRef.current) return; // don't show a guessed number before hearing from the server at least once
      setCountdown((c) => (c <= 0 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [user, phase]);

  useEffect(() => {
    if (!user) return;
    httpGet<Array<{ result?: Record<string, unknown> }>>('/api/games/aviator/history?limit=15')
      .then((rounds) => {
        const points = (rounds ?? [])
          .map((r) => Number(r.result?.crashPoint))
          .filter((n) => Number.isFinite(n))
          .map((n) => Math.min(n, MAX_MULTIPLIER));
        if (points.length) setHistory(points);
      })
      .catch(() => { /* non-critical */ });
  }, [user]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (pollRef.current !== null) clearTimeout(pollRef.current);
    if (flashTimeoutRef.current !== null) clearTimeout(flashTimeoutRef.current);
  }, []);

  // ── Bet panel actions ────────────────────────────────────────────────
  const clampAmt = (v: number): number => {
    const max = balance !== null ? Math.max(minStake, Math.floor(balance)) : minStake;
    return Math.max(minStake, Math.min(Math.floor(v) || minStake, max));
  };
  const setAmt = (i: number, v: number) => setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, amount: clampAmt(v) } : p)));
  const adjustAmt = (i: number, kind: 'half' | 'double') => setPanels((prev) => prev.map((p, idx) => {
    if (idx !== i) return p;
    let v = p.amount;
    if (kind === 'half') v = Math.max(minStake, v / 2);
    if (kind === 'double') v = Math.min(balance ?? v, v * 2);
    return { ...p, amount: Math.round(v) };
  }));
  const toggleAuto = (i: number) => setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, auto: !p.auto } : p)));
  const setAutoVal = (i: number, v: string) => setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, autoVal: Math.min(MAX_MULTIPLIER, Math.max(1.01, parseFloat(v) || 1.01)) } : p)));

  // Bets are placed the instant you click, so there's no "cancel" once
  // roundId is set (or a placement is in flight) — funds are already
  // debited server-side at that point.
  const placeOrCancel = (i: number) => {
    ensureAudioCtx();
    const panel = panels[i];
    if (phase === 'RUNNING' && panel.roundId && !panel.cashedOut) { void doCashout(i); return; }
    if (phase !== 'WAITING') return;
    if (panel.roundId || panel.placing) return;
    if (balance === null || panel.amount > balance || panel.amount < minStake) return;
    void placeBetNow(i);
  };

  const btnLabel = (p: BetPanel): string => {
    if (p.placing) return 'PLACING…';
    if (p.cashingOut) return 'CASHING OUT…';
    if (phase === 'RUNNING' && p.roundId && !p.cashedOut) return `CASH OUT ${fmt(p.amount * multiplier)}`;
    if (p.roundId) return 'BET PLACED';
    return 'BET';
  };
  const btnDisabled = (p: BetPanel): boolean => {
    if (p.placing || p.cashingOut) return true;
    if (phase === 'RUNNING') return !(p.roundId && !p.cashedOut);
    if (phase === 'CRASHED') return true;
    if (p.roundId) return true; // already placed this round
    return balance === null || p.amount > balance || p.amount < minStake;
  };

  const phaseLabel = phase === 'WAITING' ? 'WAITING FOR NEXT ROUND' : phase === 'RUNNING' ? 'FLYING' : 'CRASHED';
  const lowBalance = balance !== null && balance < minStake;

  if (!user) {
    return (
      <div
        className="rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-4 text-center px-6"
        style={{ backgroundColor: '#0c0714', color: '#f2eaf6', border: '1px solid rgba(255,215,0,0.15)', minHeight: '480px', fontFamily: "'IBM Plex Mono', monospace" }}
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)' }}>
          <Lock size={22} color="#ffd700" />
        </div>
        <div>
          <div className="text-lg font-bold" style={{ color: '#ffd700' }}>Sign in to play Aviator</div>
          <p className="text-sm mt-1" style={{ color: '#8d7a99', maxWidth: 340 }}>
            This is a real-money game. You need an account and a funded wallet to place bets.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/login')} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(135deg, #c8960c 0%, #ffd700 60%, #e8a800 100%)', color: '#1a1220' }}>
            Log In
          </button>
          <button onClick={() => navigate('/register')} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#1C1420', border: '1px solid #2c2233', color: '#fff' }}>
            Create Account
          </button>
        </div>
        {onExit && (
          <button onClick={onExit} className="text-xs mt-2" style={{ color: '#7a6a86' }}>← Back to lobby</button>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col relative"
      style={{ backgroundColor: '#0c0714', color: '#f2eaf6', border: '1px solid rgba(255,215,0,0.15)', minHeight: '680px', fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .avi-hud { font-family: 'Chakra Petch', sans-serif; }
        @keyframes avi-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .avi-countdown { animation: avi-pulse 1s ease-in-out infinite; }
        @keyframes avi-shake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-4px,3px); } 40% { transform: translate(4px,-3px); } 60% { transform: translate(-3px,2px); } 80% { transform: translate(3px,-2px); } }
        .avi-shake { animation: avi-shake 0.35s ease; }
        @keyframes avi-pill-in { from { transform: scale(0.5) rotate(-10deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
        .avi-pill { animation: avi-pill-in 0.25s ease-out; }
        .avi-stub { position: relative; }
        .avi-stub::before, .avi-stub::after { content: ''; position: absolute; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; background: #0c0714; border-radius: 50%; }
        .avi-stub::before { left: -4px; } .avi-stub::after { right: -4px; }
        .avi-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,215,0,0.12); border-left: 2px solid rgba(255,215,0,0.4); }
        @keyframes avi-flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
        .avi-screen-flash { position: absolute; inset: 0; z-index: 40; pointer-events: none; background: radial-gradient(circle at 55% 45%, rgba(255,240,200,0.95), rgba(255,150,60,0.55) 45%, rgba(255,60,30,0) 75%); animation: avi-flash 0.16s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) { .avi-countdown, .avi-shake, .avi-pill, .avi-screen-flash { animation: none !important; } }
      `}</style>

      {screenFlash && <div className="avi-screen-flash" />}

      <div className="w-full flex items-center justify-between px-3 py-2.5 flex-shrink-0" style={{ backgroundColor: '#140b20', borderBottom: '1px solid rgba(255,215,0,0.15)' }}>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="avi-hud text-sm font-bold truncate" style={{ letterSpacing: '0.06em', color: '#ffd700' }}>✈ AVIATOR</span>
          <span className="hidden sm:block text-[9px] tracking-[2px] truncate" style={{ color: '#6b5a76' }}>REAL-MONEY · CASH OUT BEFORE IT CLIMBS AWAY</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex flex-col items-end leading-none ml-1">
            <span className="text-[9px]" style={{ color: '#8d7a99' }}>BALANCE</span>
            <span className="avi-hud font-semibold text-sm" style={{ color: '#ffd700' }}>
              {walletLoading || balance === null ? '…' : fmt(balance)}
            </span>
          </div>
          {onExit && (
            <button onClick={onExit} aria-label="Back to lobby" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#1C1420', border: '1px solid #2c2233', color: '#fff' }}>
              <X size={14} /><span className="hidden sm:inline">Back to lobby</span>
            </button>
          )}
        </div>
      </div>

      {lowBalance && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg text-xs flex items-center justify-between" style={{ backgroundColor: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)', color: '#ffd700' }}>
          <span>Your balance is low.</span>
          <button onClick={() => navigate('/wallet/deposit')} className="font-bold underline">Add funds</button>
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-[1.65fr_1fr] gap-3 px-3 mt-3 lg:items-start">
        <div className="flex flex-col gap-3 min-w-0 order-1">
          <div ref={wrapRef} className="relative rounded-xl overflow-hidden" style={{ height: 'clamp(180px, 42vw, 320px)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <canvas ref={canvasRef} className="block w-full h-full" />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: '4%' }}>
              {phase === 'WAITING' ? (
                <div className="avi-countdown text-center">
                  <div className="text-[10px] tracking-[3px]" style={{ color: '#e7c6d8' }}>NEXT ROUND IN</div>
                  <div className="avi-hud font-black" style={{ fontSize: 'clamp(1.6rem, 8vw, 2.6rem)', color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>{countdown}</div>
                </div>
              ) : (
                <div className={`text-center ${phase === 'CRASHED' ? 'avi-shake' : ''}`}>
                  <div className="avi-hud font-black" style={{ fontSize: 'clamp(1.5rem, 8vw, 2.8rem)', color: phase === 'CRASHED' ? '#ff5a5a' : '#fff', textShadow: phase === 'CRASHED' ? '0 0 30px rgba(255,60,60,0.6)' : '0 0 20px rgba(255,255,255,0.4), 0 0 40px rgba(255,215,0,0.35)', letterSpacing: '1px' }}>
                    {phase === 'CRASHED' ? '💥 ' : ''}{multiplier.toFixed(2)}x
                  </div>
                  <div className="text-[9px] tracking-[3px] mt-1" style={{ color: '#e7c6d8' }}>{phaseLabel}</div>
                </div>
              )}
            </div>
          </div>

          <div className="avi-card rounded-xl p-3">
            <div className="avi-hud text-[11px] tracking-widest mb-2 flex items-center gap-1.5" style={{ color: '#7a6a86' }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#ffd700' }} />ROUND HISTORY
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {history.length === 0 && <span className="text-xs italic flex-shrink-0" style={{ color: '#5f5268' }}>No rounds yet</span>}
              {history.map((c, i) => {
                const color = c >= 10 ? '#ffd700' : c >= 2 ? '#39e67e' : '#e63946';
                return (
                  <div key={i} className="avi-pill avi-stub flex-shrink-0 px-3.5 py-1.5 rounded-md text-[11px] font-bold" style={{ backgroundColor: `${color}1e`, border: `1px dashed ${color}77`, color }}>
                    {c.toFixed(2)}x
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 min-w-0 order-2">
          {panels.map((panel, i) => (
            <div key={i} className="avi-card flex flex-col gap-2 rounded-xl p-3">
              <div className="avi-hud text-[11px] tracking-widest" style={{ color: '#7a6a86' }}>BET {i + 1}</div>

              <div className="flex items-center gap-1.5">
                <button disabled={phase !== 'WAITING' || panel.armed} onClick={() => adjustAmt(i, 'half')} className="px-2.5 py-2 rounded-md text-xs font-semibold disabled:opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc' }}>½</button>
                <div className="flex-1 flex items-center rounded-md overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,215,0,0.25)' }}>
                  <span className="px-2 font-bold" style={{ color: '#ffd700' }}>{currency.symbol}</span>
                  <input type="number" min={minStake} disabled={phase !== 'WAITING' || panel.armed} value={panel.amount} onChange={(e) => setAmt(i, parseFloat(e.target.value))} className="flex-1 min-w-0 bg-transparent outline-none text-right py-2 px-2 font-bold disabled:opacity-60" style={{ color: '#ffd700' }} />
                </div>
                <button disabled={phase !== 'WAITING' || panel.armed} onClick={() => adjustAmt(i, 'double')} className="px-2.5 py-2 rounded-md text-xs font-semibold disabled:opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc' }}>2×</button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {quickAmounts.map((amt: number) => (
                  <button key={amt} disabled={phase !== 'WAITING' || panel.armed} onClick={() => setAmt(i, amt)} className="py-1.5 rounded-md text-[11px] font-semibold disabled:opacity-40" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#b3a3bd' }}>{fmt(amt)}</button>
                ))}
              </div>
              <div className="text-[9px] text-center" style={{ color: '#5f5268' }}>Minimum bet: {fmt(minStake)}</div>

              <label className="flex items-center gap-2 text-[11px]" style={{ color: '#b3a3bd' }}>
                <input type="checkbox" checked={panel.auto} disabled={phase !== 'WAITING' || panel.armed} onChange={() => toggleAuto(i)} style={{ accentColor: '#ffd700' }} />
                Auto-cashout at
                <input type="number" step="0.1" min="1.01" max={MAX_MULTIPLIER} disabled={phase !== 'WAITING' || panel.armed} value={panel.autoVal} onChange={(e) => setAutoVal(i, e.target.value)} className="w-14 text-center rounded px-1 py-0.5 disabled:opacity-50" style={{ backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,215,0,0.2)', color: '#ffd700' }} />×
              </label>

              <button
                onClick={() => placeOrCancel(i)}
                disabled={btnDisabled(panel)}
                className="avi-hud py-3 rounded-lg font-bold text-sm tracking-[2px] disabled:opacity-45"
                style={{
                  background: phase === 'RUNNING' && panel.roundId && !panel.cashedOut ? 'linear-gradient(135deg, #2fbf6e, #1e8f52)' : 'linear-gradient(135deg, #c8960c 0%, #ffd700 60%, #e8a800 100%)',
                  color: phase === 'RUNNING' && panel.roundId && !panel.cashedOut ? '#fff' : '#1a1220',
                  boxShadow: phase === 'RUNNING' && panel.roundId && !panel.cashedOut ? '0 0 18px rgba(57,230,126,0.35)' : '0 0 18px rgba(255,215,0,0.25)',
                }}
              >
                {btnLabel(panel)}
              </button>

              <div className="text-[11px] text-center min-h-[14px]" style={{ color: panel.error ? '#e63946' : panel.cashedOut ? '#39e67e' : phase === 'CRASHED' && panel.roundId ? '#e63946' : '#8d7a99' }}>
                {panel.error
                  ? panel.error
                  : panel.cashedOut
                  ? `✓ Won ${fmt(panel.payout)} @ ${panel.cashoutMult.toFixed(2)}x`
                  : phase === 'CRASHED' && panel.roundId
                  ? `✗ Lost ${fmt(panel.amount)}`
                  : panel.armed || panel.roundId ? `Bet: ${fmt(panel.amount)}` : ''}
              </div>
            </div>
          ))}

          <button onClick={() => setFairnessOpen(true)} className="flex items-center justify-center gap-1 text-[10px] py-1" style={{ color: '#7a6a86' }}>
            <Info size={12} />Round fairness details
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 text-[10px] tracking-wide text-center pb-3 pt-4" style={{ color: '#4a4051' }}>
        <TrendingUp size={11} />Real-money game · play responsibly
      </div>

      {fairnessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setFairnessOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-xl p-4 w-full max-w-sm flex flex-col gap-2" style={{ backgroundColor: '#140b20', border: '1px solid rgba(255,215,0,0.25)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="avi-hud text-sm font-bold" style={{ color: '#ffd700' }}>Round fairness</span>
              <button onClick={() => setFairnessOpen(false)} aria-label="Close"><X size={16} style={{ color: '#8d7a99' }} /></button>
            </div>
            <FairnessRow label="Server seed" value={fairness.serverSeed ?? 'Not yet revealed'} />
            <FairnessRow label="Client seed" value={fairness.clientSeed ?? '—'} />
            <FairnessRow label="Hash (pre-round commit)" value={fairness.hash ?? '—'} />
            <FairnessRow label="Crash point" value={revealedCrash !== null ? `${revealedCrash.toFixed(2)}x` : 'Revealed after round'} />
            <p className="text-[10px] mt-1" style={{ color: '#5f5268' }}>
              The crash point is generated and hash-committed by the server before the round starts,
              and the seed is revealed after it ends so you can independently verify it wasn't changed
              afterward. This does not guarantee any particular outcome or win rate — it only shows
              that the outcome wasn't altered once the round began. See the game rules for the
              published return-to-player rate and max multiplier ({MAX_MULTIPLIER}x).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FairnessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span style={{ color: '#8d7a99' }}>{label}</span>
      <span className="font-mono truncate max-w-[220px]" style={{ color: '#e0d6e6' }}>{value}</span>
    </div>
  );
}