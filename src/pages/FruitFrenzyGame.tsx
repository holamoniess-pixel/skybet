import { useState, useRef, useEffect, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

/* =========================================================================
   FRUIT FRENZY — self-contained demo rewrite
   ------------------------------------------------------------------------
   Rebuilt on the same pattern as SpinDaBottleGame:
     - Runs entirely client-side. No network calls, no auth gate, no real
       wallet — just an in-memory fictional demo balance, exactly like the
       other in-lobby games.
     - Reels are static 30-symbol strips (generated once per session) that
       spin to a random stop each round. Everything is resolved and paid
       out locally — there is no server round-trip to bet or settle.
     - A paytable modal and a wins/biggest-win strip give the machine the
       same "legitimate cabinet" flavor as the bottle game's fairness
       panel, without pretending anything is server-verified.
     - Win rate is deliberately scheduled: every block of 20 spins is
       pre-shuffled so exactly 3 of them land a win and the other 17 land
       nothing. The schedule is shuffled fresh at the start of each block,
       so the *order* of wins within the 20 spins is unpredictable, but
       the long-run rate stays fixed at 3-in-20 (15%).
   ========================================================================= */

const STARTING_BALANCE = 1000;
const REEL_LENGTH = 30;
const SYMBOL_HEIGHT = 84; // px — fixed across breakpoints so the translate math stays simple
const MIN_BET = 0.5;
const MAX_BET = 100;
const QUICK_BETS = [0.5, 1, 2, 5];
const REEL_DURATIONS = [850, 1000, 1150];
const REEL_STAGGER = 240;

// Win-rate schedule: exactly WINS_PER_BLOCK true values in every
// SPINS_PER_BLOCK-length block, shuffled into a random order.
const SPINS_PER_BLOCK = 20;
const WINS_PER_BLOCK = 3;

interface Fruit {
  emoji: string;
  value: number;
}

const FRUITS: Fruit[] = [
  { emoji: '🍎', value: 2 },
  { emoji: '🍊', value: 2 },
  { emoji: '🍋', value: 3 },
  { emoji: '🍇', value: 3 },
  { emoji: '🍉', value: 5 },
  { emoji: '🍓', value: 5 },
  { emoji: '🍒', value: 10 },
  { emoji: '🍑', value: 10 },
  { emoji: '🥝', value: 20 },
  { emoji: '⭐', value: 50 },
];

const FRUIT_VALUE: Record<string, number> = Object.fromEntries(FRUITS.map((f) => [f.emoji, f.value]));

function randomFruit(): Fruit {
  return FRUITS[Math.floor(Math.random() * FRUITS.length)];
}

function buildReel(): Fruit[] {
  return Array.from({ length: REEL_LENGTH }, randomFruit);
}

interface LineDef {
  key: string;
  label: string;
  multiplier: number;
  // Which of the 3 visible rows (0 = top, 1 = mid, 2 = bottom) this reel
  // contributes to the line. Row lines are constant; diagonals vary per
  // reel — one function covers both cases.
  rowFor: (reel: number) => 0 | 1 | 2;
}

const LINES: LineDef[] = [
  { key: 'top', label: 'Top Row', multiplier: 1, rowFor: () => 0 },
  { key: 'mid', label: 'Middle Row', multiplier: 1, rowFor: () => 1 },
  { key: 'bot', label: 'Bottom Row', multiplier: 1, rowFor: () => 2 },
  { key: 'diagDown', label: 'Diagonal ↘', multiplier: 1.5, rowFor: (r) => r as 0 | 1 | 2 },
  { key: 'diagUp', label: 'Diagonal ↗', multiplier: 1.5, rowFor: (r) => (2 - r) as 0 | 1 | 2 },
];

interface LineResult {
  key: string;
  label: string;
  fruit: string;
  amount: number;
}

interface HistoryEntry {
  id: number;
  win: number;
}

interface Particle {
  id: number;
  emoji: string;
  left: number;
  duration: number;
  size: number;
  delay: number;
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

// Fisher-Yates shuffle of a fixed-size boolean schedule: WINS_PER_BLOCK
// `true` entries (this spin should win) and the rest `false`, in a
// randomized order. Regenerated at the start of every new block of spins.
function generateWinSchedule(size = SPINS_PER_BLOCK, wins = WINS_PER_BLOCK): boolean[] {
  const arr = Array.from({ length: size }, (_, i) => i < wins);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Finds a reel stop position such that the given row of the visible
// 3-symbol window lands on `fruitEmoji`, picking randomly among any
// matching positions on that reel strip. Returns null if the fruit
// doesn't appear on this reel at all (shouldn't happen with 30 symbols
// across 10 fruit types, but handled defensively).
function stopForRowMatch(reel: Fruit[], row: 0 | 1 | 2, fruitEmoji: string): number | null {
  const indices: number[] = [];
  reel.forEach((f, i) => {
    if (f.emoji === fruitEmoji) indices.push(i);
  });
  if (indices.length === 0) return null;
  const i = indices[Math.floor(Math.random() * indices.length)];
  if (row === 0) return (i + 1) % REEL_LENGTH;
  if (row === 1) return i;
  return (i - 1 + REEL_LENGTH) % REEL_LENGTH;
}

export default function FruitFrenzyGame({ onExit }: { onExit: () => void }) {
  const [reelsData] = useState<Fruit[][]>(() => [buildReel(), buildReel(), buildReel()]);

  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [betAmount, setBetAmount] = useState(2);
  const [betInput, setBetInput] = useState('2.00');

  const [spinning, setSpinning] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  const [overlay, setOverlay] = useState<{ text: string; mult: string; amount: number } | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  const [autoSpin, setAutoSpin] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState(10);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState(0);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [spinsPlayed, setSpinsPlayed] = useState(0);
  const [spinsWon, setSpinsWon] = useState(0);
  const [biggestWin, setBiggestWin] = useState(0);

  const [paytableOpen, setPaytableOpen] = useState(false);

  const reelRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const stopsRef = useRef<number[]>([0, 0, 0]);
  const rafIdsRef = useRef<(number | null)[]>([null, null, null]);
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const particleIdRef = useRef(0);
  const historyIdRef = useRef(0);
  const mountedRef = useRef(true);

  // Win-rate scheduling state: which spins in the current 20-spin block are
  // pre-destined to win (exactly 3 of them), and how far into the block we
  // currently are.
  const winScheduleRef = useRef<boolean[]>(generateWinSchedule());
  const scheduleIndexRef = useRef(0);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutIdsRef.current.push(id);
    return id;
  }, []);

  // Mount/unmount lifecycle — cancel any in-flight animation or timers.
  useEffect(() => {
    mountedRef.current = true;
    reelRefs.current.forEach((el, i) => {
      if (el) el.style.transform = `translateY(${-stopsRef.current[i] * SYMBOL_HEIGHT}px)`;
    });
    return () => {
      mountedRef.current = false;
      rafIdsRef.current.forEach((id) => { if (id) cancelAnimationFrame(id); });
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  const animateReel = useCallback((idx: number, finalStop: number, duration: number, onDone: () => void) => {
    const el = reelRefs.current[idx];
    if (!el) { onDone(); return; }
    const startPos = stopsRef.current[idx];
    const totalDistance = REEL_LENGTH * (2 + idx) + finalStop - startPos;
    const startTime = performance.now();

    function frame(now: number) {
      if (!mountedRef.current) return;
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const currentPos = startPos + totalDistance * eased;
      const displayPos = currentPos % REEL_LENGTH;
      if (el) el.style.transform = `translateY(${-displayPos * SYMBOL_HEIGHT}px)`;

      if (t < 1) {
        rafIdsRef.current[idx] = requestAnimationFrame(frame);
      } else {
        if (el) el.style.transform = `translateY(${-finalStop * SYMBOL_HEIGHT}px)`;
        stopsRef.current[idx] = finalStop;
        rafIdsRef.current[idx] = null;
        onDone();
      }
    }
    rafIdsRef.current[idx] = requestAnimationFrame(frame);
  }, []);

  const spawnParticles = useCallback((emojis: string[]) => {
    const batch: Particle[] = Array.from({ length: 16 }, () => ({
      id: ++particleIdRef.current,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      left: Math.random() * 100,
      duration: 1.8 + Math.random() * 1.4,
      size: 20 + Math.random() * 18,
      delay: Math.random() * 0.4,
    }));
    setParticles((prev) => [...prev, ...batch]);
    const maxLifeMs = (1.8 + 1.4 + 0.4) * 1000 + 150;
    trackTimeout(() => {
      if (!mountedRef.current) return;
      setParticles((prev) => prev.filter((p) => !batch.some((b) => b.id === p.id)));
    }, maxLifeMs);
  }, [trackTimeout]);

  // Pure check: does this stop combination land any winning line at all?
  // Used only to steer which stops get generated — no side effects.
  const hasWin = useCallback((stops: number[]): boolean => {
    const visible = [0, 1, 2].map((r) =>
      [(stops[r] - 1 + REEL_LENGTH) % REEL_LENGTH, stops[r], (stops[r] + 1) % REEL_LENGTH].map((i) => reelsData[r][i].emoji)
    );
    return LINES.some((line) => {
      const symbols = [0, 1, 2].map((r) => visible[r][line.rowFor(r)]);
      return symbols[0] === symbols[1] && symbols[1] === symbols[2];
    });
  }, [reelsData]);

  // Picks a stop combination that guarantees at least one winning line —
  // tries random lines/fruits until it finds stops that exist on all three
  // reel strips for that combination.
  const tryForceWin = useCallback((): number[] | null => {
    const shuffledLines = [...LINES].sort(() => Math.random() - 0.5);
    for (const line of shuffledLines) {
      const shuffledFruits = [...FRUITS].sort(() => Math.random() - 0.5);
      for (const fruit of shuffledFruits) {
        const stops: number[] = [];
        let ok = true;
        for (let r = 0; r < 3; r++) {
          const row = line.rowFor(r);
          const s = stopForRowMatch(reelsData[r], row, fruit.emoji);
          if (s === null) { ok = false; break; }
          stops.push(s);
        }
        if (ok) return stops;
      }
    }
    return null;
  }, [reelsData]);

  // Picks a stop combination guaranteed to land no winning line — retries
  // random stops a bounded number of times, then falls back to sweeping
  // the third reel to find a safe combination.
  const pickNonWinningStops = useCallback((): number[] => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const stops = [0, 1, 2].map(() => Math.floor(Math.random() * REEL_LENGTH));
      if (!hasWin(stops)) return stops;
    }
    const stops = [0, 1, 2].map(() => Math.floor(Math.random() * REEL_LENGTH));
    for (let i = 0; i < REEL_LENGTH; i++) {
      stops[2] = i;
      if (!hasWin(stops)) return stops;
    }
    return stops;
  }, [hasWin]);

  const settle = useCallback((stops: number[], bet: number) => {
    const visible = [0, 1, 2].map((r) =>
      [(stops[r] - 1 + REEL_LENGTH) % REEL_LENGTH, stops[r], (stops[r] + 1) % REEL_LENGTH].map((i) => reelsData[r][i].emoji)
    );

    let totalWin = 0;
    const winCells = new Set<string>();
    const lineResults: LineResult[] = [];

    LINES.forEach((line) => {
      const symbols = [0, 1, 2].map((r) => visible[r][line.rowFor(r)]);
      if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        const amount = FRUIT_VALUE[symbols[0]] * bet * line.multiplier;
        totalWin += amount;
        lineResults.push({ key: line.key, label: line.label, fruit: symbols[0], amount });
        [0, 1, 2].forEach((r) => {
          const idx = (stops[r] + (line.rowFor(r) - 1) + REEL_LENGTH) % REEL_LENGTH;
          winCells.add(`${r}-${idx}`);
        });
      }
    });

    if (!mountedRef.current) return;

    setWinningCells(winCells);
    setSpinning(false);
    setSpinsPlayed((n) => n + 1);
    setHistory((h) => [{ id: ++historyIdRef.current, win: totalWin }, ...h].slice(0, 12));

    if (totalWin > 0) {
      setBalance((b) => parseFloat((b + totalWin).toFixed(2)));
      setWinAmount(totalWin);
      setSpinsWon((n) => n + 1);
      setBiggestWin((m) => Math.max(m, totalWin));

      let text = 'FRUIT WIN!';
      let mult = '1×';
      if (totalWin >= bet * 30) { text = 'JACKPOT!'; mult = '50×'; }
      else if (totalWin >= bet * 15) { text = 'BIG WIN!'; mult = '20×'; }
      else if (totalWin >= bet * 5) { text = 'NICE WIN!'; mult = '10×'; }

      setOverlay({ text, mult, amount: totalWin });
      setMessage(`Won ${fmt(totalWin)}!`);
      spawnParticles(lineResults.length ? lineResults.map((l) => l.fruit) : ['🍎', '🍊', '🍋']);

      trackTimeout(() => { if (mountedRef.current) setOverlay(null); }, 2600);
    } else {
      setWinAmount(0);
      setMessage('No win this time — spin again!');
    }
  }, [reelsData, spawnParticles, trackTimeout]);

  const spin = useCallback(() => {
    if (spinning) return;
    const bet = betAmount;
    if (bet > balance) {
      setMessage('Insufficient balance!');
      return;
    }

    setSpinning(true);
    setMessage('');
    setWinAmount(0);
    setWinningCells(new Set());
    setOverlay(null);
    setBalance((b) => parseFloat((b - bet).toFixed(2)));

    // Consult the current 20-spin win schedule, then advance it — refresh
    // with a freshly shuffled schedule once a block is exhausted.
    const shouldWin = winScheduleRef.current[scheduleIndexRef.current] ?? false;
    scheduleIndexRef.current += 1;
    if (scheduleIndexRef.current >= winScheduleRef.current.length) {
      winScheduleRef.current = generateWinSchedule();
      scheduleIndexRef.current = 0;
    }

    const finalStops = shouldWin
      ? tryForceWin() ?? [0, 1, 2].map(() => Math.floor(Math.random() * REEL_LENGTH))
      : pickNonWinningStops();

    finalStops.forEach((stop, idx) => {
      trackTimeout(() => {
        animateReel(idx, stop, REEL_DURATIONS[idx], () => {
          if (idx === 2) settle(finalStops, bet);
        });
      }, idx * REEL_STAGGER);
    });
  }, [spinning, betAmount, balance, animateReel, settle, trackTimeout, tryForceWin, pickNonWinningStops]);

  // Auto-spin continuation loop.
  useEffect(() => {
    if (!autoSpin || spinning) return;
    if (autoSpinRemaining <= 0) { setAutoSpin(false); return; }
    if (betAmount > balance) {
      setAutoSpin(false);
      setMessage('Auto-spin stopped — insufficient balance.');
      return;
    }
    const t = setTimeout(() => {
      setAutoSpinRemaining((r) => r - 1);
      spin();
    }, 900);
    return () => clearTimeout(t);
  }, [autoSpin, spinning, autoSpinRemaining, balance, betAmount, spin]);

  const commitBetInput = useCallback((raw: string) => {
    let v = parseFloat(raw);
    if (Number.isNaN(v)) v = MIN_BET;
    v = Math.max(MIN_BET, Math.min(MAX_BET, Math.round(v * 100) / 100));
    setBetAmount(v);
    setBetInput(v.toFixed(2));
  }, []);

  const adjustBet = (factor: number) => {
    if (spinning || autoSpin) return;
    commitBetInput(String(betAmount * factor));
  };

  const setQuickBet = (v: number) => {
    if (spinning || autoSpin) return;
    setBetAmount(v);
    setBetInput(v.toFixed(2));
  };

  const toggleAutoSpin = () => {
    if (autoSpin) { setAutoSpin(false); return; }
    if (spinning) return;
    setAutoSpinRemaining(autoSpinCount);
    setAutoSpin(true);
  };

  const controlsDisabled = spinning || autoSpin;
  const canSpin = !spinning && !autoSpin && betAmount <= balance;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col items-center w-full"
      style={{ backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,179,0,0.18)', minHeight: '640px', maxWidth: 460 }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes ff-symbol-pulse { from { transform: scale(1); filter: brightness(1); } to { transform: scale(1.18); filter: brightness(1.35); } }
        .fruit-winning { animation: ff-symbol-pulse 0.3s ease infinite alternate; }
        @keyframes ff-overlay-pop { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
        @keyframes ff-win-bounce { from { transform: scale(1); } to { transform: scale(1.08); } }
        @keyframes ff-fruit-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(340px) rotate(600deg); opacity: 0; }
        }
        @keyframes ff-pill-in { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .fruit-winning, .ff-overlay, .ff-particle, .ff-pill { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div
        className="w-full flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ backgroundColor: '#111111', borderBottom: '1px solid rgba(255,179,0,0.18)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm sm:text-base font-black truncate"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #FF6B6B, #FFB300, #00E676)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            🍉 FRUIT FRENZY
          </span>
          {spinning && (
            <span
              className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,179,0,0.12)', color: '#FFB300', border: '1px solid rgba(255,179,0,0.35)' }}
            >
              <FiberManualRecordIcon sx={{ fontSize: 9 }} />
              SPINNING
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[9px]" style={{ color: '#888' }}>BALANCE</span>
            <span className="font-mono font-semibold text-sm" style={{ color: '#00E676' }}>{fmt(balance)}</span>
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

      {/* Stats strip */}
      <div
        className="flex items-center gap-0 mx-3 mt-3 mb-1 rounded-full px-3 sm:px-4 py-1.5"
        style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,179,0,0.18)' }}
      >
        <div className="flex flex-col items-center px-3 sm:px-4">
          <span className="text-[9px] tracking-widest" style={{ color: '#666' }}>SPINS</span>
          <span className="text-sm font-bold" style={{ color: '#fff' }}>{spinsPlayed}</span>
        </div>
        <div className="w-px h-6" style={{ backgroundColor: 'rgba(255,179,0,0.18)' }} />
        <div className="flex flex-col items-center px-3 sm:px-4">
          <span className="text-[9px] tracking-widest" style={{ color: '#666' }}>WINS</span>
          <span className="text-sm font-bold" style={{ color: '#00E676' }}>{spinsWon}</span>
        </div>
        <div className="w-px h-6" style={{ backgroundColor: 'rgba(255,179,0,0.18)' }} />
        <div className="flex flex-col items-center px-3 sm:px-4">
          <span className="text-[9px] tracking-widest" style={{ color: '#666' }}>BIGGEST</span>
          <span className="text-sm font-bold" style={{ color: '#FFB300' }}>{biggestWin > 0 ? fmt(biggestWin) : '—'}</span>
        </div>
      </div>

      {/* Machine */}
      <div className="relative w-full px-3 mt-2" style={{ maxWidth: 420 }}>
        <div
          className="relative rounded-xl p-2 sm:p-3"
          style={{ backgroundColor: '#111111', border: '1px solid rgba(255,179,0,0.18)' }}
        >
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 relative">
            {[0, 1, 2].map((r) => (
              <div
                key={r}
                className="relative overflow-hidden rounded-lg"
                style={{ height: SYMBOL_HEIGHT * 3, backgroundColor: 'rgba(0,0,0,0.35)' }}
              >
                <div ref={(el) => { reelRefs.current[r] = el; }} className="absolute top-0 left-0 w-full">
                  {reelsData[r].map((fruit, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-center ${winningCells.has(`${r}-${i}`) ? 'fruit-winning' : ''}`}
                      style={{ height: SYMBOL_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <span style={{ fontSize: 'clamp(1.8rem, 8vw, 2.6rem)' }}>{fruit.emoji}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Payline guides */}
            <div className="absolute inset-0 pointer-events-none grid grid-rows-3">
              <div style={{ borderBottom: '1px dashed rgba(255,179,0,0.12)' }} />
              <div style={{ borderBottom: '1px dashed rgba(255,179,0,0.12)' }} />
              <div />
            </div>
          </div>

          {/* Win particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
            {particles.map((p) => (
              <span
                key={p.id}
                className="ff-particle absolute"
                style={{
                  left: `${p.left}%`,
                  top: '-24px',
                  fontSize: p.size,
                  animation: `ff-fruit-fall ${p.duration}s linear ${p.delay}s forwards`,
                }}
              >
                {p.emoji}
              </span>
            ))}
          </div>

          {/* Win overlay */}
          {overlay && (
            <div
              className="ff-overlay absolute inset-0 flex flex-col items-center justify-center rounded-xl z-10"
              style={{ backgroundColor: 'rgba(0,0,0,0.8)', animation: 'ff-overlay-pop 0.3s ease' }}
            >
              <div
                className="font-black text-2xl sm:text-3xl"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: 'linear-gradient(135deg, #FF6B6B, #FFB300, #00E676)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'ff-win-bounce 0.4s ease infinite alternate',
                }}
              >
                {overlay.text}
              </div>
              <div className="font-mono text-lg mt-1" style={{ color: '#FFB300' }}>{overlay.mult}</div>
              <div className="font-mono text-sm mt-2" style={{ color: '#00E676' }}>{fmt(overlay.amount)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Message row */}
      <div className="h-7 flex items-center justify-center mt-1 px-4 text-center">
        {message && (
          <span className="text-xs sm:text-sm font-semibold" style={{ color: winAmount > 0 ? '#00E676' : '#999' }}>
            {message}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="w-full px-4 flex flex-col gap-3 mt-1" style={{ maxWidth: 420 }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-widest flex-shrink-0" style={{ color: '#666' }}>BET</span>
          <button
            className="w-8 h-8 rounded-md flex-shrink-0 text-xs font-bold disabled:opacity-40"
            disabled={controlsDisabled}
            onClick={() => adjustBet(0.5)}
            style={{ backgroundColor: '#1C1C1C', border: '1px solid #2A2A2A', color: '#888' }}
          >½</button>
          <div className="flex items-center flex-1 rounded-md overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,179,0,0.3)' }}>
            <span className="px-2 font-bold" style={{ color: '#FFB300', borderRight: '1px solid rgba(255,179,0,0.15)' }}>$</span>
            <input
              type="number"
              min={MIN_BET}
              max={MAX_BET}
              step={0.5}
              disabled={controlsDisabled}
              value={betInput}
              onChange={(e) => setBetInput(e.target.value)}
              onBlur={(e) => commitBetInput(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-right py-1.5 px-2 font-bold disabled:opacity-50"
              style={{ color: '#FFB300' }}
            />
          </div>
          <button
            className="w-8 h-8 rounded-md flex-shrink-0 text-xs font-bold disabled:opacity-40"
            disabled={controlsDisabled}
            onClick={() => adjustBet(2)}
            style={{ backgroundColor: '#1C1C1C', border: '1px solid #2A2A2A', color: '#888' }}
          >2×</button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_BETS.map((amt) => (
            <button
              key={amt}
              disabled={controlsDisabled}
              onClick={() => setQuickBet(amt)}
              className="py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
              style={{
                backgroundColor: betAmount === amt ? 'rgba(255,179,0,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${betAmount === amt ? 'rgba(255,179,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: betAmount === amt ? '#FFB300' : '#aaa',
              }}
            >
              ${amt}
            </button>
          ))}
        </div>

        <button
          onClick={spin}
          disabled={!canSpin}
          className="py-3.5 rounded-lg font-extrabold text-sm uppercase tracking-[3px] disabled:opacity-50"
          style={{
            background: canSpin ? 'linear-gradient(135deg, #FF6B6B, #FFB300)' : 'linear-gradient(135deg, #3a3520, #4a4228)',
            color: canSpin ? '#0A0A0A' : '#666',
            boxShadow: canSpin ? '0 4px 24px rgba(255,179,0,0.3)' : 'none',
          }}
        >
          {spinning ? 'SPINNING…' : autoSpin ? `AUTO-SPIN (${autoSpinRemaining} LEFT)` : 'SPIN'}
        </button>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={toggleAutoSpin}
            disabled={!autoSpin && spinning}
            className="flex items-center gap-2 text-xs font-semibold disabled:opacity-40 flex-shrink-0"
            style={{ color: autoSpin ? '#FFB300' : '#888' }}
          >
            <span
              className="relative inline-flex items-center rounded-full flex-shrink-0"
              style={{ width: 34, height: 18, backgroundColor: autoSpin ? 'rgba(255,179,0,0.35)' : '#2A2A2A', transition: 'background-color 0.2s' }}
            >
              <span
                className="absolute rounded-full"
                style={{ width: 14, height: 14, top: 2, left: autoSpin ? 18 : 2, backgroundColor: autoSpin ? '#FFB300' : '#888', transition: 'left 0.2s' }}
              />
            </span>
            Auto-spin
          </button>
          <input
            type="number"
            min={1}
            max={100}
            disabled={autoSpin}
            value={autoSpinCount}
            onChange={(e) => setAutoSpinCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className="w-16 text-center rounded-md py-1 text-xs font-mono disabled:opacity-40 flex-shrink-0"
            style={{ backgroundColor: '#1C1C1C', border: '1px solid #2A2A2A', color: '#fff' }}
          />
          <button
            onClick={() => setPaytableOpen(true)}
            className="flex items-center gap-1 text-xs flex-shrink-0"
            style={{ color: '#666' }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 14 }} />
            Paytable
          </button>
        </div>
      </div>

      {/* History pills */}
      <div className="w-full px-4 mt-3 mb-3" style={{ maxWidth: 420 }}>
        <div className="text-[10px] tracking-widest mb-1.5" style={{ color: '#666' }}>ROUND HISTORY</div>
        <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
          {history.length === 0 && <span className="text-xs italic" style={{ color: '#555' }}>No spins yet</span>}
          {history.map((h) => (
            <div
              key={h.id}
              className="ff-pill flex items-center justify-center px-2 h-7 rounded-full text-[10px] font-bold font-mono"
              style={{
                animation: 'ff-pill-in 0.25s ease-out',
                backgroundColor: h.win > 0 ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${h.win > 0 ? 'rgba(0,230,118,0.4)' : 'rgba(255,255,255,0.12)'}`,
                color: h.win > 0 ? '#00E676' : '#666',
              }}
            >
              {h.win > 0 ? `+${fmt(h.win)}` : '—'}
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] tracking-wide text-center pb-3 px-4" style={{ color: '#333' }}>
        Demo credits only · No real money involved · Play responsibly
      </div>

      {/* Paytable modal */}
      {paytableOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPaytableOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl p-4 w-full max-w-sm flex flex-col gap-3"
            style={{ backgroundColor: '#111111', border: '1px solid rgba(255,179,0,0.25)', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold" style={{ color: '#FFB300' }}>Paytable</span>
              <button onClick={() => setPaytableOpen(false)} aria-label="Close">
                <CloseIcon sx={{ fontSize: 16 }} style={{ color: '#888' }} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {FRUITS.map((f) => (
                <div
                  key={f.emoji}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <span className="text-lg">{f.emoji}</span>
                  <span className="font-mono" style={{ color: '#FFB300' }}>{f.value}× bet</span>
                </div>
              ))}
            </div>

            <div className="text-xs flex flex-col gap-1 mt-1" style={{ color: '#aaa' }}>
              <div className="flex items-center gap-1.5" style={{ color: '#FFB300' }}>
                <EmojiEventsIcon sx={{ fontSize: 14 }} />
                <span className="font-semibold">How wins work</span>
              </div>
              <p>Match 3 of the same fruit across a payline to win. Top, middle, and bottom rows pay 1× the fruit's value; both diagonals pay 1.5×. Multiple lines can win on the same spin.</p>
            </div>

            <p className="text-[10px] mt-1" style={{ color: '#555' }}>
              Demo game — balances and payouts are simulated locally and are not real money.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}