import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PublicIcon from '@mui/icons-material/Public';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useAppStore } from '../store';
import api from '../utils/api';
import { useCountry } from '../hooks/useCountry';
import { TOKEN_KEY as SESSION_TOKEN_KEY, USER_KEY as SESSION_USER_KEY } from '../utils/session';


const GAME_SLUG = 'spin-da-bottle';

/*
 * This component talks to the Spin Da' Bottle backend directly via
 * fetch() — it does NOT go through api.ts / api.games.play(). The only
 * api.ts call anywhere in this file is api.wallet.getWallet(), used
 * below purely to display the balance. Every round (POST /play) is
 * self-contained here: request, auth header, response parsing, and
 * error handling all live in this one file.
 */
const API_BASE = 'https://futballbackend-production-b1a0.up.railway.app';

// Must match LoginPage.TOKEN_KEY — that's where the JWT actually gets
// written (localStorage on "remember me", sessionStorage otherwise;
// saveSession() currently mirrors it into localStorage either way).
// Unified SkyBet key — see src/utils/session.ts. Was 'accessToken',
// which stopped matching the moment the token was renamed.
const AUTH_TOKEN_KEY = SESSION_TOKEN_KEY;

function getAuthTokenForSpin(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);
}

interface PlayRoundResponse {
  roundId: string;
  choice: Choice;
  outcome: Outcome;
  won: boolean;
  stake: number;
  payout: number;
  balanceAfter: number;
  fairness?: {
    serverSeed?: string;
    serverSeedHash?: string;
    clientSeed?: string;
    nonce?: string | number;
    resultHash?: string;
  };
  createdAt?: string;
}

async function playRound(
  body: { choice: Choice; stake: number; clientSeed?: string },
  authToken?: string | null
): Promise<PlayRoundResponse> {
  const res = await fetch(`${API_BASE}/api/games/${GAME_SLUG}/play`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('session expired — please sign in again');
  }

  if (!res.ok) {
    let message = `Spin request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.message) message = errBody.message;
    } catch {
      // response body wasn't JSON — keep the generic status message
    }
    throw new Error(message);
  }

  return res.json();
}

/* ---------------------------------------------------------------------------
   Currency — driven by the REGISTERED country
   ---------------------------------------------------------------------------
   Removed: detectGeo() (ipapi.co) plus fetchFxRates() against an NGN-based FX
   table refreshed every five minutes, used to render an "≈ ₦1,234" secondary
   line under every figure.

   Both the detection and the conversion are gone. Detection contradicted the
   country the player registered with; the conversion line is meaningless under
   the parity rule, where 1 cedi IS 1 naira and the primary figure is already
   in the player's own currency. Showing an approximate second number would
   imply an exchange that doesn't happen.
   ------------------------------------------------------------------------- */

interface GeoInfo {
  countryCode: string;
  countryName: string;
  currencyCode: string;
}


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COUNTDOWN_SECS = 5;
const MIN_SPIN_MS = 3400;
const MAX_SPIN_MS = 4600;
const MIN_BET = 150; // cedis
const BET_PRESETS = [150, 300, 750, 1500];

type Choice = 'UP' | 'DOWN';
type Outcome = 'UP' | 'DOWN' | 'MIDDLE';
type Phase = 'WAITING' | 'PLACING' | 'SPINNING' | 'RESULT';

interface SpinResult {
  outcome: Outcome;
  won: boolean;
  fairness?: {
    serverSeed?: string;
    serverSeedHash?: string;
    clientSeed?: string;
    nonce?: string | number;
    resultHash?: string;
  };
}

/**
 * Parses the raw play() response into the shape the UI needs.
 *
 * SpinBottlePlayResponse puts `outcome` / `won` / `fairness` directly on
 * the response object (no nested "result" key) — read straight off what
 * playRound() returns.
 *
 * Throws instead of defaulting to MIDDLE: a thrown parse failure is
 * treated by the caller as an error state, never silently dressed up as
 * a legitimate (and coincidentally house-winning) round outcome.
 */
function parseSpinResult(input: unknown, source: string): SpinResult {
  const round = (input ?? {}) as Record<string, unknown>;
  const outcomeRaw = round.outcome;
  const outcomeStr = typeof outcomeRaw === 'string' ? outcomeRaw.toUpperCase() : null;

  if (outcomeStr !== 'UP' && outcomeStr !== 'DOWN' && outcomeStr !== 'MIDDLE') {
    // eslint-disable-next-line no-console
    console.error(`[SpinDaBottle] unparseable play() response (source=${source}):`, round);
    throw new Error('Round result could not be read from the server response.');
  }

  const outcome: Outcome = outcomeStr;
  const won = Boolean(round.won);
  const fairnessRaw = round.fairness as Record<string, unknown> | undefined;
  return {
    outcome,
    won,
    fairness: fairnessRaw
      ? {
          serverSeed: fairnessRaw.serverSeed as string | undefined,
          serverSeedHash: fairnessRaw.serverSeedHash as string | undefined,
          clientSeed: fairnessRaw.clientSeed as string | undefined,
          nonce: fairnessRaw.nonce as string | number | undefined,
          resultHash: fairnessRaw.resultHash as string | undefined,
        }
      : undefined,
  };
}

interface BystanderResult {
  id: number;
  name: string;
  guess: Choice;
  amount: number;
  won: boolean;
}

const BYSTANDER_NAMES = [
  'lucky_spin', 'bottleking', 'up_only', 'midmaster', 'the_gambler',
  'neon_bet', 'rizzy', 'highroll', 'slick_dan', 'quiet_ace',
  'down_queen', 'spindoctor', 'mr_house', 'aces_high', 'spinwitch',
];

// ---------------------------------------------------------------------------
// angle-to-outcome mapping.
//
// drawBottle() draws the bottle neck pointing "up" in local space, then
// rotates the canvas by `(angleDeg - 90) degrees`. Working that rotation
// through: angleDeg = 90 is what actually points the bottle straight UP
// on screen, and angleDeg = 270 is what points it straight DOWN.
// angleDeg = 0 / 180 point it sideways (left/right) — which is exactly
// where drawTable() renders the horizontal "MIDDLE / house zone" line.
// ---------------------------------------------------------------------------
function getTargetAngle(outcome: Outcome): number {
  switch (outcome) {
    case 'UP':
      return 90 + (Math.random() * 50 - 25);
    case 'DOWN':
      return 270 + (Math.random() * 50 - 25);
    case 'MIDDLE':
      return (Math.random() > 0.5 ? 0 : 180) + (Math.random() * 30 - 15);
  }
}

interface Spin {
  startAngle: number;
  totalDelta: number;
  duration: number;
  startTime: number | null;
}

function createSpin(startAngle: number, targetAngle: number, duration: number): Spin {
  const fullSpins = (3 + Math.floor(Math.random() * 3)) * 360;
  const normalizedTarget = ((targetAngle % 360) + 360) % 360;
  const currentOffset = ((startAngle % 360) + 360) % 360;
  let delta = normalizedTarget - currentOffset;
  if (delta < 0) delta += 360;
  return { startAngle, totalDelta: fullSpins + delta, duration, startTime: null };
}

function ease(t: number): number {
  const base = 1 - Math.pow(1 - t, 4);
  if (t > 0.85) {
    const wobbleT = (t - 0.85) / 0.15;
    const decay = 1 - wobbleT;
    const wobble = Math.sin(wobbleT * Math.PI * 5) * 0.006 * decay;
    return base + wobble;
  }
  return base;
}

function evaluateSpin(spin: Spin, now: number): { angle: number; done: boolean } {
  if (!spin.startTime) spin.startTime = now;
  const elapsed = now - spin.startTime;
  const t = Math.min(elapsed / spin.duration, 1);
  const angle = spin.startAngle + spin.totalDelta * ease(t);
  return { angle, done: t >= 1 };
}

// ---------------------------------------------------------------------------
// Canvas drawing — table + bottle
// ---------------------------------------------------------------------------
const CX = 160;
const CY = 160;
const R = 148;

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function drawTable(c: CanvasRenderingContext2D, highlightZone: Outcome | null) {
  c.clearRect(0, 0, 320, 320);

  const baseGrad = c.createRadialGradient(CX, CY, 0, CX, CY, R);
  baseGrad.addColorStop(0, '#1a2638');
  baseGrad.addColorStop(0.7, '#111d2e');
  baseGrad.addColorStop(1, '#0a1520');
  c.beginPath();
  c.arc(CX, CY, R, 0, Math.PI * 2);
  c.fillStyle = baseGrad;
  c.fill();

  c.save();
  c.beginPath();
  c.arc(CX, CY, R, Math.PI, 0);
  c.lineTo(CX, CY);
  c.closePath();
  c.fillStyle = highlightZone === 'UP' ? 'rgba(0, 210, 100, 0.22)' : 'rgba(0, 190, 90, 0.10)';
  c.fill();
  c.restore();

  c.save();
  c.beginPath();
  c.arc(CX, CY, R, 0, Math.PI);
  c.lineTo(CX, CY);
  c.closePath();
  c.fillStyle = highlightZone === 'DOWN' ? 'rgba(255, 55, 55, 0.22)' : 'rgba(220, 40, 40, 0.10)';
  c.fill();
  c.restore();

  c.beginPath();
  c.moveTo(CX - R, CY);
  c.lineTo(CX + R, CY);
  c.strokeStyle = highlightZone === 'MIDDLE' ? 'rgba(255, 215, 0, 0.7)' : 'rgba(255, 215, 0, 0.2)';
  c.lineWidth = highlightZone === 'MIDDLE' ? 5 : 3;
  c.stroke();

  c.fillStyle = 'rgba(255, 215, 0, 0.35)';
  c.font = 'bold 9px Rajdhani, sans-serif';
  c.textAlign = 'center';
  c.fillText('HOUSE', CX + 90, CY - 5);
  c.fillText('ZONE', CX + 90, CY + 11);

  c.font = 'bold 14px Rajdhani, sans-serif';
  c.fillStyle = highlightZone === 'UP' ? 'rgba(0, 230, 120, 0.9)' : 'rgba(0, 210, 100, 0.45)';
  c.fillText('▲ UP', CX, CY - 72);
  c.fillStyle = highlightZone === 'DOWN' ? 'rgba(255, 80, 80, 0.9)' : 'rgba(230, 60, 60, 0.45)';
  c.fillText('▼ DOWN', CX, CY + 85);

  [R * 0.95, R * 0.75, R * 0.45].forEach((r, i) => {
    c.beginPath();
    c.arc(CX, CY, r, 0, Math.PI * 2);
    c.strokeStyle = `rgba(255, 215, 0, ${0.05 - i * 0.01})`;
    c.lineWidth = 0.5;
    c.stroke();
  });

  c.beginPath();
  c.arc(CX, CY, R, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(255, 215, 0, 0.35)';
  c.lineWidth = 2;
  c.stroke();

  c.beginPath();
  c.arc(CX, CY, R - 4, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  c.lineWidth = 1;
  c.stroke();

  const sheenGrad = c.createRadialGradient(CX - 40, CY - 50, 0, CX, CY, R);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  c.beginPath();
  c.arc(CX, CY, R, 0, Math.PI * 2);
  c.fillStyle = sheenGrad;
  c.fill();
}

function drawStar(c: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, color: string) {
  const spikes = 5;
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  c.beginPath();
  c.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    c.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    c.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function drawBottle(c: CanvasRenderingContext2D, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;

  c.save();
  c.translate(CX, CY);
  c.rotate(rad);

  // ── dimensions (green glass bottle: cap → neck → shoulder → body → rounded base) ──
  const neckHalfW = 7;
  const bodyHalfW = 18;
  const shoulderY = 6;
  const bodyTopY = 20;
  const bodyBottomY = 82;
  const bottomTipY = 96;
  const neckTopY = -42;
  const capHalfW = 9;
  const capTopY = -58;

  c.save();
  c.shadowColor = 'rgba(0,0,0,0.55)';
  c.shadowBlur = 14;
  c.shadowOffsetX = 5;
  c.shadowOffsetY = 6;

  const glassGrad = c.createLinearGradient(-bodyHalfW, 0, bodyHalfW, 0);
  glassGrad.addColorStop(0, 'rgba(18, 82, 26, 0.95)');
  glassGrad.addColorStop(0.16, 'rgba(58, 150, 42, 0.88)');
  glassGrad.addColorStop(0.42, 'rgba(150, 215, 90, 0.82)');
  glassGrad.addColorStop(0.58, 'rgba(120, 198, 68, 0.85)');
  glassGrad.addColorStop(0.82, 'rgba(48, 128, 34, 0.9)');
  glassGrad.addColorStop(1, 'rgba(12, 62, 20, 0.96)');

  // body + neck as one continuous silhouette
  c.beginPath();
  c.moveTo(-neckHalfW, shoulderY);
  c.bezierCurveTo(-neckHalfW - 3, shoulderY + 9, -bodyHalfW, bodyTopY - 8, -bodyHalfW, bodyTopY);
  c.lineTo(-bodyHalfW, bodyBottomY);
  c.quadraticCurveTo(-bodyHalfW, bottomTipY, 0, bottomTipY);
  c.quadraticCurveTo(bodyHalfW, bottomTipY, bodyHalfW, bodyBottomY);
  c.lineTo(bodyHalfW, bodyTopY);
  c.bezierCurveTo(bodyHalfW, bodyTopY - 8, neckHalfW + 3, shoulderY + 9, neckHalfW, shoulderY);
  c.lineTo(neckHalfW, neckTopY);
  c.lineTo(-neckHalfW, neckTopY);
  c.closePath();
  c.fillStyle = glassGrad;
  c.fill();
  c.strokeStyle = 'rgba(180, 230, 140, 0.45)';
  c.lineWidth = 1;
  c.stroke();

  // cap
  const capGrad = c.createLinearGradient(-capHalfW, 0, capHalfW, 0);
  capGrad.addColorStop(0, '#8a6a1e');
  capGrad.addColorStop(0.3, '#e8c04a');
  capGrad.addColorStop(0.5, '#fff3c0');
  capGrad.addColorStop(0.7, '#e8c04a');
  capGrad.addColorStop(1, '#7a5a16');
  roundRect(c, -capHalfW, capTopY, capHalfW * 2, neckTopY - capTopY + 6, 3);
  c.fillStyle = capGrad;
  c.fill();
  c.strokeStyle = 'rgba(255,240,180,0.5)';
  c.lineWidth = 0.8;
  c.stroke();
  c.strokeStyle = 'rgba(90,65,10,0.4)';
  c.lineWidth = 0.6;
  for (let i = -capHalfW + 2; i < capHalfW; i += 3) {
    c.beginPath();
    c.moveTo(i, capTopY + 2);
    c.lineTo(i, neckTopY + 4);
    c.stroke();
  }

  c.restore(); // end shadow group

  // glass highlight streak
  const shineGrad = c.createLinearGradient(-bodyHalfW + 3, 0, -bodyHalfW + 11, 0);
  shineGrad.addColorStop(0, 'rgba(255,255,255,0)');
  shineGrad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(c, -bodyHalfW + 3, bodyTopY + 4, 7, bodyBottomY - bodyTopY - 8, 3);
  c.fillStyle = shineGrad;
  c.fill();

  // small decorative bubbles near the shoulder
  c.fillStyle = 'rgba(210, 240, 160, 0.55)';
  c.beginPath();
  c.arc(bodyHalfW - 6, bodyTopY + 10, 3.2, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(bodyHalfW - 12, bodyTopY + 4, 1.8, 0, Math.PI * 2);
  c.fill();

  // label
  const labelW = bodyHalfW * 1.7;
  const labelH = 46;
  const labelY = bodyTopY + 14;
  roundRect(c, -labelW / 2, labelY, labelW, labelH, 4);
  c.fillStyle = '#f8f3dc';
  c.fill();
  c.strokeStyle = '#8a5a1e';
  c.lineWidth = 1.2;
  c.stroke();

  drawStar(c, 0, labelY + 10, 5, 2, '#b5451f');

  c.fillStyle = '#7a3a12';
  c.font = '700 6.5px Rajdhani, sans-serif';
  c.textAlign = 'center';
  c.fillText('CASINO', 0, labelY + 24);
  c.fillText('EDITION', 0, labelY + 32);

  c.strokeStyle = 'rgba(122,58,18,0.4)';
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(-labelW / 2 + 5, labelY + 36);
  c.lineTo(labelW / 2 - 5, labelY + 36);
  c.stroke();

  c.fillStyle = '#5a4126';
  c.font = '600 4px Rajdhani, sans-serif';
  c.fillText('SPIN TO WIN', 0, labelY + 41);

  // bottom contact shadow
  c.beginPath();
  c.ellipse(0, bottomTipY - 4, bodyHalfW - 3, 4, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(6, 40, 12, 0.5)';
  c.fill();

  c.restore();

  // spin pivot marker
  c.beginPath();
  c.arc(CX, CY, 5, 0, Math.PI * 2);
  c.fillStyle = '#ffd700';
  c.fill();
  c.beginPath();
  c.arc(CX, CY, 2.5, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function formatCedi(n: number): string {
  return `₵${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatLocal(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function SpinDaBottleGame({ onExit }: { onExit: () => void }) {
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const authed = !!user;

  // ── Wallet — local state, fed by the real GET /api/wallet endpoint ──
  const [balance, setBalance] = useState(0);
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);

  const refreshWallet = useCallback(async () => {
    if (!authed) {
      setWalletLoaded(true);
      return;
    }
    try {
      const res = await api.wallet.getWallet();
      const bal = res?.data?.balance;
      if (typeof bal === 'number') setBalance(bal);
    } catch (e: any) {
      if (e instanceof Error && /session/i.test(e.message)) {
        logout();
      }
    } finally {
      setWalletLoaded(true);
    }
  }, [authed, logout]);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  /* ── Currency: registered country, no lookup, no FX ─────────────────
     `toLocal` and `showLocalConversion` are retained so the JSX below needs
     no restructuring — they now resolve to "no secondary line", which is
     correct: the primary figure is already local. */
  const { country, fmt: fmtMoney } = useCountry();
  void fmtMoney; // available for any figure that needs the symbol inline
  const geo: GeoInfo = useMemo(
    () => ({
      countryCode: country.code,
      countryName: country.name,
      currencyCode: country.currency,
    }),
    [country],
  );
  const geoLoading = false;
  const localCurrencyCode: string | null = null;
  const toLocal = useCallback((_amount: number): number | null => null, []);
  const showLocalConversion = false;

  // ── Round state ─────────────────────────────────────────────────────
  const [choice, setChoice] = useState<Choice | null>(null);
  const [betAmount, setBetAmount] = useState(MIN_BET);
  const [phase, setPhase] = useState<Phase>('WAITING');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECS);
  const [result, setResult] = useState<{ text: string; kind: 'win' | 'lose' | 'house' | 'error' } | null>(null);
  const [history, setHistory] = useState<Outcome[]>([]);
  const [fairness, setFairness] = useState<SpinResult['fairness'] | null>(null);
  const [revealedOutcome, setRevealedOutcome] = useState<Outcome | null>(null);
  const [fairnessOpen, setFairnessOpen] = useState(false);
  const [bystanders, setBystanders] = useState<BystanderResult[]>([]);
  const [flash, setFlash] = useState<'win' | 'lose' | 'house' | null>(null);
  // `highlightZone`: mirrors the zone currently highlighted on the wheel.
  // Consumed by the aria-live region below so screen-reader users get the
  // round result announced, not just sighted users watching the canvas.
  const [highlightZone, setHighlightZone] = useState<Outcome | null>(null);
  // `lastSpin`: the most recently settled round's numbers. Consumed by
  // the "Last round" row in the fairness modal.
  const [lastSpin, setLastSpin] = useState<{ won: boolean; outcome: Outcome; stake: number; payout: number } | null>(null);

  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // ── Canvas ──────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bystanderIdRef = useRef(0);

  // ── Re-entrancy lock for startSpin ──────────────────────────────────
  // This is checked and set SYNCHRONOUSLY, before any `await`, unlike the
  // `phase !== 'WAITING'` guard further down. `phase` is React state, so
  // updates from a rapid second invocation (double-click, a duplicate
  // event binding, anything that calls startSpin again before the first
  // `setPhase('PLACING')` has actually committed and re-rendered) can
  // still see the stale 'WAITING' value and slip through. A plain ref
  // has no such lag — the very next synchronous call sees the flag
  // already set and bails out immediately, before it ever reaches the
  // network call or a second parseSpinResult().
  const spinInFlightRef = useRef(false);

  const redraw = useCallback((zone: Outcome | null) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawTable(ctx, zone);
    drawBottle(ctx, angleRef.current);
  }, []);

  useEffect(() => {
    redraw(null);
  }, [redraw]);

  useEffect(() => {
    if (phase !== 'WAITING') return;
    setCountdown(COUNTDOWN_SECS);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [phase]);

  const clampBet = useCallback(
    (v: number) => Math.max(MIN_BET, Math.min(Math.floor(v), Math.max(MIN_BET, balanceRef.current))),
    []
  );

  const adjustBetPreset = (amt: 'half' | 'max' | number) => {
    if (amt === 'half') setBetAmount(clampBet(balanceRef.current / 2));
    else if (amt === 'max') setBetAmount(clampBet(balanceRef.current));
    else setBetAmount(clampBet(amt));
  };

  const selectChoice = (c: Choice) => {
    if (phase !== 'WAITING') return;
    setChoice(c);
    setResult(null);
    setHighlightZone(null);
  };

  const spawnBystanders = useCallback((outcome: Outcome) => {
    const rolled: BystanderResult[] = BYSTANDER_NAMES.map((name) => {
      const r = Math.random();
      const guess: Choice = r < 0.65 ? (outcome === 'DOWN' ? 'DOWN' : 'UP') : Math.random() < 0.5 ? 'UP' : 'DOWN';
      const amount = Math.floor(Math.random() * 200 + 10);
      const won = outcome !== 'MIDDLE' && guess === outcome;
      return { id: ++bystanderIdRef.current, name, guess, amount: won ? amount * 2 : amount, won };
    });
    rolled.slice(0, 6).forEach((b, i) => {
      setTimeout(() => {
        setBystanders((prev) => [b, ...prev].slice(0, 5));
        setTimeout(() => setBystanders((prev) => prev.filter((x) => x.id !== b.id)), 3200);
      }, 350 + i * 260);
    });
  }, []);

  const startSpin = useCallback(async () => {
    // Synchronous lock — must be the very first thing that runs, before
    // any other guard or await. See spinInFlightRef comment above.
    if (spinInFlightRef.current) return;
    if (phase !== 'WAITING' || !choice) return;
    if (!authed) {
      setResult({ text: 'SIGN IN TO PLACE BETS', kind: 'error' });
      return;
    }
    const bet = clampBet(betAmount);
    if (bet < MIN_BET) {
      setResult({ text: `MINIMUM BET IS ${formatCedi(MIN_BET)}`, kind: 'error' });
      return;
    }
    if (bet > balanceRef.current) return;

    const authToken = getAuthTokenForSpin();
    if (!authToken) {
      setResult({ text: 'SESSION EXPIRED — PLEASE SIGN IN AGAIN', kind: 'error' });
      logout();
      return;
    }

    spinInFlightRef.current = true;

    setPhase('PLACING');
    setResult(null);
    setHighlightZone(null);
    setRevealedOutcome(null);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    let spun: SpinResult;
    let stakeUsed = bet;
    let payoutReceived = 0;
    try {
      // Direct fetch call — see playRound() above. Does not go through
      // api.ts / api.games.play() at all; only api.wallet.getWallet()
      // (in refreshWallet below) still uses the shared api.ts client.
      const round = await playRound({ choice, stake: bet }, authToken);
      // outcome/won/fairness are TOP-LEVEL on `round` — pass it straight
      // through, no cast needed since parseSpinResult takes `unknown`.
      // parseSpinResult THROWS on bad/missing data instead of quietly
      // defaulting to MIDDLE — caught below, treated as an error, and
      // never shown to the player as a fabricated round outcome.
      spun = parseSpinResult(round, 'startSpin');
      stakeUsed = round?.stake ?? bet;
      payoutReceived = round?.payout ?? 0;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      setResult({ text: message.toUpperCase(), kind: 'error' });
      setPhase('WAITING');
      spinInFlightRef.current = false;
      // The stake may have already been debited server-side even though
      // we failed to parse the response (e.g. the round genuinely
      // succeeded but the body was unreadable client-side) — refresh so
      // the displayed balance never drifts from what the server actually
      // holds.
      refreshWallet();
      if (message.toLowerCase().includes('session')) logout();
      return;
    }

    setFairness(spun.fairness ?? null);
    setPhase('SPINNING');

    const targetAngle = getTargetAngle(spun.outcome);
    const duration = MIN_SPIN_MS + Math.random() * (MAX_SPIN_MS - MIN_SPIN_MS);
    const spin = createSpin(angleRef.current, targetAngle, duration);

    spawnBystanders(spun.outcome);
    setLastSpin({ won: spun.won, outcome: spun.outcome, stake: stakeUsed, payout: payoutReceived });

    const loop = (ts: number) => {
      const { angle, done } = evaluateSpin(spin, ts);
      angleRef.current = angle;
      redraw(null);
      if (done) {
        settleRound(spun, stakeUsed, payoutReceived);
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [phase, choice, betAmount, authed, clampBet, redraw, spawnBystanders, logout, refreshWallet]);

  const settleRound = useCallback(
    (spun: SpinResult, stake: number, payout: number) => {
      const { outcome, won } = spun;

      setPhase('RESULT');
      setHighlightZone(outcome);
      redraw(outcome);
      setRevealedOutcome(outcome);
      setHistory((h) => [outcome, ...h].slice(0, 15));

      refreshWallet();

      if (won) {
        setWins((w) => w + 1);
        setStreak((s) => s + 1);
        setFlash('win');
        setResult({ text: `${outcome === 'UP' ? '▲' : '▼'} ${outcome} WINS  +${formatCedi(payout)}`, kind: 'win' });
      } else if (outcome === 'MIDDLE') {
        setLosses((l) => l + 1);
        setStreak(0);
        setFlash('house');
        setResult({ text: '⚡ MIDDLE — HOUSE WINS', kind: 'house' });
      } else {
        setLosses((l) => l + 1);
        setStreak(0);
        setFlash('lose');
        setResult({ text: `${outcome === 'UP' ? '▲ UP' : '▼ DOWN'} — YOU LOSE  -${formatCedi(stake)}`, kind: 'lose' });
      }

      setTimeout(() => setFlash(null), 700);

      setTimeout(() => {
        setChoice(null);
        setResult(null);
        setHighlightZone(null);
        redraw(null);
        setPhase('WAITING');
        // Release the lock only once the round is fully settled and the
        // UI is back to WAITING — not right after the API call returns.
        // This keeps the lock held for the full spin animation too, so a
        // stray extra click mid-animation can't sneak a second request in.
        spinInFlightRef.current = false;
      }, 3000);
    },
    [redraw, refreshWallet]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const canSpin = authed && phase === 'WAITING' && !!choice && betAmount >= MIN_BET && betAmount <= balance;
  const isBusy = phase === 'PLACING' || phase === 'SPINNING';
  // Kept only to satisfy the (now permanently false) conversion branches below.
  const localSymbol: string | null = localCurrencyCode ? country.symbol : null;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col items-center"
      style={{ backgroundColor: '#06080d', color: '#e8e8e8', border: '1px solid rgba(255,215,0,0.15)', minHeight: '640px' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes sdb-flash-win   { 0% { opacity: 0; background: radial-gradient(circle, rgba(0,255,120,0.35), transparent 70%);} 30% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes sdb-flash-lose  { 0% { opacity: 0; background: radial-gradient(circle, rgba(255,50,50,0.4), transparent 70%);} 30% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes sdb-flash-house { 0% { opacity: 0; background: radial-gradient(circle, rgba(255,149,0,0.35), transparent 70%);} 30% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes sdb-pill-in { from { transform: scale(0.4) rotate(-20deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .sdb-flash, .sdb-pill { animation: none !important; } }
      `}</style>

      {/* Header */}
      <div
        className="w-full flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ backgroundColor: '#0d1117', borderBottom: '1px solid rgba(255,215,0,0.15)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-black truncate" style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em', color: '#ffd700' }}>
            SPIN DA' BOTTLE
          </span>
          {phase === 'SPINNING' && (
            <span
              className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: 'rgba(255,215,0,0.12)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.35)' }}
            >
              <FiberManualRecordIcon sx={{ fontSize: 9 }} />
              SPINNING
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[9px]" style={{ color: '#888' }}>
              BALANCE
            </span>
            <span className="font-mono font-semibold text-sm" style={{ color: '#ffd700' }}>
              {walletLoaded ? formatCedi(balance) : '—'}
            </span>
            {showLocalConversion && walletLoaded && toLocal(balance) !== null && (
              <span className="text-[9px] font-mono" style={{ color: '#666' }}>
                ≈ {localSymbol}{formatLocal(toLocal(balance) as number)}
              </span>
            )}
          </div>
          <button
            onClick={onExit}
            aria-label="Back to lobby"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: '#1C1C1C', border: '1px solid #2A2A2A', color: '#fff' }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
            <span className="hidden sm:inline">Back to lobby</span>
          </button>
        </div>
      </div>

      {!authed && (
        <div
          className="w-full text-center text-xs py-2 px-3"
          style={{ backgroundColor: 'rgba(255,60,60,0.08)', color: '#ff8080', borderBottom: '1px solid rgba(255,60,60,0.2)' }}
        >
          <Link to="/login" style={{ color: '#ff8080', fontWeight: 700, textDecoration: 'underline' }}>
            Sign in
          </Link>{' '}
          to place real bets. You can still watch the table.
        </div>
      )}

      {/* Geo / currency strip */}
      <div className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1.5" style={{ color: '#666', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <PublicIcon sx={{ fontSize: 12 }} />
        {geoLoading ? (
          <span>Detecting your region…</span>
        ) : (
          <span>
            {geo?.countryName ?? 'Unknown region'}
            {showLocalConversion && ` · displayed in ${geo?.currencyCode}`}
          </span>
        )}
      </div>

      {/* Balance / stats strip */}
      <div className="flex items-center gap-0 mx-3 mt-3 mb-1 rounded-full px-4 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
        <div className="flex flex-col items-center px-4">
          <span className="text-[9px] tracking-widest" style={{ color: '#666' }}>WINS</span>
          <span className="text-sm font-bold" style={{ color: '#00e07a' }}>{wins}</span>
        </div>
        <div className="w-px h-6" style={{ backgroundColor: 'rgba(255,215,0,0.15)' }} />
        <div className="flex flex-col items-center px-4">
          <span className="text-[9px] tracking-widest" style={{ color: '#666' }}>LOSSES</span>
          <span className="text-sm font-bold" style={{ color: '#ff3c3c' }}>{losses}</span>
        </div>
        <div className="w-px h-6" style={{ backgroundColor: 'rgba(255,215,0,0.15)' }} />
        <div className="flex flex-col items-center px-4">
          <span className="text-[9px] tracking-widest" style={{ color: '#666' }}>STREAK</span>
          <span className="text-sm font-bold" style={{ color: '#ff9500' }}>{streak >= 2 ? `🔥 ×${streak}` : '—'}</span>
        </div>
      </div>

      {/* Table + bottle */}
      <div className="relative mt-2" style={{ width: 320, height: 320, maxWidth: '90vw' }}>
        <canvas ref={canvasRef} width={320} height={320} className="block rounded-full" style={{ width: '100%', height: '100%' }} />
        {flash && (
          <div
            className="sdb-flash absolute inset-0 rounded-full pointer-events-none"
            style={{ animation: `sdb-flash-${flash} 0.7s ease-out forwards` }}
          />
        )}
      </div>

      {/* Screen-reader announcement of the round result — mirrors highlightZone so
          non-sighted users get the outcome without having to parse the canvas. */}
      <div aria-live="polite" className="sr-only">
        {highlightZone ? `Round result: ${highlightZone}` : ''}
      </div>

      {/* Result banner */}
      <div className="h-8 flex items-center justify-center mt-1">
        {result && (
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={{
              color: result.kind === 'win' ? '#00e07a' : result.kind === 'lose' ? '#ff3c3c' : result.kind === 'error' ? '#ff8080' : '#ff9500',
              textShadow: `0 0 20px ${result.kind === 'win' ? 'rgba(0,224,122,0.5)' : result.kind === 'lose' ? 'rgba(255,60,60,0.5)' : 'rgba(255,149,0,0.5)'}`,
            }}
          >
            {result.text}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="w-full px-4 flex flex-col gap-3 mt-1" style={{ maxWidth: 380 }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-widest flex-shrink-0" style={{ color: '#666' }}>BET</span>
          <div className="flex items-center flex-1 rounded-md overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.3)' }}>
            <span className="px-2 font-bold" style={{ color: '#ffd700', borderRight: '1px solid rgba(255,215,0,0.15)' }}>₵</span>
            <input
              type="number"
              min={MIN_BET}
              disabled={phase !== 'WAITING' || !authed}
              value={betAmount}
              onChange={(e) => setBetAmount(clampBet(parseFloat(e.target.value) || 0))}
              className="flex-1 min-w-0 bg-transparent outline-none text-right py-1.5 px-2 font-bold disabled:opacity-50"
              style={{ color: '#ffd700' }}
            />
          </div>
        </div>
        {showLocalConversion && toLocal(betAmount) !== null && (
          <div className="text-[10px] text-right -mt-2" style={{ color: '#555' }}>
            ≈ {localSymbol}{formatLocal(toLocal(betAmount) as number)}
          </div>
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {BET_PRESETS.map((amt) => (
            <button
              key={amt}
              disabled={phase !== 'WAITING' || !authed}
              onClick={() => adjustBetPreset(amt)}
              className="py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}
            >
              {country.symbol}{amt}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            disabled={phase !== 'WAITING' || !authed}
            onClick={() => adjustBetPreset('half')}
            className="py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}
          >
            ½ BAL
          </button>
          <button
            disabled={phase !== 'WAITING' || !authed}
            onClick={() => adjustBetPreset('max')}
            className="py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}
          >
            MAX
          </button>
        </div>

        <div className="flex gap-2.5">
          <button
            disabled={phase !== 'WAITING' || !authed}
            onClick={() => selectChoice('UP')}
            className="flex-1 flex flex-col items-center gap-0.5 py-3.5 rounded-lg border-2 disabled:opacity-50"
            style={{
              backgroundColor: choice === 'UP' ? 'rgba(0,220,120,0.22)' : 'rgba(0,220,120,0.1)',
              borderColor: choice === 'UP' ? '#00e07a' : 'rgba(0,220,120,0.3)',
              boxShadow: choice === 'UP' ? '0 0 20px rgba(0,220,120,0.25)' : 'none',
              color: '#00e07a',
            }}
          >
            <span className="text-xl leading-none">▲</span>
            <span className="text-base font-bold tracking-wide">UP</span>
            <span className="text-[10px] opacity-60">pays 2×</span>
          </button>
          <button
            disabled={phase !== 'WAITING' || !authed}
            onClick={() => selectChoice('DOWN')}
            className="flex-1 flex flex-col items-center gap-0.5 py-3.5 rounded-lg border-2 disabled:opacity-50"
            style={{
              backgroundColor: choice === 'DOWN' ? 'rgba(255,60,60,0.22)' : 'rgba(255,60,60,0.1)',
              borderColor: choice === 'DOWN' ? '#ff3c3c' : 'rgba(255,60,60,0.3)',
              boxShadow: choice === 'DOWN' ? '0 0 20px rgba(255,60,60,0.25)' : 'none',
              color: '#ff3c3c',
            }}
          >
            <span className="text-xl leading-none">▼</span>
            <span className="text-base font-bold tracking-wide">DOWN</span>
            <span className="text-[10px] opacity-60">pays 2×</span>
          </button>
        </div>

        <button
          onClick={startSpin}
          disabled={!canSpin}
          className="py-3.5 rounded-lg font-extrabold text-sm uppercase tracking-[3px] disabled:opacity-50"
          style={{
            background: canSpin ? 'linear-gradient(135deg, #c8960c 0%, #ffd700 45%, #e8a800 100%)' : 'linear-gradient(135deg, #3a3520, #4a4228)',
            color: canSpin ? '#000' : '#666',
            boxShadow: canSpin ? '0 4px 24px rgba(255,200,0,0.3)' : 'none',
          }}
        >
          {phase === 'PLACING'
            ? 'PLACING BET…'
            : phase === 'SPINNING'
            ? 'SPINNING…'
            : phase === 'RESULT'
            ? 'NEXT ROUND STARTING…'
            : !authed
            ? 'SIGN IN TO PLAY'
            : !choice
            ? 'SELECT UP OR DOWN'
            : `SPIN — ${choice}`}
        </button>
        {phase === 'WAITING' && !isBusy && authed && (
          <div className="text-center text-[10px]" style={{ color: '#555' }}>
            {choice ? `Kicks off automatically once you spin` : `Round refreshes in ${countdown}s · min bet ${formatCedi(MIN_BET)}`}
          </div>
        )}

        <button
          onClick={() => setFairnessOpen(true)}
          className="flex items-center justify-center gap-1 text-[10px] py-1"
          style={{ color: '#666' }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 12 }} />
          Round fairness details
        </button>
      </div>

      {/* History pills */}
      <div className="w-full px-4 mt-1 mb-3" style={{ maxWidth: 380 }}>
        <div className="text-[10px] tracking-widest mb-1.5" style={{ color: '#666' }}>
          RESULT HISTORY
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
          {history.length === 0 && <span className="text-xs italic" style={{ color: '#555' }}>No spins yet</span>}
          {history.map((o, i) => (
            <div
              key={i}
              className="sdb-pill w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold"
              style={{
                animation: 'sdb-pill-in 0.25s ease-out',
                backgroundColor: o === 'UP' ? 'rgba(0,224,122,0.15)' : o === 'DOWN' ? 'rgba(255,60,60,0.15)' : 'rgba(255,149,0,0.15)',
                border: `1px solid ${o === 'UP' ? 'rgba(0,224,122,0.4)' : o === 'DOWN' ? 'rgba(255,60,60,0.4)' : 'rgba(255,149,0,0.4)'}`,
                color: o === 'UP' ? '#00e07a' : o === 'DOWN' ? '#ff3c3c' : '#ff9500',
              }}
            >
              {o === 'UP' ? '▲' : o === 'DOWN' ? '▼' : 'M'}
            </div>
          ))}
        </div>
      </div>

      {bystanders.length > 0 && (
        <div className="w-full px-4 mb-3 flex flex-col gap-1" style={{ maxWidth: 380 }}>
          {bystanders.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: b.won ? '#00e07a' : '#888' }}
            >
              <EmojiEventsIcon sx={{ fontSize: 12 }} style={{ opacity: b.won ? 1 : 0.35 }} />
              {b.name} {b.guess === 'UP' ? '▲' : '▼'} {b.won ? `won ${formatCedi(b.amount)}` : `lost ${formatCedi(b.amount)}`}
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] tracking-wide text-center pb-3" style={{ color: '#333' }}>
        RTP ~97% · Middle zone = house wins · Play responsibly
      </div>

      {/* Fairness modal */}
      {fairnessOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setFairnessOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl p-4 w-full max-w-sm flex flex-col gap-2"
            style={{ backgroundColor: '#0d1117', border: '1px solid rgba(255,215,0,0.25)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold" style={{ color: '#ffd700' }}>Round fairness</span>
              <button onClick={() => setFairnessOpen(false)} aria-label="Close">
                <CloseIcon sx={{ fontSize: 16 }} style={{ color: '#888' }} />
              </button>
            </div>
            {fairness ? (
              <>
                <FairnessRow label="Server seed" value={fairness.serverSeed || '—'} />
                <FairnessRow label="Server seed hash" value={fairness.serverSeedHash || '—'} />
                <FairnessRow label="Client seed" value={fairness.clientSeed || '—'} />
                <FairnessRow label="Nonce" value={String(fairness.nonce ?? '—')} />
                <FairnessRow label="Result hash" value={fairness.resultHash || '—'} />
              </>
            ) : (
              <p className="text-[11px]" style={{ color: '#888' }}>
                No fairness data on the last round.
              </p>
            )}
            <FairnessRow label="Outcome" value={revealedOutcome ?? 'Revealed after spin'} />
            {lastSpin && (
              <>
                <FairnessRow label="Last stake" value={formatCedi(lastSpin.stake)} />
                <FairnessRow label="Last payout" value={formatCedi(lastSpin.payout)} />
                <FairnessRow label="Last result" value={lastSpin.won ? 'Won' : 'Lost'} />
              </>
            )}
            <p className="text-[10px] mt-1" style={{ color: '#555' }}>
              Each round is settled server-side before your balance changes — the outcome and payout come directly from the play() response.
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
      <span style={{ color: '#888' }}>{label}</span>
      <span className="font-mono truncate max-w-[220px]" style={{ color: '#ccc' }}>{value}</span>
    </div>
  );
}