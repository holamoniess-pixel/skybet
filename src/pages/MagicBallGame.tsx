import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CasinoIcon from '@mui/icons-material/Casino';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

/* =========================================================================
   MAGIC BALL — self-contained demo rewrite
   ------------------------------------------------------------------------
   Built on the same pattern as SportyKickGame / MinesGame:
     - Runs entirely client-side. No network calls, no auth gate, no real
       wallet — just an in-memory fictional demo balance, like the other
       in-lobby games.
     - The winning number is drawn locally with Math.random(). A
       "provably fair" seed/hash is generated purely for show via the Web
       Crypto API — there is no server here to verify anything against.
     - Betting phase → drawing (flicker) phase → result phase, driven by
       React state instead of the original DOM/jQuery-style controller.
     - A lightweight canvas background (stars + soft glowing orbs) mirrors
       the original Background module and the twinkle-star treatment used
       in Sporty Kick.
   ========================================================================= */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STARTING_BALANCE = 1000;
const BET_MIN_MS = 15000;
const BET_MAX_MS = 21000;
const FLICKER_TICKS = 10;
const FLICKER_INTERVAL = 250;
const RESULT_DURATION = 4500;
const MAX_HISTORY = 10;
const STAKE_CHIPS = [5, 10, 25, 50, 100];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

type Phase = 'BETTING' | 'DRAWING' | 'RESULT';
type Color = 'red' | 'black';

interface Market {
  key: string;
  label: string;
  payout: number;
  match: (n: number) => boolean;
}

interface HistoryItem {
  num: number;
  color: Color;
}

interface BetResult {
  key: string;
  label: string;
  stake: number;
  won: boolean;
  payout: number;
  multiplier: number;
}

interface Announcement {
  type: 'win' | 'lose' | 'big-win';
  text: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  size: number;
  color: string;
  dur: number;
}

interface FairnessInfo {
  serverSeed: string;
  clientSeed: string;
  nonce: string;
  hash: string;
}

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------
function isRed(n: number) { return RED_NUMBERS.has(n); }
function colorOf(n: number): Color { return isRed(n) ? 'red' : 'black'; }

const BASE_MARKETS: Market[] = [
  { key: 'red', label: 'Red', payout: 1.95, match: (n) => isRed(n) },
  { key: 'black', label: 'Black', payout: 1.95, match: (n) => !isRed(n) },
  { key: 'odd', label: 'Odd', payout: 1.95, match: (n) => n % 2 !== 0 },
  { key: 'even', label: 'Even', payout: 1.95, match: (n) => n % 2 === 0 },
  { key: 'low', label: 'Low 1–18', payout: 1.95, match: (n) => n <= 18 },
  { key: 'high', label: 'High 19–36', payout: 1.95, match: (n) => n > 18 },
  { key: 'd1', label: '1–12', payout: 2.8, match: (n) => n <= 12 },
  { key: 'd2', label: '13–24', payout: 2.8, match: (n) => n > 12 && n <= 24 },
  { key: 'd3', label: '25–36', payout: 2.8, match: (n) => n > 24 },
];

const MARKETS: Record<string, Market> = (() => {
  const map: Record<string, Market> = {};
  BASE_MARKETS.forEach((m) => { map[m.key] = m; });
  for (let i = 1; i <= 36; i++) {
    map[`n${i}`] = { key: `n${i}`, label: `#${i}`, payout: 32, match: (n) => n === i };
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Fairness flavor — local only, same approach as SportyKickGame
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

async function generateRoundFairness(): Promise<FairnessInfo> {
  const serverSeed = randomHex(16);
  const clientSeed = randomHex(8);
  const nonce = Math.floor(Math.random() * 100000);
  const hash = await hmacSHA256(serverSeed, clientSeed + nonce);
  return { serverSeed, clientSeed, nonce: String(nonce), hash };
}

function spinNumber(): number {
  if (window.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return (arr[0] % 36) + 1;
  }
  return Math.floor(Math.random() * 36) + 1;
}

// ---------------------------------------------------------------------------
// Background canvas animation state — kept in a ref, not React state
// ---------------------------------------------------------------------------
interface Star { x: number; y: number; r: number; a: number; speed: number }
interface Orb { x: number; y: number; r: number; color: string; speed: number }
interface BgAnim { stars: Star[]; orbs: Orb[]; t: number }

function makeBgAnim(w: number, h: number): BgAnim {
  const stars: Star[] = Array.from({ length: 70 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.5 + Math.random() * 1.5,
    a: Math.random(),
    speed: 0.002 + Math.random() * 0.003,
  }));
  const orbs: Orb[] = [
    { x: w * 0.2, y: h * 0.3, r: 120, color: 'rgba(80,30,180,', speed: 0.008 },
    { x: w * 0.8, y: h * 0.7, r: 100, color: 'rgba(180,30,80,', speed: 0.006 },
    { x: w * 0.5, y: h * 0.5, r: 80, color: 'rgba(30,80,180,', speed: 0.01 },
  ];
  return { stars, orbs, t: 0 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MagicBallGame({ onExit }: { onExit: () => void }) {
  // Wallet (local demo — no backend)
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);
  const freeBetGivenRef = useRef(false);
  const balanceRef = useRef(balance);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  // Round / phase
  const [phase, setPhase] = useState<Phase>('BETTING');
  const phaseRef = useRef<Phase>('BETTING');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const [round, setRound] = useState(1);
  const [timerVal, setTimerVal] = useState(18);
  const [timerMax, setTimerMax] = useState(18);
  const timerIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [orbNumber, setOrbNumber] = useState<number | string>('?');
  const [orbColor, setOrbColor] = useState<Color | null>(null);
  const [machineState, setMachineState] = useState<'idle' | 'shaking' | 'glow-red' | 'glow-black' | 'glow-win'>('idle');
  const [slotNumber, setSlotNumber] = useState<number | string>('—');
  const [slotLit, setSlotLit] = useState(false);

  const [stake, setStake] = useState(10);
  const [activeStakeChip, setActiveStakeChip] = useState<number | null>(10);
  const [activeBets, setActiveBets] = useState<Record<string, number>>({});
  const activeBetsRef = useRef(activeBets);
  useEffect(() => { activeBetsRef.current = activeBets; }, [activeBets]);
  const savedBetsRef = useRef<Record<string, number> | null>(null);
  const [autoBet, setAutoBet] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [freq, setFreq] = useState<number[]>(() => Array(37).fill(0));
  const [resultChips, setResultChips] = useState<{ number: string; color: string; parity: string; range: string; dozen: string; colorClass: string }>({
    number: '?', color: '—', parity: '—', range: '—', dozen: '—', colorClass: '',
  });
  const [betFlashes, setBetFlashes] = useState<Record<string, 'win' | 'lose'>>({});
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fairness, setFairness] = useState<FairnessInfo>({ serverSeed: '', clientSeed: '', nonce: '', hash: '' });
  const [revealedSeed, setRevealedSeed] = useState('');
  const [fairnessOpen, setFairnessOpen] = useState(false);

  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const machineRef = useRef<HTMLDivElement | null>(null);

  const roundStartTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearAllTimeouts = useCallback(() => {
    roundStartTimeoutsRef.current.forEach(clearTimeout);
    roundStartTimeoutsRef.current = [];
  }, []);

  // ── Particle burst ─────────────────────────────────────────────────────
  const spawnParticles = useCallback((count: number, color: string) => {
    const machine = machineRef.current;
    const container = containerRef.current;
    if (!machine || !container) return;
    const mRect = machine.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const cx = mRect.left - cRect.left + mRect.width / 2;
    const cy = mRect.top - cRect.top + mRect.height / 2;

    const next: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 120;
      next.push({
        id: ++particleIdRef.current,
        x: cx,
        y: cy,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 60,
        size: 4 + Math.random() * 8,
        color,
        dur: 0.6 + Math.random() * 0.8,
      });
    }
    setParticles((prev) => [...prev, ...next]);
    const ids = next.map((p) => p.id);
    setTimeout(() => setParticles((prev) => prev.filter((p) => !ids.includes(p.id))), 1600);
  }, []);

  // ── Background canvas ──────────────────────────────────────────────────
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgAnimRef = useRef<BgAnim | null>(null);
  const bgRafRef = useRef<number | null>(null);

  const resizeBgCanvas = useCallback(() => {
    const canvas = bgCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const w = container.offsetWidth || 800;
    const h = container.offsetHeight || 600;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      bgAnimRef.current = makeBgAnim(w, h);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    resizeBgCanvas();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resizeBgCanvas());
      ro.observe(container);
    } else {
      window.addEventListener('resize', resizeBgCanvas);
    }

    const tick = () => {
      const canvas = bgCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      const anim = bgAnimRef.current;
      if (canvas && ctx && anim) {
        const W = canvas.width, H = canvas.height;
        anim.t += 0.01;
        ctx.clearRect(0, 0, W, H);
        anim.orbs.forEach((o) => {
          const x = o.x + Math.sin(anim.t * o.speed * 100) * 30;
          const y = o.y + Math.cos(anim.t * o.speed * 80) * 20;
          const g = ctx.createRadialGradient(x, y, 0, x, y, o.r);
          g.addColorStop(0, o.color + '0.06)');
          g.addColorStop(1, o.color + '0)');
          ctx.beginPath(); ctx.arc(x, y, o.r, 0, Math.PI * 2);
          ctx.fillStyle = g; ctx.fill();
        });
        anim.stars.forEach((s) => {
          s.a += s.speed;
          const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(s.a));
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,160,255,${alpha})`; ctx.fill();
        });
      }
      bgRafRef.current = requestAnimationFrame(tick);
    };
    bgRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (bgRafRef.current) cancelAnimationFrame(bgRafRef.current);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resizeBgCanvas);
    };
  }, [resizeBgCanvas]);

  // ── Betting ─────────────────────────────────────────────────────────────
  const toggleBet = useCallback(
    (key: string) => {
      if (phaseRef.current !== 'BETTING') return;
      setActiveBets((prev) => {
        if (prev[key] !== undefined) {
          // cancel — refund
          setBalance((b) => parseFloat((b + prev[key]).toFixed(2)));
          const next = { ...prev };
          delete next[key];
          return next;
        }
        if (stake <= 0 || stake > balanceRef.current) return prev;
        setBalance((b) => parseFloat((b - stake).toFixed(2)));
        return { ...prev, [key]: stake };
      });
    },
    [stake]
  );

  const clearAllBets = useCallback(() => {
    if (phaseRef.current !== 'BETTING') return;
    const total = Object.values(activeBetsRef.current).reduce((s, a) => s + a, 0);
    if (total > 0) setBalance((b) => parseFloat((b + total).toFixed(2)));
    setActiveBets({});
    savedBetsRef.current = null;
  }, []);

  const totalStakeOf = (bets: Record<string, number>) => Object.values(bets).reduce((s, a) => s + a, 0);

  // ── Result phase ───────────────────────────────────────────────────────
  const finishRound = useCallback(
    async (winNum: number, winColor: Color) => {
      setPhase('RESULT');
      phaseRef.current = 'RESULT';

      setFreq((prev) => {
        const next = [...prev];
        next[winNum] += 1;
        return next;
      });
      setHistory((h) => [{ num: winNum, color: winColor }, ...h].slice(0, MAX_HISTORY));

      setMachineState('idle');
      setOrbNumber(winNum);
      setOrbColor(winColor);
      setMachineState(winColor === 'red' ? 'glow-red' : 'glow-black');
      setSlotNumber(winNum);
      setSlotLit(true);

      const numBtn = document.getElementById('mb-numBtn-' + winNum);
      if (numBtn) {
        numBtn.classList.add('mb-result-highlight');
        setTimeout(() => numBtn.classList.remove('mb-result-highlight'), 1200);
      }

      const dozen = winNum <= 12 ? 'Dozen 1' : winNum <= 24 ? 'Dozen 2' : 'Dozen 3';
      setResultChips({
        number: `#${winNum}`,
        color: winColor === 'red' ? 'Red' : 'Black',
        parity: winNum % 2 === 0 ? 'Even' : 'Odd',
        range: winNum <= 18 ? 'Low' : 'High',
        dozen,
        colorClass: winColor,
      });

      // Evaluate bets
      const bets = { ...activeBetsRef.current };
      const totalStake = totalStakeOf(bets);
      const results: BetResult[] = [];
      let totalReturn = 0;
      const flashes: Record<string, 'win' | 'lose'> = {};
      Object.entries(bets).forEach(([key, betStake]) => {
        const market = MARKETS[key];
        const won = market.match(winNum);
        const payout = won ? parseFloat((betStake * market.payout).toFixed(2)) : 0;
        totalReturn += payout;
        results.push({ key, label: market.label, stake: betStake, won, payout, multiplier: market.payout });
        flashes[key] = won ? 'win' : 'lose';
      });
      setBetFlashes(flashes);
      setTimeout(() => setBetFlashes({}), 1000);

      savedBetsRef.current = bets;

      if (totalReturn > 0) {
        setBalance((b) => parseFloat((b + totalReturn).toFixed(2)));
      }

      const netGain = totalReturn - totalStake;
      if (totalStake > 0) {
        if (netGain >= 0) { setWins((w) => w + 1); setStreak((s) => s + 1); }
        else { setLosses((l) => l + 1); setStreak(0); }
      }

      const bigWin = results.some((r) => r.won && r.multiplier >= 32);
      if (bigWin) {
        spawnParticles(40, '#f0c040');
        setTimeout(() => spawnParticles(30, '#22ff88'), 300);
        setTimeout(() => spawnParticles(30, '#cc88ff'), 600);
        setMachineState('glow-win');
        setAnnouncement({ type: 'big-win', text: `JACKPOT! +$${totalReturn.toFixed(2)}` });
      } else if (totalReturn > 0) {
        spawnParticles(20, '#22ff88');
        setTimeout(() => spawnParticles(15, '#f0c040'), 200);
        setAnnouncement({ type: 'win', text: `WIN! +$${totalReturn.toFixed(2)}` });
      } else if (totalStake > 0) {
        if (machineRef.current) {
          machineRef.current.style.filter = 'brightness(0.6) saturate(0.3)';
          setTimeout(() => { if (machineRef.current) machineRef.current.style.filter = ''; }, 500);
        }
        setAnnouncement({ type: 'lose', text: 'NO WIN' });
      }
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = setTimeout(() => setAnnouncement(null), 3000);

      setRound((r) => r + 1);

      // Reveal seed (decorative)
      setRevealedSeed(fairness.serverSeed);

      // Free-bet rescue, mirrors other in-lobby demo games
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

      setActiveBets({});
      const t = setTimeout(() => startBettingPhase(), RESULT_DURATION);
      roundStartTimeoutsRef.current.push(t);
    },
    [fairness.serverSeed, spawnParticles]
  );

  // ── Drawing phase ──────────────────────────────────────────────────────
  const startDraw = useCallback(() => {
    if (timerIvRef.current) clearInterval(timerIvRef.current);
    setPhase('DRAWING');
    phaseRef.current = 'DRAWING';
    setMachineState('shaking');
    setOrbColor(null);
    setSlotNumber('—');
    setSlotLit(false);

    let tick = 0;
    const iv = setInterval(() => {
      setOrbNumber(spinNumber());
      tick++;
      if (tick >= FLICKER_TICKS) {
        clearInterval(iv);
        const winNum = spinNumber();
        const winColor = colorOf(winNum);
        setTimeout(() => finishRound(winNum, winColor), 200);
      }
    }, FLICKER_INTERVAL);
    roundStartTimeoutsRef.current.push(iv as unknown as ReturnType<typeof setTimeout>);
  }, [finishRound]);

  // ── Betting phase ──────────────────────────────────────────────────────
  const startBettingPhase = useCallback(async () => {
    clearAllTimeouts();
    setPhase('BETTING');
    phaseRef.current = 'BETTING';
    setMachineState('idle');
    setOrbNumber('?');
    setOrbColor(null);
    setSlotNumber('—');
    setSlotLit(false);
    setResultChips({ number: '?', color: '—', parity: '—', range: '—', dozen: '—', colorClass: '' });
    setRevealedSeed('');

    const max = BET_MIN_MS + Math.random() * (BET_MAX_MS - BET_MIN_MS);
    const maxSec = Math.round(max / 1000);
    setTimerMax(maxSec);
    setTimerVal(maxSec);

    generateRoundFairness().then(setFairness);

    // Re-place auto bets from previous round if enabled
    if (autoBet && savedBetsRef.current) {
      const bets = savedBetsRef.current;
      let deducted = 0;
      const applied: Record<string, number> = {};
      Object.entries(bets).forEach(([key, amt]) => {
        if (deducted + amt <= balanceRef.current) {
          applied[key] = amt;
          deducted += amt;
        }
      });
      if (deducted > 0) setBalance((b) => parseFloat((b - deducted).toFixed(2)));
      setActiveBets(applied);
    } else {
      setActiveBets({});
    }

    let val = maxSec;
    timerIvRef.current = setInterval(() => {
      val -= 1;
      setTimerVal(val);
      if (val <= 0) {
        if (timerIvRef.current) clearInterval(timerIvRef.current);
        startDraw();
      }
    }, 1000);
  }, [autoBet, clearAllTimeouts, startDraw]);

  const manualSpin = useCallback(() => {
    if (phaseRef.current !== 'BETTING') return;
    if (timerIvRef.current) clearInterval(timerIvRef.current);
    startDraw();
  }, [startDraw]);

  // ── Boot ────────────────────────────────────────────────────────────────
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    startBettingPhase();
    return () => {
      clearAllTimeouts();
      if (timerIvRef.current) clearInterval(timerIvRef.current);
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Hot / cold numbers ─────────────────────────────────────────────────
  const { hot, cold } = useMemo(() => {
    const entries = freq.map((count, n) => ({ n, count })).filter((e) => e.n >= 1 && e.n <= 36);
    const sorted = [...entries].sort((a, b) => b.count - a.count);
    const anyCounts = sorted.some((e) => e.count > 0);
    if (!anyCounts) return { hot: [] as number[], cold: [] as number[] };
    const hotList = sorted.slice(0, 4).map((e) => e.n);
    const coldList = sorted.slice(-4).reverse().map((e) => e.n);
    return { hot: hotList, cold: coldList };
  }, [freq]);

  const CIRC = 326.726;
  const timerFraction = timerVal / Math.max(timerMax, 1);
  const timerOffset = CIRC * (1 - timerFraction);
  const timerUrgent = timerVal <= 5;

  const bettingEnabled = phase === 'BETTING';
  const totalStake = totalStakeOf(activeBets);

  const machineGlowStyle = useMemo(() => {
    switch (machineState) {
      case 'shaking':
        return { boxShadow: '0 0 40px rgba(80,40,180,0.15), inset 0 0 60px rgba(0,0,0,0.6)', borderColor: 'rgba(100,70,200,0.3)' };
      case 'glow-red':
        return { boxShadow: '0 0 60px rgba(255,51,85,0.4), 0 0 120px rgba(255,51,85,0.15), inset 0 0 60px rgba(0,0,0,0.6)', borderColor: 'rgba(255,51,85,0.5)' };
      case 'glow-black':
        return { boxShadow: '0 0 40px rgba(100,100,160,0.3), inset 0 0 60px rgba(0,0,0,0.6)', borderColor: 'rgba(100,100,180,0.4)' };
      case 'glow-win':
        return { boxShadow: '0 0 80px rgba(34,255,136,0.4), 0 0 160px rgba(34,255,136,0.1), inset 0 0 60px rgba(0,0,0,0.6)', borderColor: 'rgba(34,255,136,0.5)' };
      default:
        return { boxShadow: '0 0 40px rgba(80,40,180,0.15), inset 0 0 60px rgba(0,0,0,0.6)', borderColor: 'rgba(100,70,200,0.3)' };
    }
  }, [machineState]);

  const phaseLabel = phase === 'BETTING' ? 'PLACE YOUR BETS' : phase === 'DRAWING' ? 'DRAWING…' : announcement?.type === 'lose' ? 'BETTER LUCK NEXT ROUND' : 'WINNER!';
  const phaseColor = phase === 'BETTING' ? '#f0c040' : phase === 'DRAWING' ? '#9966ff' : announcement?.type === 'lose' ? '#ff3355' : '#22ff88';

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden relative"
      style={{ backgroundColor: '#050510', color: '#fff', border: '1px solid rgba(153,102,255,0.18)', minHeight: '720px' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Orbitron:wght@700;900&display=swap');
        .mb-font-display { font-family: 'Orbitron', monospace; }
        .mb-font-ui { font-family: 'Rajdhani', sans-serif; }

        @keyframes mb-pulse-dot { 0%,100% { opacity:1; transform:scale(1);} 50% { opacity:.4; transform:scale(.6);} }
        @keyframes mb-shake { 0%,100%{transform:translateX(0) rotate(0);} 15%{transform:translateX(-6px) rotate(-1.5deg);} 30%{transform:translateX(6px) rotate(1.5deg);} 45%{transform:translateX(-5px) rotate(-1deg);} 60%{transform:translateX(5px) rotate(1deg);} 75%{transform:translateX(-3px);} 90%{transform:translateX(3px);} }
        @keyframes mb-ring-pulse { 0%,100%{opacity:1; transform:scale(1);} 50%{opacity:.5; transform:scale(1.05);} }
        @keyframes mb-flicker { 0%{transform:scale(1.2); opacity:.7;} 100%{transform:scale(1); opacity:1;} }
        @keyframes mb-ann-pop { 0%{transform:scale(.6); opacity:0;} 70%{transform:scale(1.05);} 100%{transform:scale(1); opacity:1;} }
        @keyframes mb-big-win-pulse { 0%{text-shadow:0 0 20px rgba(240,192,64,.35);} 100%{text-shadow:0 0 50px rgba(240,192,64,.35), 0 0 80px rgba(240,192,64,.3);} }
        @keyframes mb-balance-bump { 0%{transform:scale(1);} 40%{transform:scale(1.12); color:#22ff88;} 100%{transform:scale(1);} }
        @keyframes mb-balance-lose { 0%{transform:scale(1);} 40%{transform:scale(.92); color:#ff3355;} 100%{transform:scale(1);} }
        @keyframes mb-mkt-win { 0%{background:rgba(34,255,136,.3); border-color:#22ff88; color:#22ff88; box-shadow:0 0 16px rgba(34,255,136,.4);} 100%{} }
        @keyframes mb-mkt-lose { 0%,30%{background:rgba(255,51,85,.2); border-color:#ff3355; color:#ff3355;} 100%{} }
        @keyframes mb-num-highlight { 0%{transform:scale(1.5); box-shadow:0 0 20px currentColor; z-index:10;} 50%{transform:scale(1.3);} 100%{transform:scale(1);} }
        @keyframes mb-particle-fly { 0%{transform:translate(0,0) scale(1); opacity:1;} 100%{transform:translate(var(--tx,0),var(--ty,-80px)) scale(0); opacity:0;} }
        @keyframes mb-slide-in { from{opacity:0; transform:translateX(-10px);} to{opacity:1; transform:translateX(0);} }

        .mb-flash-win { animation: mb-mkt-win 0.8s ease forwards; }
        .mb-flash-lose { animation: mb-mkt-lose 0.5s ease forwards; }
        .mb-result-highlight { animation: mb-num-highlight 1s ease; }
        .mb-balance-win { animation: mb-balance-bump 0.5s ease; }
        .mb-balance-lose { animation: mb-balance-lose 0.5s ease; }
        .mb-hist-row { animation: mb-slide-in 0.3s ease; }

        @media (prefers-reduced-motion: reduce) {
          .mb-flash-win, .mb-flash-lose, .mb-result-highlight, .mb-balance-win, .mb-balance-lose, .mb-hist-row { animation: none; }
        }
      `}</style>

      {/* Background canvas */}
      <canvas ref={bgCanvasRef} className="absolute inset-0 pointer-events-none" style={{ opacity: 0.6, zIndex: 0 }} />

      {/* Particles overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 40 }}>
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              animation: `mb-particle-fly ${p.dur}s ease-out forwards`,
              // @ts-expect-error custom css vars
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col" style={{ zIndex: 1, minHeight: '720px' }}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{ background: 'linear-gradient(180deg, rgba(15,12,40,0.98), rgba(10,8,28,0.95))', borderBottom: '1px solid rgba(153,102,255,0.18)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex-shrink-0"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #c880ff, #6633aa)',
                boxShadow: '0 0 12px rgba(153,102,255,0.35)',
                border: '1.5px solid rgba(200,128,255,0.5)',
              }}
            />
            <span className="mb-font-display text-sm font-bold truncate" style={{ letterSpacing: '3px', color: '#f0c040', textShadow: '0 0 20px rgba(240,192,64,0.35)' }}>
              MAGIC BALL
            </span>
            <span
              className="hidden sm:inline mb-font-ui text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ border: '0.5px solid rgba(153,102,255,0.18)', color: '#5a5a7a', letterSpacing: '2px', background: 'rgba(255,255,255,0.02)' }}
            >
              ROUND <span style={{ color: '#f0c040' }}>{round}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="mb-font-ui text-[9px]" style={{ letterSpacing: '3px', color: '#5a5a7a' }}>BALANCE</div>
              <div
                key={balance}
                className="mb-font-display text-base font-bold"
                style={{ color: '#22ff88', textShadow: '0 0 14px rgba(34,255,136,0.4)' }}
              >
                ${balance.toFixed(2)}
              </div>
            </div>
            <button
              onClick={onExit}
              aria-label="Back to lobby"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: '#13132a', border: '1px solid rgba(100,80,180,0.18)', color: '#fff' }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
              <span className="hidden sm:inline">Back to lobby</span>
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="flex flex-col lg:flex-row flex-1">
          {/* Left panel */}
          <aside className="flex flex-col gap-2.5 p-3 lg:w-[220px] flex-shrink-0" style={{ backgroundColor: '#0f0f24', borderRight: '1px solid rgba(100,80,180,0.18)' }}>
            <div className="rounded-2xl p-3" style={{ backgroundColor: '#13132a', border: '0.5px solid rgba(100,80,180,0.18)' }}>
              <div className="mb-font-ui text-[10px] font-bold pb-1.5 mb-2.5" style={{ letterSpacing: '2.5px', color: '#5a5a7a', borderBottom: '0.5px solid rgba(100,80,180,0.18)' }}>
                LAST {MAX_HISTORY} DRAWS
              </div>
              <div className="flex flex-col gap-1.5 min-h-[40px]">
                {history.length === 0 && <div className="text-xs text-center py-2" style={{ color: '#5a5a7a' }}>No draws yet</div>}
                {history.map((h, i) => (
                  <div key={i} className="mb-hist-row flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ backgroundColor: '#181830' }}>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mb-font-display text-[10px] font-bold"
                      style={{
                        background: h.color === 'red'
                          ? 'radial-gradient(circle at 35% 30%, #ff6677, #aa1122)'
                          : 'radial-gradient(circle at 35% 30%, #5a5a7a, #222230)',
                        boxShadow: h.color === 'red' ? '0 0 8px rgba(255,51,85,0.4)' : '0 0 6px rgba(90,90,120,0.4)',
                        color: h.color === 'red' ? '#fff' : '#ccc',
                      }}
                    >
                      {h.num}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {[h.color.toUpperCase(), h.num % 2 === 0 ? 'EVEN' : 'ODD', h.num <= 18 ? 'LOW' : 'HIGH', h.num <= 12 ? 'D1' : h.num <= 24 ? 'D2' : 'D3'].map((t, ti) => (
                        <span key={ti} className="mb-font-ui text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ letterSpacing: '1px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#5a5a7a' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-3" style={{ backgroundColor: '#13132a', border: '0.5px solid rgba(100,80,180,0.18)' }}>
              <div className="mb-font-ui text-[10px] font-bold pb-1.5 mb-2.5" style={{ letterSpacing: '2.5px', color: '#5a5a7a', borderBottom: '0.5px solid rgba(100,80,180,0.18)' }}>
                HOT / COLD NUMBERS
              </div>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold mb-font-ui mb-1.5" style={{ color: '#ff3355' }}>
                    <WhatshotIcon sx={{ fontSize: 12 }} /> HOT
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {hot.length === 0 && <span className="text-xs" style={{ color: '#5a5a7a' }}>—</span>}
                    {hot.map((n) => (
                      <div key={n} className="w-[22px] h-[22px] rounded flex items-center justify-center mb-font-display text-[9px] font-bold" style={{ background: 'rgba(255,51,85,0.15)', color: '#ff3355', border: '0.5px solid rgba(255,51,85,0.3)' }}>
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold mb-font-ui mb-1.5" style={{ color: '#66aaff' }}>
                    <AcUnitIcon sx={{ fontSize: 12 }} /> COLD
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cold.length === 0 && <span className="text-xs" style={{ color: '#5a5a7a' }}>—</span>}
                    {cold.map((n) => (
                      <div key={n} className="w-[22px] h-[22px] rounded flex items-center justify-center mb-font-display text-[9px] font-bold" style={{ background: 'rgba(102,170,255,0.12)', color: '#66aaff', border: '0.5px solid rgba(102,170,255,0.3)' }}>
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-3" style={{ backgroundColor: '#13132a', border: '0.5px solid rgba(100,80,180,0.18)' }}>
              <div className="mb-font-ui text-[10px] font-bold pb-1.5 mb-2.5" style={{ letterSpacing: '2.5px', color: '#5a5a7a', borderBottom: '0.5px solid rgba(100,80,180,0.18)' }}>
                AUTO BET
              </div>
              <div className="flex items-center gap-2.5">
                <label className="relative inline-block" style={{ width: 42, height: 22 }}>
                  <input type="checkbox" checked={autoBet} onChange={(e) => setAutoBet(e.target.checked)} className="opacity-0 w-0 h-0" />
                  <span
                    className="absolute inset-0 rounded-full cursor-pointer"
                    style={{
                      backgroundColor: autoBet ? '#3d1a7a' : '#1a1a30',
                      border: `0.5px solid ${autoBet ? '#9966ff' : 'rgba(100,80,180,0.18)'}`,
                      transition: '0.3s',
                    }}
                    onClick={() => setAutoBet((v) => !v)}
                  >
                    <span
                      className="absolute rounded-full"
                      style={{
                        width: 16, height: 16, top: 3, left: autoBet ? 23 : 3,
                        backgroundColor: autoBet ? '#9966ff' : '#5a5a7a',
                        boxShadow: autoBet ? '0 0 8px rgba(153,102,255,0.35)' : 'none',
                        transition: '0.3s',
                      }}
                    />
                  </span>
                </label>
                <span className="mb-font-ui text-xs font-semibold" style={{ color: '#a0a0cc' }}>Auto-repeat bets</span>
              </div>
            </div>
          </aside>

          {/* Center panel */}
          <section
            ref={undefined}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-5 relative overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at 50% 10%, rgba(80,40,180,0.12) 0%, transparent 65%), #0b0b1e' }}
          >
            {/* Phase banner */}
            <div
              className="flex items-center gap-2 px-5 py-1.5 rounded-full mb-font-ui text-[11px] font-bold"
              style={{ letterSpacing: '3px', color: phaseColor, border: `0.5px solid ${phaseColor}55`, background: `${phaseColor}15` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: phaseColor, animation: 'mb-pulse-dot 1.2s ease-in-out infinite' }} />
              {phaseLabel}
            </div>

            {/* Machine */}
            <div className="flex flex-col items-center relative">
              <div
                ref={machineRef}
                className="rounded-full flex items-center justify-center relative overflow-hidden"
                style={{
                  width: 220, height: 220,
                  background: 'radial-gradient(circle at 35% 28%, rgba(80,50,160,0.25), rgba(10,6,30,0.8))',
                  border: '2px solid rgba(100,70,200,0.3)',
                  transition: 'box-shadow 0.4s',
                  animation: machineState === 'shaking' ? 'mb-shake 0.5s ease infinite' : undefined,
                  ...machineGlowStyle,
                }}
              >
                <div
                  className="rounded-full flex items-center justify-center relative"
                  style={{
                    width: 100, height: 100,
                    background: orbColor === 'red'
                      ? 'radial-gradient(circle at 38% 30%, #4a1020, #180610)'
                      : orbColor === 'black'
                      ? 'radial-gradient(circle at 38% 30%, #1a1a32, #080618)'
                      : 'radial-gradient(circle at 38% 30%, #2a1a5e, #080618)',
                    border: `1.5px solid ${orbColor === 'red' ? 'rgba(255,51,85,0.5)' : orbColor === 'black' ? 'rgba(100,100,170,0.4)' : 'rgba(100,70,200,0.4)'}`,
                    boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
                    transition: 'all 0.4s',
                  }}
                >
                  <span key={String(orbNumber)} className="mb-font-display font-black" style={{ fontSize: 40, color: '#fff', textShadow: '0 0 20px rgba(200,150,255,0.8)', animation: phase === 'DRAWING' ? 'mb-flicker 0.15s ease' : undefined }}>
                    {orbNumber}
                  </span>
                  {orbColor && (
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        inset: -6,
                        border: `2px solid ${orbColor === 'red' ? '#ff3355' : 'rgba(150,150,200,0.6)'}`,
                        boxShadow: orbColor === 'red' ? '0 0 20px rgba(255,51,85,0.4), 0 0 40px rgba(255,51,85,0.2)' : '0 0 16px rgba(150,150,200,0.3)',
                        animation: orbColor === 'red' ? 'mb-ring-pulse 1.5s ease-in-out infinite' : undefined,
                      }}
                    />
                  )}
                </div>
              </div>

              <div
                className="rounded-b-[20px] flex items-center justify-center relative"
                style={{ width: 160, height: 40, background: 'linear-gradient(180deg, #18163a, #100e28)', border: '1px solid rgba(80,60,160,0.3)', borderTop: 'none' }}
              >
                <div
                  className="rounded-md px-5 py-1 mb-font-display text-sm font-bold"
                  style={{
                    backgroundColor: '#0a0818', border: '1px solid rgba(60,40,120,0.4)', color: '#f0c040', minWidth: 60, textAlign: 'center',
                    boxShadow: slotLit ? '0 0 12px rgba(240,192,64,0.35)' : 'none', transition: 'all 0.4s',
                  }}
                >
                  {slotNumber}
                </div>
              </div>
            </div>

            {/* Timer */}
            <div className="relative" style={{ width: 90, height: 90 }}>
              <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <circle cx={60} cy={60} r={52} fill="none" stroke="rgba(40,30,80,0.8)" strokeWidth={6} />
                <circle
                  cx={60} cy={60} r={52} fill="none"
                  stroke={timerUrgent ? '#ff3355' : '#9966ff'}
                  strokeWidth={6}
                  strokeDasharray={CIRC}
                  strokeDashoffset={timerOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="mb-font-display text-xl font-bold leading-none" style={{ color: timerUrgent ? '#ff3355' : '#fff' }}>
                  {phase === 'BETTING' ? Math.max(timerVal, 0) : phase === 'DRAWING' ? '—' : ''}
                </div>
                <div className="mb-font-ui text-[8px]" style={{ letterSpacing: '2px', color: '#5a5a7a' }}>SEC</div>
              </div>
            </div>

            {/* Result chips */}
            <div className="flex gap-1.5 flex-wrap justify-center">
              {[
                { text: resultChips.number, active: resultChips.colorClass === 'red' ? 'red' : resultChips.colorClass === 'black' ? 'black' : '' },
                { text: resultChips.color, active: resultChips.colorClass === 'red' ? 'red' : resultChips.colorClass === 'black' ? 'black' : '' },
                { text: resultChips.parity, active: resultChips.colorClass ? 'neutral' : '' },
                { text: resultChips.range, active: resultChips.colorClass ? 'neutral' : '' },
                { text: resultChips.dozen, active: resultChips.colorClass ? 'neutral' : '' },
              ].map((chip, i) => (
                <div
                  key={i}
                  className="mb-font-ui px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    letterSpacing: '1px',
                    backgroundColor: chip.active === 'red' ? 'rgba(255,51,85,0.12)' : chip.active === 'black' ? 'rgba(120,120,180,0.1)' : chip.active === 'neutral' ? 'rgba(153,102,255,0.1)' : '#13132a',
                    border: `0.5px solid ${chip.active === 'red' ? '#ff3355' : chip.active === 'black' ? 'rgba(120,120,180,0.5)' : chip.active === 'neutral' ? '#9966ff' : 'rgba(100,80,180,0.18)'}`,
                    color: chip.active === 'red' ? '#ff3355' : chip.active === 'black' ? '#aab' : chip.active === 'neutral' ? '#9966ff' : '#5a5a7a',
                  }}
                >
                  {chip.text}
                </div>
              ))}
            </div>

            {/* Announcement overlay */}
            {announcement && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 30 }}>
                <div
                  className="mb-font-display text-center px-8 py-4 rounded-2xl font-black"
                  style={{
                    fontSize: announcement.type === 'big-win' ? 28 : 24,
                    letterSpacing: '3px',
                    backdropFilter: 'blur(10px)',
                    animation: announcement.type === 'big-win' ? 'mb-ann-pop 0.5s cubic-bezier(0.34,1.56,0.64,1), mb-big-win-pulse 0.8s ease 0.5s infinite alternate' : 'mb-ann-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                    color: announcement.type === 'lose' ? '#ff3355' : announcement.type === 'big-win' ? '#f0c040' : '#22ff88',
                    background: announcement.type === 'lose' ? 'rgba(30,5,10,0.85)' : announcement.type === 'big-win' ? 'rgba(30,20,0,0.9)' : 'rgba(0,30,15,0.85)',
                    border: `2px solid ${announcement.type === 'lose' ? '#ff3355' : announcement.type === 'big-win' ? '#f0c040' : '#22ff88'}`,
                  }}
                >
                  {announcement.type === 'big-win' && <EmojiEventsIcon sx={{ fontSize: 28, mr: 1, verticalAlign: 'middle', color: '#f0c040' }} />}
                  {announcement.text}
                </div>
              </div>
            )}
          </section>

          {/* Right panel */}
          <aside className="flex flex-col gap-2.5 p-3 lg:w-[280px] flex-shrink-0" style={{ backgroundColor: '#0f0f24', borderLeft: '1px solid rgba(100,80,180,0.18)' }}>
            {/* Stake */}
            <div className="rounded-2xl p-3" style={{ backgroundColor: '#13132a', border: '0.5px solid rgba(100,80,180,0.18)' }}>
              <div className="mb-font-ui text-[10px] font-bold pb-1.5 mb-2.5" style={{ letterSpacing: '2.5px', color: '#5a5a7a', borderBottom: '0.5px solid rgba(100,80,180,0.18)' }}>
                STAKE
              </div>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {STAKE_CHIPS.map((v) => (
                  <button
                    key={v}
                    disabled={!bettingEnabled}
                    onClick={() => { setStake(v); setActiveStakeChip(v); }}
                    className="flex-1 min-w-[38px] py-1.5 rounded-md mb-font-ui text-xs font-bold disabled:opacity-40"
                    style={{
                      border: `0.5px solid ${activeStakeChip === v ? '#9966ff' : 'rgba(100,80,180,0.18)'}`,
                      backgroundColor: activeStakeChip === v ? 'rgba(153,102,255,0.18)' : '#181830',
                      color: activeStakeChip === v ? '#9966ff' : '#a0a0cc',
                      letterSpacing: '0.5px',
                    }}
                  >
                    ${v}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 rounded-md px-2.5" style={{ backgroundColor: '#181830', border: '0.5px solid rgba(100,80,180,0.18)' }}>
                <span className="mb-font-ui text-sm font-bold" style={{ color: '#5a5a7a' }}>$</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  disabled={!bettingEnabled}
                  value={stake}
                  onChange={(e) => { setStake(Math.max(1, parseFloat(e.target.value) || 0)); setActiveStakeChip(null); }}
                  className="flex-1 min-w-0 bg-transparent outline-none py-2 mb-font-display font-bold text-sm disabled:opacity-40"
                  style={{ color: '#f0c040' }}
                />
              </div>
            </div>

            {/* Markets */}
            <div className="rounded-2xl p-3" style={{ backgroundColor: '#13132a', border: '0.5px solid rgba(100,80,180,0.18)' }}>
              <div className="mb-font-ui text-[10px] font-bold pb-1.5 mb-2.5" style={{ letterSpacing: '2.5px', color: '#5a5a7a', borderBottom: '0.5px solid rgba(100,80,180,0.18)' }}>
                MARKETS
              </div>

              {[
                { label: 'COLOR · ×1.95', keys: ['red', 'black'] },
                { label: 'ODD / EVEN · ×1.95', keys: ['odd', 'even'] },
                { label: 'HIGH / LOW · ×1.95', keys: ['low', 'high'] },
                { label: 'DOZEN · ×2.8', keys: ['d1', 'd2', 'd3'] },
              ].map((group) => (
                <div key={group.label} className="mb-2.5 last:mb-0">
                  <div className="mb-font-ui text-[9px] font-bold mb-1.5" style={{ letterSpacing: '2px', color: '#5a5a7a' }}>{group.label}</div>
                  <div className="flex gap-1.5">
                    {group.keys.map((key) => {
                      const market = MARKETS[key];
                      const active = activeBets[key] !== undefined;
                      const flash = betFlashes[key];
                      const isRedMkt = key === 'red';
                      const isBlackMkt = key === 'black';
                      return (
                        <button
                          key={key}
                          disabled={!bettingEnabled}
                          onClick={() => toggleBet(key)}
                          className={`flex-1 py-1.5 px-1.5 rounded-md mb-font-ui text-xs font-bold flex flex-col items-center gap-0.5 disabled:opacity-40 ${flash === 'win' ? 'mb-flash-win' : flash === 'lose' ? 'mb-flash-lose' : ''}`}
                          style={{
                            letterSpacing: '0.5px',
                            border: `0.5px solid ${active ? (isRedMkt ? '#ff3355' : isBlackMkt ? 'rgba(150,150,200,0.5)' : '#9966ff') : 'rgba(100,80,180,0.18)'}`,
                            backgroundColor: active ? (isRedMkt ? 'rgba(255,51,85,0.15)' : isBlackMkt ? 'rgba(100,100,150,0.15)' : 'rgba(153,102,255,0.18)') : '#181830',
                            color: active ? (isRedMkt ? '#ff3355' : isBlackMkt ? '#aab' : '#9966ff') : '#a0a0cc',
                          }}
                        >
                          {(isRedMkt || isBlackMkt) && (
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isRedMkt ? '#ff3355' : '#888' }} />
                          )}
                          {market.label}
                          <span className="text-[9px] font-semibold" style={{ color: '#f0c040', opacity: active ? 1 : 0.7 }}>×{market.payout}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Number grid */}
            <div className="rounded-2xl p-3" style={{ backgroundColor: '#13132a', border: '0.5px solid rgba(100,80,180,0.18)' }}>
              <div className="mb-font-ui text-[10px] font-bold pb-1.5 mb-2.5" style={{ letterSpacing: '2.5px', color: '#5a5a7a', borderBottom: '0.5px solid rgba(100,80,180,0.18)' }}>
                SINGLE NUMBER · ×32
              </div>
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}>
                {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                  const key = `n${n}`;
                  const active = activeBets[key] !== undefined;
                  const red = isRed(n);
                  const flash = betFlashes[key];
                  return (
                    <button
                      id={`mb-numBtn-${n}`}
                      key={n}
                      disabled={!bettingEnabled}
                      onClick={() => toggleBet(key)}
                      className={`aspect-square rounded mb-font-display text-[9px] font-bold flex items-center justify-center disabled:opacity-30 ${flash === 'win' ? 'mb-flash-win' : flash === 'lose' ? 'mb-flash-lose' : ''}`}
                      style={{
                        border: `0.5px solid ${active ? (red ? '#ff3355' : 'rgba(150,150,220,0.6)') : red ? 'rgba(180,30,50,0.25)' : 'rgba(60,60,100,0.3)'}`,
                        backgroundColor: active ? (red ? 'rgba(255,51,85,0.25)' : 'rgba(100,100,160,0.25)') : red ? 'rgba(180,30,50,0.12)' : 'rgba(40,40,70,0.5)',
                        color: active ? (red ? '#fff' : '#ddf') : red ? '#ff6677' : '#8888aa',
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spin button */}
            <button
              onClick={manualSpin}
              disabled={!bettingEnabled}
              className="w-full py-3.5 rounded-xl mb-font-display text-sm font-bold disabled:opacity-35"
              style={{
                letterSpacing: '2px',
                border: '1px solid rgba(153,102,255,0.6)',
                background: 'linear-gradient(135deg, rgba(100,40,200,0.4), rgba(60,20,120,0.6))',
                color: '#9966ff',
              }}
            >
              LOCK &amp; SPIN
            </button>

            {/* Clear bets */}
            <button
              onClick={clearAllBets}
              disabled={!bettingEnabled || totalStake === 0}
              className="w-full py-2 rounded-lg mb-font-ui text-[11px] font-bold disabled:opacity-30"
              style={{ letterSpacing: '2px', border: '0.5px solid rgba(100,80,180,0.18)', backgroundColor: 'transparent', color: '#5a5a7a' }}
            >
              CLEAR ALL BETS
            </button>
          </aside>
        </div>

        {streak >= 2 && (
          <div className="px-3 pb-2 flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#f59e0b' }}>
            <WhatshotIcon sx={{ fontSize: 13 }} /> Win streak ×{streak} · {wins}W / {losses}L
          </div>
        )}

        {/* Fairness chip + modal */}
        <button
          onClick={() => setFairnessOpen(true)}
          className="absolute bottom-2.5 left-3 flex items-center gap-1.5 text-[10px] font-mono px-1"
          style={{ color: '#5a5a7a', zIndex: 20 }}
        >
          <span className="px-1 py-0.5 rounded" style={{ backgroundColor: '#13132a', border: '1px solid rgba(100,80,180,0.18)', fontSize: 9, letterSpacing: '1px', color: '#a0a0cc' }}>HASH</span>
          {fairness.hash ? fairness.hash.slice(0, 14) + '…' : '—'}
        </button>

        {fairnessOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setFairnessOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} className="rounded-xl p-4 w-full max-w-sm flex flex-col gap-2" style={{ backgroundColor: '#13132a', border: '1px solid rgba(153,102,255,0.25)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold" style={{ color: '#9966ff' }}>Round fairness</span>
                <button onClick={() => setFairnessOpen(false)} aria-label="Close">
                  <CloseIcon sx={{ fontSize: 16 }} style={{ color: '#5a5a7a' }} />
                </button>
              </div>
              <FairnessRow label="Server seed" value={revealedSeed ? revealedSeed : phase === 'RESULT' ? fairness.serverSeed : 'Revealed after round'} />
              <FairnessRow label="Client seed" value={fairness.clientSeed || '—'} />
              <FairnessRow label="Nonce" value={fairness.nonce || '—'} />
              <FairnessRow label="Hash" value={fairness.hash || '—'} />
              <FairnessRow label="Winning number" value={phase === 'RESULT' ? String(resultChips.number) : 'Revealed after round'} />
              <p className="text-[10px] mt-1" style={{ color: '#5a5a7a' }}>
                Demo game — this hash is generated locally each round for illustration and isn't checked against any server.
              </p>
            </div>
          </div>
        )}

        <div className="mb-font-ui text-[10px] tracking-wide text-center py-2" style={{ color: '#5a5a7a' }}>
          Demo table game · odds shown per market · Play responsibly
        </div>
      </div>
    </div>
  );
}

function FairnessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span style={{ color: '#a0a0cc' }}>{label}</span>
      <span className="font-mono truncate max-w-[220px]" style={{ color: '#ccd' }}>{value}</span>
    </div>
  );
}