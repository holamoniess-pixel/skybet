import { useState, useRef, useEffect, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import WhatshotIcon from '@mui/icons-material/Whatshot';

/* =========================================================================
   SPORTY KICK — self-contained demo rewrite
   ------------------------------------------------------------------------
   Built on the same pattern as SpinDaBottleGame / MinesGame:
     - Runs entirely client-side. No network calls, no auth gate, no real
       wallet — just an in-memory fictional demo balance, like the other
       in-lobby games.
     - The crash point is drawn locally with the Web Crypto API. A
       "provably fair" seed/hash is generated purely for show — there is
       no server here to verify anything against.
     - A lightweight live-feed + leaderboard simulate other players
       cashing out mid-round, the same flavor device used in Mines'
       "Vault Feed" and Spin da' Bottle's bystander ticker.
   Canvas animation, dual bet slots with auto-cashout, and the
   ResizeObserver-based canvas sizing are carried over from the original
   game.js, just re-expressed as React refs instead of globals.

   Update notes:
     - Layout is now responsive end-to-end: header, history bar, canvas,
       bet panel, and leaderboard all reflow for narrow / mobile widths
       instead of relying on a single sm: breakpoint jump.
     - The ball no longer shrinks as the multiplier climbs — it holds a
       constant on-screen size the whole round (only position/shake
       change), per request.
     - The ball icon itself was redrawn with an actual pentagon/seam
       pattern (rotating slowly) instead of five straight spokes, so it
       reads as a soccer ball rather than a plain dot.
   ========================================================================= */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STARTING_BALANCE = 1000;
const WAIT_MIN = 5000;
const WAIT_MAX = 8000;
const CRASH_MAX = 200;
const GROWTH_RATE = 0.00006; // exponential: e^(GROWTH_RATE * elapsed_ms)
const SHAKE_THRESHOLD = 0.8;
const MAX_HISTORY = 12;
const MAX_FEED_ITEMS = 5;
const FAKE_NAMES = ['Alex', 'Maria', 'John', 'Priya', 'Omar', 'Sophie', 'Chen', 'Kwame', 'Lena', 'Raj', 'Nia', 'Sam', 'Jin', 'Fati', 'Bruno'];
const AVATAR_COLORS = ['#7c4dff', '#00bcd4', '#e91e63', '#ff9500', '#4caf50', '#2196f3', '#ffb020', '#9c27b0'];

type Phase = 'WAITING' | 'RUNNING' | 'CRASHED';

interface Slot {
  amount: number;
  auto: string; // raw input string, parsed on demand
  active: boolean;
  cashedOut: boolean;
  winnings: number;
}

interface FairnessInfo {
  serverSeed: string;
  clientSeed: string;
  nonce: string;
  hash: string;
}

interface FeedItem {
  id: number;
  name: string;
  mult: number;
  amount: number;
}

interface LBItem {
  id: number;
  name: string;
  color: string;
  mult: number;
  profit: number;
}

// ---------------------------------------------------------------------------
// Fairness flavor — local only
// ---------------------------------------------------------------------------
function randomHex(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSHA256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function generateCrashPoint(): Promise<{ crash: number; info: FairnessInfo }> {
  const serverSeed = randomHex(16);
  const clientSeed = randomHex(8);
  const nonce = Math.floor(Math.random() * 100000);
  const hash = await hmacSHA256(serverSeed, clientSeed + nonce);
  const num = parseInt(hash.slice(0, 8), 16);
  const r = num / 0xffffffff;
  const crash = Math.max(1.0, Math.min(CRASH_MAX, Math.floor((1 / (1 - r * 0.99)) * 100) / 100));
  return { crash, info: { serverSeed, clientSeed, nonce: String(nonce), hash } };
}

function calcMultiplier(elapsedMs: number): number {
  return Math.max(1.0, Math.floor(Math.pow(Math.E, GROWTH_RATE * elapsedMs) * 100) / 100);
}

function pickName() { return FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]; }
function pickColor() { return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]; }
function initials(name: string) { return name.slice(0, 2).toUpperCase(); }

// ---------------------------------------------------------------------------
// Mutable animation state — kept in a ref, not React state, so the
// render loop doesn't fight React's reconciliation every frame.
// ---------------------------------------------------------------------------
interface AnimState {
  ballX: number;
  ballY: number;
  ballScale: number;
  ballSpin: number;
  shakeX: number;
  shakeY: number;
  cloudOffset: number;
  trailPoints: [number, number, number][];
  particles: { x: number; y: number; vx: number; vy: number; life: number; r: number; color: string }[];
  stars: { x: number; y: number; r: number; alpha: number; twinkle: number; speed: number }[];
}

function makeAnimState(): AnimState {
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.75,
    r: 0.5 + Math.random() * 1.2,
    alpha: 0.2 + Math.random() * 0.6,
    twinkle: Math.random() * Math.PI * 2,
    speed: 0.005 + Math.random() * 0.015,
  }));
  return { ballX: 0, ballY: 0, ballScale: 1, ballSpin: 0, shakeX: 0, shakeY: 0, cloudOffset: 0, trailPoints: [], particles: [], stars };
}

function spawnParticles(anim: AnimState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    anim.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, r: 2 + Math.random() * 3, color });
  }
}

// ---------------------------------------------------------------------------
// Soccer-ball icon renderer — a real pentagon/seam pattern instead of five
// straight spokes, drawn onto the canvas each frame with a slow spin.
// ---------------------------------------------------------------------------
function drawSoccerBall(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  r: number,
  spin: number,
  crashed: boolean,
  glowAlpha: number
) {
  // Soft outer glow while live
  if (!crashed && glowAlpha > 0) {
    ctx.save();
    ctx.shadowColor = '#00e676';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = `rgba(0,230,118,${glowAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Base sphere
  const ballGrad = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.05, bx, by, r);
  if (crashed) {
    ballGrad.addColorStop(0, '#ff9a6a');
    ballGrad.addColorStop(0.5, '#d2401a');
    ballGrad.addColorStop(1, '#5c0d00');
  } else {
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.55, '#e7e7ea');
    ballGrad.addColorStop(1, '#9a9aa2');
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();
  ctx.clip(); // keep every seam confined to the ball's silhouette

  const seamColor = crashed ? 'rgba(90,10,0,0.85)' : 'rgba(25,25,30,0.85)';
  const panelColor = crashed ? 'rgba(120,20,0,0.9)' : 'rgba(20,20,24,0.92)';

  // Central pentagon (classic truncated-icosahedron "front panel")
  const petals = 5;
  const centerR = r * 0.36;
  ctx.beginPath();
  for (let i = 0; i < petals; i++) {
    const a = spin + (i / petals) * Math.PI * 2 - Math.PI / 2;
    const px = bx + Math.cos(a) * centerR;
    const py = by + Math.sin(a) * centerR;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = panelColor;
  ctx.fill();

  // Seams radiating from each pentagon vertex to the ball's edge, with a
  // small dark wedge (adjacent panel) at the outer end of each seam.
  for (let i = 0; i < petals; i++) {
    const a = spin + (i / petals) * Math.PI * 2 - Math.PI / 2;
    const vx = bx + Math.cos(a) * centerR;
    const vy = by + Math.sin(a) * centerR;
    const ex = bx + Math.cos(a) * r * 0.92;
    const ey = by + Math.sin(a) * r * 0.92;

    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = seamColor;
    ctx.lineWidth = Math.max(1, r * 0.055);
    ctx.lineCap = 'round';
    ctx.stroke();

    // small outer panel wedge to suggest the surrounding pentagon ring
    const wedgeA1 = a - 0.34;
    const wedgeA2 = a + 0.34;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(wedgeA1) * r * 0.62, by + Math.sin(wedgeA1) * r * 0.62);
    ctx.lineTo(bx + Math.cos(a) * r * 0.98, by + Math.sin(a) * r * 0.98);
    ctx.lineTo(bx + Math.cos(wedgeA2) * r * 0.62, by + Math.sin(wedgeA2) * r * 0.62);
    ctx.closePath();
    ctx.fillStyle = panelColor;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Subtle sphere shading (darker toward the rim)
  const rim = ctx.createRadialGradient(bx, by, r * 0.6, bx, by, r);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, crashed ? 'rgba(60,0,0,0.35)' : 'rgba(0,0,0,0.22)');
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  ctx.restore(); // remove clip

  // Specular highlight
  const hiGrad = ctx.createRadialGradient(bx - r * 0.38, by - r * 0.38, 0, bx - r * 0.28, by - r * 0.28, r * 0.45);
  hiGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
  hiGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = hiGrad;
  ctx.fill();

  // Crisp outer rim line
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.strokeStyle = crashed ? 'rgba(90,10,0,0.5)' : 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SportyKickGame({ onExit }: { onExit: () => void }) {
  // Wallet (local demo — no backend)
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);
  const freeBetGivenRef = useRef(false);
  const balanceRef = useRef(balance);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  // Round / phase
  const [phase, setPhase] = useState<Phase>('WAITING');
  const phaseRef = useRef<Phase>('WAITING');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const [multiplierLabel, setMultiplierLabel] = useState('1.00×');
  const [statusLabel, setStatusLabel] = useState('Waiting for round…');
  const [history, setHistory] = useState<number[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LBItem[]>([]);
  const [fairness, setFairness] = useState<FairnessInfo>({ serverSeed: '', clientSeed: '', nonce: '', hash: '' });
  const [revealedSeed, setRevealedSeed] = useState('');
  const [fairnessOpen, setFairnessOpen] = useState(false);
  const [crashFlash, setCrashFlash] = useState(false);

  const [slots, setSlots] = useState<Slot[]>([
    { amount: 10, auto: '', active: false, cashedOut: false, winnings: 0 },
    { amount: 5, auto: '', active: false, cashedOut: false, winnings: 0 },
  ]);
  const slotsRef = useRef(slots);
  useEffect(() => { slotsRef.current = slots; }, [slots]);

  const crashPointRef = useRef(2.0);
  const multiplierRef = useRef(1.0);
  const waitStartRef = useRef(0);
  const waitDurationRef = useRef(6000);
  const roundStartRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<AnimState>(makeAnimState());
  const rafRef = useRef<number | null>(null);
  const fakeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const feedIdRef = useRef(0);
  const lbIdRef = useRef(0);

  const cancelFakeTimers = useCallback(() => {
    fakeTimersRef.current.forEach(clearTimeout);
    fakeTimersRef.current = [];
  }, []);

  // ── Cash out a single slot ────────────────────────────────────────────
  const cashout = useCallback((i: number) => {
    const slot = slotsRef.current[i];
    if (phaseRef.current !== 'RUNNING' || !slot.active || slot.cashedOut) return;
    const cashoutAt = parseFloat(multiplierRef.current.toFixed(2));
    const won = parseFloat((slot.amount * cashoutAt).toFixed(2));

    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, cashedOut: true, winnings: won } : s)));
    setBalance((b) => parseFloat((b + won).toFixed(2)));
    setWins((w) => w + 1);
    setStreak((s) => s + 1);

    const anim = animRef.current;
    spawnParticles(anim, anim.ballX, anim.ballY, '#00e676', 22);
  }, []);

  // ── Toggle bet (place / cancel) for a slot ────────────────────────────
  const toggleBet = useCallback(
    (i: number) => {
      if (phaseRef.current === 'RUNNING') { cashout(i); return; }
      if (phaseRef.current !== 'WAITING') return;

      setSlots((prev) => {
        const slot = prev[i];
        if (slot.active) {
          // Cancel — refund
          setBalance((b) => parseFloat((b + slot.amount).toFixed(2)));
          return prev.map((s, idx) => (idx === i ? { ...s, active: false } : s));
        }
        if (slot.amount <= 0 || slot.amount > balanceRef.current) return prev;
        setBalance((b) => parseFloat((b - slot.amount).toFixed(2)));
        return prev.map((s, idx) => (idx === i ? { ...s, active: true, cashedOut: false, winnings: 0 } : s));
      });
    },
    [cashout]
  );

  const setBetAmount = (i: number, val: number) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, amount: Math.max(1, Math.min(10000, val)) } : s)));
  };

  const setAuto = (i: number, val: string) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, auto: val } : s)));
  };

  const quickAdjust = (i: number, factor: number | 'max') => {
    setSlots((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        const next = factor === 'max' ? Math.min(balanceRef.current, 10000) : Math.max(1, parseFloat((s.amount * factor).toFixed(2)));
        return { ...s, amount: next };
      })
    );
  };

  // ── Fake players — cashouts + leaderboard while a round is running ───
  const scheduleFakeCashouts = useCallback(() => {
    setLeaderboard([]);
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const delay = 400 + Math.random() * 7000;
      const t = setTimeout(() => {
        if (phaseRef.current !== 'RUNNING') return;
        const name = pickName();
        const color = pickColor();
        const mult = Math.min(multiplierRef.current * (0.7 + Math.random() * 0.6), crashPointRef.current - 0.01);
        const bet = 5 + Math.random() * 200;
        const profit = bet * mult;

        const fItem: FeedItem = { id: ++feedIdRef.current, name, mult, amount: profit };
        setFeed((prev) => [fItem, ...prev].slice(0, MAX_FEED_ITEMS));
        setTimeout(() => setFeed((prev) => prev.filter((x) => x.id !== fItem.id)), 4000);

        setLeaderboard((prev) => [...prev, { id: ++lbIdRef.current, name, color, mult, profit }].slice(-8));
      }, delay);
      fakeTimersRef.current.push(t);
    }
  }, []);

  // ── Round state machine ───────────────────────────────────────────────
  const enterWaiting = useCallback(async () => {
    setPhase('WAITING');
    phaseRef.current = 'WAITING';
    multiplierRef.current = 1.0;
    setMultiplierLabel('1.00×');
    setRevealedSeed('');
    waitDurationRef.current = WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
    waitStartRef.current = performance.now();
    animRef.current.trailPoints = [];
    cancelFakeTimers();

    setSlots((prev) => prev.map((s) => ({ ...s, active: false, cashedOut: false, winnings: 0 })));

    const { crash, info } = await generateCrashPoint();
    crashPointRef.current = crash;
    setFairness(info);
  }, [cancelFakeTimers]);

  const enterRunning = useCallback(() => {
    setPhase('RUNNING');
    phaseRef.current = 'RUNNING';
    roundStartRef.current = performance.now();
    setStatusLabel('Round in progress');
    scheduleFakeCashouts();
  }, [scheduleFakeCashouts]);

  const enterCrashed = useCallback(() => {
    setPhase('CRASHED');
    phaseRef.current = 'CRASHED';
    multiplierRef.current = crashPointRef.current;
    setMultiplierLabel(crashPointRef.current.toFixed(2) + '×');
    setStatusLabel('Crashed at ' + crashPointRef.current.toFixed(2) + '×');
    setCrashFlash(true);
    setTimeout(() => setCrashFlash(false), 350);

    setHistory((h) => [parseFloat(crashPointRef.current.toFixed(2)), ...h].slice(0, MAX_HISTORY));
    setRevealedSeed(fairness.serverSeed);

    const anim = animRef.current;
    spawnParticles(anim, anim.ballX, anim.ballY, '#ff3d3d', 30);
    cancelFakeTimers();

    setSlots((prev) => {
      let anyLost = false;
      const next = prev.map((s) => {
        if (s.active && !s.cashedOut) { anyLost = true; return { ...s, active: false }; }
        return s;
      });
      if (anyLost) { setLosses((l) => l + 1); setStreak(0); }
      return next;
    });

    // Free-bet rescue, mirrors the other in-lobby demo games
    setTimeout(() => {
      setBalance((b) => {
        if (b < 10 && !freeBetGivenRef.current) {
          freeBetGivenRef.current = true;
          return parseFloat((b + 250).toFixed(2));
        }
        if (b >= 100) freeBetGivenRef.current = false;
        return b;
      });
    }, 800);

    setTimeout(() => { enterWaiting(); }, 3000);
  }, [cancelFakeTimers, enterWaiting, fairness.serverSeed]);

  // ── Canvas sizing (ResizeObserver — avoids feedback-loop growth) ─────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.offsetWidth || 400;
    const h = parent.offsetHeight || 320;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    resizeCanvas();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => resizeCanvas());
      ro.observe(canvas.parentElement);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // ── Draw helpers ──────────────────────────────────────────────────────
  const draw = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const anim = animRef.current;
    const W = canvas.width, H = canvas.height;

    // Background
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (phaseRef.current === 'CRASHED') { sky.addColorStop(0, '#1a0408'); sky.addColorStop(1, '#060005'); }
    else if (phaseRef.current === 'WAITING') { sky.addColorStop(0, '#060916'); sky.addColorStop(1, '#04060f'); }
    else { sky.addColorStop(0, '#030714'); sky.addColorStop(1, '#060a1f'); }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    anim.stars.forEach((s) => {
      s.twinkle += s.speed;
      const alpha = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Grid
    ctx.strokeStyle = 'rgba(0,180,100,0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

    // Ball position
    const groundY = H - 30;
    // Ball keeps a constant on-screen radius regardless of screen size / progress.
    const baseR = Math.max(14, Math.min(22, W * 0.045));

    if (phaseRef.current === 'WAITING') {
      anim.ballX = 60 + Math.sin(now * 0.001) * 8;
      anim.ballY = groundY - 4 + Math.abs(Math.sin(now * 0.003)) * -4;
      anim.ballScale = 1;
      anim.ballSpin += 0.01;
      anim.shakeX = 0; anim.shakeY = 0;
    } else if (phaseRef.current === 'RUNNING') {
      const elapsed = now - roundStartRef.current;
      multiplierRef.current = calcMultiplier(elapsed);
      setMultiplierLabel(multiplierRef.current.toFixed(2) + '×');

      // auto-cashout check
      slotsRef.current.forEach((s, i) => {
        const val = parseFloat(s.auto);
        if (val && val >= 1.01 && s.active && !s.cashedOut && multiplierRef.current >= val) cashout(i);
      });

      if (multiplierRef.current >= crashPointRef.current) {
        enterCrashed();
      }

      const prog = Math.min((multiplierRef.current - 1) / Math.max(crashPointRef.current - 1, 0.01), 1);
      anim.ballX = 60 + prog * (W * 0.78);
      anim.ballY = groundY - Math.pow(prog, 1.6) * (H * 0.8);
      // Size stays constant while flying — only spin conveys motion now.
      anim.ballScale = 1;
      anim.ballSpin += 0.05 + prog * 0.1;
      if (prog > SHAKE_THRESHOLD) {
        const intensity = ((prog - SHAKE_THRESHOLD) / (1 - SHAKE_THRESHOLD)) * 5;
        anim.shakeX = (Math.random() - 0.5) * intensity * 2;
        anim.shakeY = (Math.random() - 0.5) * intensity * 2;
      } else { anim.shakeX *= 0.75; anim.shakeY *= 0.75; }

      const last = anim.trailPoints[anim.trailPoints.length - 1];
      if (!last || Math.hypot(anim.ballX - last[0], anim.ballY - last[1]) > 8) {
        anim.trailPoints.push([anim.ballX, anim.ballY, anim.ballScale]);
      }
      if (anim.trailPoints.length > 60) anim.trailPoints.shift();
    } else {
      anim.shakeX = 0; anim.shakeY = 0;
    }

    // Trail
    if (phaseRef.current === 'RUNNING' && anim.trailPoints.length > 1) {
      for (let i = 1; i < anim.trailPoints.length; i++) {
        const alpha = (i / anim.trailPoints.length) * 0.5;
        const [x, y, sc] = anim.trailPoints[i];
        const [px, py] = anim.trailPoints[i - 1];
        ctx.strokeStyle = `rgba(0,230,118,${alpha})`;
        ctx.lineWidth = 3 * sc;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
    }

    // Ground
    const g = ctx.createLinearGradient(0, H - 24, 0, H);
    g.addColorStop(0, '#0a2a0f'); g.addColorStop(1, '#040d06');
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 24, W, 24);
    ctx.strokeStyle = 'rgba(0,200,60,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H - 24); ctx.lineTo(W, H - 24); ctx.stroke();

    // Ball (soccer ball) — constant radius, real pentagon/seam pattern
    const bx = anim.ballX + anim.shakeX;
    const by = anim.ballY + anim.shakeY;
    const r = baseR;

    const shadowAlpha = Math.max(0, 0.35 * (1 - (H - anim.ballY) / H));
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath(); ctx.ellipse(anim.ballX, H - 22, r * 2.2, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();

    drawSoccerBall(
      ctx,
      bx,
      by,
      r,
      anim.ballSpin,
      phaseRef.current === 'CRASHED',
      phaseRef.current === 'RUNNING' ? 0.3 : 0
    );

    // Particles
    anim.particles = anim.particles.filter((p) => p.life > 0);
    anim.particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.025;
    });
    ctx.globalAlpha = 1;
  }, [cashout, enterCrashed]);

  // ── Main loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = (now: number) => {
      if (phaseRef.current === 'WAITING') {
        const elapsed = now - waitStartRef.current;
        const remaining = Math.max(0, (waitDurationRef.current - elapsed) / 1000);
        setStatusLabel(remaining > 0 ? `Next round in ${remaining.toFixed(1)}s` : 'Starting…');
        if (elapsed >= waitDurationRef.current) enterRunning();
      }
      resizeCanvas();
      draw(now);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, enterRunning, resizeCanvas]);

  // ── Boot: seed history + start first waiting round ────────────────────
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    setHistory(Array.from({ length: 6 }, () => Math.round(Math.random() * 400 + 100) / 100));
    enterWaiting();
    return () => cancelFakeTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const multColor = phase === 'CRASHED' ? '#ff3d3d' : phase === 'RUNNING' ? '#00e676' : '#7a8299';

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: '#05070f', color: '#e8eaf0', border: '1px solid rgba(0,230,118,0.15)', minHeight: '560px' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap');
        @keyframes sk-crash-flash { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes sk-feed-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
        @keyframes sk-lb-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes sk-hist-in { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        @keyframes sk-cashout-pulse { from { box-shadow: 0 4px 16px rgba(255,149,0,0.25); } to { box-shadow: 0 4px 30px rgba(255,149,0,0.5); } }
        .sk-cashout-btn { animation: sk-cashout-pulse 0.7s infinite alternate; }
        @media (prefers-reduced-motion: reduce) { .sk-cashout-btn { animation: none; } }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-1 px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0" style={{ backgroundColor: '#080c1a', borderBottom: '1px solid rgba(0,230,118,0.15)' }}>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <SportsSoccerIcon sx={{ fontSize: { xs: 18, sm: 20 }, color: '#00e676' }} />
          <span className="text-xs sm:text-sm font-black truncate" style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em', color: '#e8eaf0' }}>
            SPORTY KICK
          </span>
          {phase === 'RUNNING' && (
            <span className="hidden xs:flex sm:flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold" style={{ backgroundColor: 'rgba(0,230,118,0.12)', color: '#00e676', border: '1px solid rgba(0,230,118,0.35)' }}>
              <FiberManualRecordIcon sx={{ fontSize: 9 }} />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[8px] sm:text-[9px]" style={{ color: '#7a8299' }}>BALANCE</span>
            <span className="font-mono font-semibold text-xs sm:text-sm" style={{ color: '#00e676' }}>${balance.toFixed(2)}</span>
          </div>
          <button onClick={onExit} aria-label="Back to lobby" className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold" style={{ backgroundColor: '#0d1226', border: '1px solid #1c2545', color: '#fff' }}>
            <CloseIcon sx={{ fontSize: 14 }} />
            <span className="hidden sm:inline">Back to lobby</span>
          </button>
        </div>
      </div>

      {/* History bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 overflow-x-auto flex-shrink-0" style={{ backgroundColor: '#080c1a', borderBottom: '1px solid rgba(0,230,118,0.1)' }}>
        <span className="text-[9px] sm:text-[10px] font-bold flex-shrink-0" style={{ color: '#3d4560', letterSpacing: '1.5px' }}>HISTORY</span>
        <div className="flex gap-1 sm:gap-1.5">
          {history.map((v, i) => (
            <span
              key={i}
              className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold font-mono flex-shrink-0"
              style={{
                animation: 'sk-hist-in 0.25s ease',
                backgroundColor: v < 1.8 ? 'rgba(255,61,61,0.15)' : v < 5 ? 'rgba(0,230,118,0.12)' : 'rgba(0,229,255,0.12)',
                color: v < 1.8 ? '#ff3d3d' : v < 5 ? '#00e676' : '#00e5ff',
                border: `1px solid ${v < 1.8 ? 'rgba(255,61,61,0.3)' : v < 5 ? 'rgba(0,230,118,0.25)' : 'rgba(0,229,255,0.25)'}`,
              }}
            >
              {v.toFixed(2)}×
            </span>
          ))}
        </div>
      </div>

      {/* Main: canvas + bet panel */}
      <div className="flex flex-col sm:flex-row flex-1">
        {/* Canvas */}
        <div className="relative flex-1 min-h-[200px] sm:min-h-[280px]" style={{ borderRight: '1px solid rgba(0,230,118,0.1)' }}>
          <canvas ref={canvasRef} className="block w-full h-full" style={{ display: 'block' }} />

          {/* Multiplier overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
            <div
              className="font-black leading-none"
              style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 'clamp(32px, 9vw, 56px)', letterSpacing: '-1px', color: multColor, textShadow: phase !== 'WAITING' ? `0 0 24px ${multColor}55` : 'none' }}
            >
              {multiplierLabel}
            </div>
            <div className="text-[10px] sm:text-xs font-medium mt-1 uppercase" style={{ color: '#7a8299', letterSpacing: '2px' }}>
              {statusLabel}
            </div>
          </div>

          {/* Live feed */}
          {feed.length > 0 && (
            <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex flex-col gap-1 sm:gap-1.5 pointer-events-none w-[110px] sm:w-[150px]">
              {feed.map((f) => (
                <div key={f.id} className="flex justify-between items-center rounded-lg px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium" style={{ animation: 'sk-feed-in 0.3s ease', backgroundColor: 'rgba(8,12,26,0.88)', border: '1px solid rgba(42,61,106,0.6)', backdropFilter: 'blur(6px)' }}>
                  <span style={{ color: '#7a8299' }}>{f.name}</span>
                  <span className="font-mono" style={{ color: '#00e676' }}>{f.mult.toFixed(2)}× ${f.amount.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Crash flash */}
          {crashFlash && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(255,0,0,0.3), transparent 70%)', animation: 'sk-crash-flash 0.35s ease forwards' }} />
          )}

          {/* Fairness chip */}
          <button
            onClick={() => setFairnessOpen(true)}
            className="absolute bottom-2 sm:bottom-2.5 left-2 sm:left-3 flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-mono px-1"
            style={{ color: '#3d4560' }}
          >
            <span className="px-1 py-0.5 rounded" style={{ backgroundColor: '#0d1226', border: '1px solid #1c2545', fontSize: 9, letterSpacing: '1px', color: '#7a8299' }}>HASH</span>
            {fairness.hash ? fairness.hash.slice(0, 10) + '…' : '—'}
          </button>
        </div>

        {/* Bet panel — two-up grid on mobile, side-by-side sidebar at sm+ */}
        <div className="grid grid-cols-2 sm:flex sm:flex-row sm:w-[280px] flex-shrink-0" style={{ backgroundColor: '#0d1226' }}>
          {slots.map((slot, i) => (
            <BetSlot
              key={i}
              index={i}
              slot={slot}
              phase={phase}
              balance={balance}
              onAmountChange={(v) => setBetAmount(i, v)}
              onAutoChange={(v) => setAuto(i, v)}
              onQuick={(f) => quickAdjust(i, f)}
              onToggle={() => toggleBet(i)}
              multiplier={multiplierRef.current}
              divider={i === 0}
            />
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0" style={{ backgroundColor: '#080c1a', borderTop: '1px solid rgba(0,230,118,0.1)' }}>
        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
          <EmojiEventsIcon sx={{ fontSize: 15, color: '#eab308' }} />
          <span className="text-[11px] sm:text-xs font-bold uppercase" style={{ color: '#7a8299', letterSpacing: '1px' }}>Live Players</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {leaderboard.length === 0 && <span className="text-xs italic" style={{ color: '#3d4560' }}>Waiting for cashouts…</span>}
          {leaderboard.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg flex-shrink-0" style={{ animation: 'sk-lb-in 0.3s ease', backgroundColor: '#0d1226', border: '1px solid #1c2545' }}>
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: p.color }}>
                {initials(p.name)}
              </div>
              <span className="text-[11px] sm:text-xs font-medium whitespace-nowrap" style={{ color: '#e8eaf0' }}>{p.name}</span>
              <span className="text-[11px] sm:text-xs font-mono font-semibold whitespace-nowrap" style={{ color: p.mult >= 5 ? '#00e5ff' : p.mult >= 2 ? '#00e676' : '#aaa' }}>{p.mult.toFixed(2)}×</span>
              <span className="text-[10px] sm:text-[11px] font-mono whitespace-nowrap" style={{ color: '#00e676' }}>+${p.profit.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {streak >= 2 && (
        <div className="px-2.5 sm:px-3 pb-2 flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold" style={{ color: '#f59e0b' }}>
          <WhatshotIcon sx={{ fontSize: 13 }} /> Win streak ×{streak} · {wins}W / {losses}L
        </div>
      )}

      {/* Fairness modal */}
      {fairnessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setFairnessOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-xl p-4 w-full max-w-sm flex flex-col gap-2" style={{ backgroundColor: '#0d1226', border: '1px solid rgba(0,230,118,0.25)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold" style={{ color: '#00e676' }}>Round fairness</span>
              <button onClick={() => setFairnessOpen(false)} aria-label="Close">
                <CloseIcon sx={{ fontSize: 16 }} style={{ color: '#7a8299' }} />
              </button>
            </div>
            <FairnessRow label="Server seed" value={revealedSeed ? revealedSeed : phase === 'CRASHED' ? fairness.serverSeed : 'Revealed after crash'} />
            <FairnessRow label="Client seed" value={fairness.clientSeed || '—'} />
            <FairnessRow label="Nonce" value={fairness.nonce || '—'} />
            <FairnessRow label="Hash" value={fairness.hash || '—'} />
            <FairnessRow label="Crash point" value={phase === 'CRASHED' ? crashPointRef.current.toFixed(2) + '×' : 'Revealed after round'} />
            <p className="text-[10px] mt-1" style={{ color: '#3d4560' }}>
              Demo game — this hash is generated locally each round for illustration and isn't checked against any server.
            </p>
          </div>
        </div>
      )}

      <div className="text-[9px] sm:text-[10px] tracking-wide text-center py-2 px-2" style={{ color: '#3d4560' }}>
        Demo crash game · odds get riskier the longer you ride · Play responsibly
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bet slot subcomponent
// ---------------------------------------------------------------------------
function BetSlot({
  index,
  slot,
  phase,
  balance,
  onAmountChange,
  onAutoChange,
  onQuick,
  onToggle,
  multiplier,
  divider,
}: {
  index: number;
  slot: Slot;
  phase: Phase;
  balance: number;
  onAmountChange: (v: number) => void;
  onAutoChange: (v: string) => void;
  onQuick: (f: number | 'max') => void;
  onToggle: () => void;
  multiplier: number;
  divider: boolean;
}) {
  const disabled = phase !== 'WAITING';
  let label = 'BET';
  let color: 'bet' | 'cancel' | 'cashout' | 'lost' = 'bet';
  let profitText = '';
  let profitColor = '#00e676';

  if (phase === 'WAITING') {
    label = slot.active ? 'CANCEL BET' : 'BET';
    color = slot.active ? 'cancel' : 'bet';
  } else if (phase === 'RUNNING') {
    if (slot.active && !slot.cashedOut) {
      label = 'CASH OUT'; color = 'cashout';
      profitText = '+$' + (slot.amount * multiplier).toFixed(2);
    } else if (slot.cashedOut) {
      label = '✓ $' + slot.winnings.toFixed(2); color = 'bet';
      profitText = '+$' + slot.winnings.toFixed(2);
    } else {
      label = 'BET (next round)'; color = 'bet';
    }
  } else {
    if (slot.active && !slot.cashedOut) {
      label = '✗ LOST'; color = 'lost';
      profitText = '-$' + slot.amount.toFixed(2); profitColor = '#ff3d3d';
    } else if (slot.cashedOut) {
      label = '✓ $' + slot.winnings.toFixed(2); color = 'bet';
      profitText = '+$' + slot.winnings.toFixed(2);
    } else {
      label = 'BET'; color = 'bet';
    }
  }

  const btnDisabled =
    (phase === 'WAITING' && !slot.active && (slot.amount <= 0 || slot.amount > balance)) ||
    (phase === 'RUNNING' && !(slot.active && !slot.cashedOut)) ||
    (phase === 'CRASHED');

  const btnStyle: Record<string, string> = {
    bet: 'linear-gradient(135deg,#00b25a,#00e676)',
    cancel: 'linear-gradient(135deg,#1e2a45,#263050)',
    cashout: 'linear-gradient(135deg,#cc7200,#ff9500)',
    lost: 'linear-gradient(135deg,#2d0e0e,#1a0808)',
  };
  const btnTextColor: Record<string, string> = { bet: '#002010', cancel: '#7a8299', cashout: '#fff', lost: '#ff3d3d' };

  return (
    <div
      className="flex-1 flex flex-col gap-2 sm:gap-2.5 p-2.5 sm:p-3.5 min-w-0"
      style={divider ? { borderRight: '1px solid #1c2545' } : undefined}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-xs font-bold uppercase truncate" style={{ color: '#7a8299', letterSpacing: '1px' }}>Bet {index + 1}</span>
        {profitText && <span className="text-[10px] sm:text-xs font-mono font-semibold truncate" style={{ color: profitColor }}>{profitText}</span>}
      </div>

      <div className="flex items-center rounded-lg overflow-hidden" style={{ backgroundColor: '#070b1a', border: '1px solid #1c2545' }}>
        <span className="px-1.5 sm:px-2 font-mono text-xs sm:text-sm" style={{ color: '#7a8299' }}>$</span>
        <input
          type="number"
          min={1}
          max={10000}
          disabled={disabled}
          value={slot.amount}
          onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
          className="flex-1 min-w-0 bg-transparent outline-none py-1.5 sm:py-2 pr-2 font-mono font-semibold text-xs sm:text-sm disabled:opacity-40"
          style={{ color: '#e8eaf0' }}
        />
      </div>

      <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
        <button disabled={disabled} onClick={() => onQuick(0.5)} className="py-1 sm:py-1.5 rounded-md text-[10px] sm:text-[11px] font-semibold disabled:opacity-40" style={{ backgroundColor: '#070b1a', border: '1px solid #1c2545', color: '#7a8299' }}>½</button>
        <button disabled={disabled} onClick={() => onQuick(2)} className="py-1 sm:py-1.5 rounded-md text-[10px] sm:text-[11px] font-semibold disabled:opacity-40" style={{ backgroundColor: '#070b1a', border: '1px solid #1c2545', color: '#7a8299' }}>2×</button>
        <button disabled={disabled} onClick={() => onQuick(5)} className="py-1 sm:py-1.5 rounded-md text-[10px] sm:text-[11px] font-semibold disabled:opacity-40" style={{ backgroundColor: '#070b1a', border: '1px solid #1c2545', color: '#7a8299' }}>5×</button>
        <button disabled={disabled} onClick={() => onQuick('max')} className="py-1 sm:py-1.5 rounded-md text-[10px] sm:text-[11px] font-semibold disabled:opacity-40" style={{ backgroundColor: '#070b1a', border: '1px solid #1c2545', color: '#7a8299' }}>MAX</button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5" style={{ backgroundColor: '#070b1a', border: '1px solid #1c2545' }}>
        <span className="text-[9px] sm:text-[11px] flex-1 truncate" style={{ color: '#7a8299' }}>Auto at</span>
        <input
          type="number"
          step={0.1}
          min={1.01}
          placeholder="off"
          disabled={disabled}
          value={slot.auto}
          onChange={(e) => onAutoChange(e.target.value)}
          className="w-10 sm:w-14 bg-transparent outline-none text-right font-mono text-[11px] sm:text-xs font-semibold disabled:opacity-40"
          style={{ color: '#00e5ff' }}
        />
        <span className="text-xs" style={{ color: '#3d4560' }}>×</span>
      </div>

      <button
        onClick={onToggle}
        disabled={btnDisabled}
        className={color === 'cashout' ? 'sk-cashout-btn' : undefined}
        style={{
          padding: '10px 8px', borderRadius: 10, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
          fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase',
          background: btnStyle[color], color: btnTextColor[color],
          opacity: btnDisabled ? 0.4 : 1, border: 'none', cursor: btnDisabled ? 'default' : 'pointer',
        }}
      >
        {label}
      </button>
    </div>
  );
}

function FairnessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span style={{ color: '#7a8299' }}>{label}</span>
      <span className="font-mono truncate max-w-[220px]" style={{ color: '#ccd' }}>{value}</span>
    </div>
  );
}