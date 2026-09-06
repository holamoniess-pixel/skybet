import { useState, useRef, useEffect, useCallback } from 'react';
import { useCountry } from '../hooks/useCountry';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DiamondIcon from '@mui/icons-material/Diamond';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PublicIcon from '@mui/icons-material/Public';
import ShieldIcon from '@mui/icons-material/Shield';
import BoltIcon from '@mui/icons-material/Bolt';
import { TOKEN_KEY as SESSION_TOKEN_KEY, USER_KEY as SESSION_USER_KEY } from '../utils/session';

/* =========================================================================
   VAULT MINES — server-integrated, currency-aware
   ------------------------------------------------------------------------
     - No local RNG for mine layout. The server freezes the layout at
       /start and only ever reveals what it already decided.
     - Balance comes from the wallet, not an in-memory demo number.
     - Fairness is a real commit/reveal: commitHash is shown while the
       round is live, serverSeed is revealed once it's settled, and
       hashing serverSeed + userId + roundId (SHA-256) should reproduce
       commitHash — that's the actual guarantee, not a cosmetic one.
     - CURRENCY DETECTION: on mount, IP geolocation (ipapi.co) resolves
       the visitor's country/currency, and a live USD-based FX table
       (open.er-api.com) is fetched alongside it. The result is cached in
       a module-level variable — genuinely "in memory" for the life of
       the page — so re-opening the game doesn't re-hit either API.
     - Every ordinary amount (balance, bet, payouts) is a SYMBOL-SWAP
       ONLY: a GHS amount of 150 is shown as "150" with whatever the
       visitor's local currency symbol is — no FX math, 1 cedi is
       display-equivalent to 1 of the local unit. The one exception is
       the minimum stake notice, which is a REAL conversion: it's fixed
       at 150 GHS, shown as-is for Ghanaian visitors or converted at the
       live rate for everyone else — because that number has to reflect
       an actual floor, not just a relabeled figure.
     - Fallbacks: if geolocation fails, the visitor is treated as GHS
       (no conversion needed, no badge shown). If the live FX fetch
       fails, a fixed approximate GHS-per-USD rate is used just for the
       minimum-stake conversion so the notice still shows something
       sane instead of breaking.
   The vault-feed ticker stays as pure client-side flavor — it never
   touches money and isn't meant to be real.
   ========================================================================= */

// ---------------------------------------------------------------------------
// API client — mirrors SpeedBetAPI's conventions (same token key & base
// URL) so this widget shares a session with the rest of the app.
// ---------------------------------------------------------------------------
const API_BASE = 'https://futballbackend-iw9o.onrender.com/api';
// Unified SkyBet key — see src/utils/session.ts. Was 'accessToken',
// which stopped matching the moment the token was renamed.
const TOKEN_KEY = SESSION_TOKEN_KEY;

function getToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  return t && t !== 'undefined' && t !== 'null' ? t : null;
}

class ApiError extends Error {}

async function apiRequest<T>(path: string, body?: unknown): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR');
  }

  if (res.status === 401) {
    [localStorage, sessionStorage].forEach((s) => {
      s.removeItem(TOKEN_KEY);
      s.removeItem(SESSION_USER_KEY);
    });
    throw new ApiError('SESSION_EXPIRED');
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.message ?? err.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message);
  }

  const json = await res.json();
  return (json?.data !== undefined ? json.data : json) as T;
}

interface WalletResponse {
  balance: number;
}
interface StartResponse {
  roundId: string;
  commitHash: string;
  walletBalance: number;
  stake: number;
  bombCount: number;
  diamondsFound: number;
  multiplier: number;
  potentialPayout: number;
}
interface RevealResponse {
  result: 'SAFE' | 'BOMB' | 'AUTO_WIN';
  diamondsFound: number;
  multiplier: number;
  potentialPayout: number;
  bombPositions: number[] | null;
  serverSeed: string | null;
  payout: number | null;
  newBalance: number;
}
interface CashoutResponse {
  payout: number;
  multiplier: number;
  bombPositions: number[];
  serverSeed: string;
  newBalance: number;
}

const MinesAPI = {
  wallet: () => apiRequest<WalletResponse>('/wallet'),
  start: (payload: { stake: number; bombCount: number }) =>
    apiRequest<StartResponse>('/games/mines/start', payload),
  reveal: (payload: { roundId: string; tileIdx: number }) =>
    apiRequest<RevealResponse>('/games/mines/reveal', payload),
  cashout: (payload: { roundId: string }) =>
    apiRequest<CashoutResponse>('/games/mines/cashout', payload),
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRID_SIZE = 25;
const GRID_COLS = 5;
const MIN_MINES = 1;
const MAX_MINES = 24;

/* ---------------------------------------------------------------------------
   Currency — driven by the REGISTERED country
   ---------------------------------------------------------------------------
   Replaced: a module-cached useCurrency() that hit ipapi.co for the visitor's
   currency, then open.er-api.com for a USD-based FX table, and converted a
   fixed 150 GHS minimum into local money at the live rate.

   Three things were wrong with that:
     1. ipapi.co reports where the REQUEST comes from, which contradicted the
        country the player registered with (VPN, roaming, carrier egress).
     2. The 150 GHS floor was re-derived from a live rate, so the minimum
        moved between sessions — and could move mid-session on a remount.
     3. It blocked the first paint on two network calls, during which every
        figure rendered as "GHS …".

   Now: one lookup against the shared registry, correct on first paint, no
   network at all. Under the parity rule (1 cedi = 1 naira) there is nothing
   to convert — the stake floor is a flat per-country number and only the
   symbol changes. The returned shape is unchanged so the component below
   needs no edits beyond the floor now being dynamic.
   ------------------------------------------------------------------------- */

function useCurrency() {
  const { country, fmt } = useCountry();

  const format = useCallback((amount: number) => fmt(amount), [fmt]);

  // Kept for the "minimum stake" notice. No FX step any more — the floor is
  // already denominated in the player's own currency.
  const formatMinStakeEquivalent = useCallback(
    () => fmt(country.minStake, 0),
    [fmt, country.minStake],
  );

  return {
    loading: false,
    countryName: country.name as string | null,
    currencyCode: country.currency,
    rates: null as Record<string, number> | null,
    minStake: country.minStake,
    format,
    formatMinStakeEquivalent,
  };
}

type Phase = 'IDLE' | 'ACTIVE' | 'BUSTED' | 'CASHED';
type TileVisual = 'hidden' | 'diamond' | 'bomb' | 'bomb-ghost' | 'diamond-ghost';

interface FairnessInfo {
  roundId: string;
  commitHash: string;
  serverSeed: string | null;
}

interface FeedItem {
  id: number;
  name: string;
  bombs: number;
  amount: number;
  won: boolean;
}

const FEED_NAMES = [
  'quiet_ace', 'bomb_dodger', 'the_gambler', 'icequeen', 'lowroller',
  'clutch_kofi', 'diamond_dan', 'yolo_ama', 'steady_hands', 'riskitall',
  'ninetylives', 'coldstreak', 'safebets', 'greedy_greg', 'lucky7',
];

// Client-side display only — must match MinesGameService.calcMultiplier()
// exactly, used before a round starts to preview "next tile" value.
function getMultiplier(diamonds: number, bombs: number, total = GRID_SIZE): number {
  if (diamonds === 0) return 1;
  const safe = total - bombs;
  let prob = 1;
  for (let i = 0; i < diamonds; i++) prob *= (safe - i) / (total - i);
  return Math.round((1 / prob) * 0.97 * 100) / 100;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function DiamondTileIcon() {
  return (
    <svg viewBox="0 0 100 100" style={{ width: '58%', height: '58%', filter: 'drop-shadow(0 0 8px rgba(94,200,255,0.75))' }}>
      <defs>
        <linearGradient id="vm-dg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eaf9ff" />
          <stop offset="30%" stopColor="#8fdcff" />
          <stop offset="60%" stopColor="#5ec8ff" />
          <stop offset="100%" stopColor="#1b7fc4" />
        </linearGradient>
        <linearGradient id="vm-dg2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f5feff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1b9de0" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <polygon points="50,5 90,35 50,95 10,35" fill="url(#vm-dg1)" />
      <polygon points="50,5 90,35 50,35" fill="url(#vm-dg2)" opacity="0.6" />
      <polygon points="50,5 10,35 50,35" fill="#eaf9ff" opacity="0.25" />
      <polygon points="10,35 50,95 50,65" fill="#155f92" opacity="0.4" />
      <polygon points="90,35 50,95 50,65" fill="#1b7fc4" opacity="0.5" />
      <polygon points="50,35 70,42 50,65 30,42" fill="#8fdcff" opacity="0.3" />
      <line x1="92" y1="28" x2="98" y2="22" stroke="#dff5ff" strokeWidth="1" opacity="0.7" />
      <line x1="94" y1="22" x2="98" y2="28" stroke="#dff5ff" strokeWidth="1" opacity="0.7" />
      <polygon points="50,5 90,35 50,95 10,35" fill="none" stroke="#dff5ff" strokeWidth="0.8" opacity="0.6" />
      <line x1="10" y1="35" x2="90" y2="35" stroke="#eaf9ff" strokeWidth="0.6" opacity="0.4" />
    </svg>
  );
}

function BombTileIcon() {
  return (
    <svg viewBox="0 0 100 100" style={{ width: '56%', height: '56%', filter: 'drop-shadow(0 0 9px rgba(255,77,77,0.85))' }}>
      <defs>
        <radialGradient id="vm-bg1" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#585858" />
          <stop offset="100%" stopColor="#0e0e0e" />
        </radialGradient>
      </defs>
      <circle cx="72" cy="20" r="5" fill="#ffb020" opacity="0.9" />
      <path d="M60,32 Q66,20 72,20" fill="none" stroke="#8a8a8a" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="58" r="30" fill="url(#vm-bg1)" />
      <rect x="45" y="26" width="6" height="10" rx="3" fill="#666" />
      <circle cx="20" cy="48" r="3.5" fill="#555" />
      <circle cx="76" cy="48" r="3.5" fill="#555" />
      <circle cx="28" cy="30" r="3" fill="#555" />
      <circle cx="68" cy="30" r="3" fill="#555" />
      <circle cx="22" cy="68" r="3" fill="#555" />
      <circle cx="74" cy="68" r="3" fill="#555" />
      <circle cx="48" cy="87" r="3.5" fill="#555" />
      <ellipse cx="38" cy="46" rx="8" ry="5" fill="#fff" opacity="0.12" transform="rotate(-30,38,46)" />
      <line x1="42" y1="52" x2="35" y2="62" stroke="#ff4d4d" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MinesGame({ onExit }: { onExit: () => void }) {
  const currency = useCurrency();
  // Per-country stake floor, replacing the old fixed minStake constant.
  const minStake = currency.minStake;

  // Wallet — a real balance from the server, always in GHS.
  const [balance, setBalance] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);

  // Round config — betAmount is always a GHS figure under the hood,
  // however it's currently being *displayed*.
  const [betAmount, setBetAmount] = useState(minStake);
  const [bombCount, setBombCount] = useState(3);

  // Round state
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [lockedBet, setLockedBet] = useState(0);
  const [lockedBombs, setLockedBombs] = useState(3);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [diamonds, setDiamonds] = useState(0);
  const [currentMult, setCurrentMult] = useState(1);
  const [potentialPayout, setPotentialPayout] = useState(0);
  const [tileVisuals, setTileVisuals] = useState<Record<number, TileVisual>>({});

  const [message, setMessage] = useState('Set your stake, pick your mines, and hit Place Bet.');
  const [history, setHistory] = useState<{ won: boolean; profit: number }[]>([]);
  const [fairness, setFairness] = useState<FairnessInfo>({ roundId: '', commitHash: '', serverSeed: null });
  const [fairnessOpen, setFairnessOpen] = useState(false);
  const [flash, setFlash] = useState<'win' | 'lose' | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  // In-flight guards — block double-taps during a round-trip.
  const [placing, setPlacing] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);

  const balanceRef = useRef(balance);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  const feedIdRef = useRef(0);
  const feedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Full clamp — enforces BOTH the floor (min stake) and the ceiling
  // (balance). Used for deliberate actions (presets, ½, MAX, on blur,
  // and right before the bet is actually sent to the server).
  const clampBetFull = useCallback(
    (v: number) => Math.max(minStake, Math.min(Math.floor(v), Math.max(minStake, balanceRef.current))),
    []
  );

  // Upper-bound-only clamp — used while the person is actively typing,
  // so hitting the minimum floor doesn't yank the field mid-keystroke
  // (e.g. typing "1" then "5" then "0" to reach 150 would otherwise snap
  // to 150 after the very first digit).
  const clampBetTyping = useCallback(
    (v: number) => Math.max(0, Math.min(Math.floor(v), Math.max(minStake, balanceRef.current))),
    []
  );

  // ── Load wallet on mount ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await MinesAPI.wallet();
        setBalance(parseFloat(String(data.balance)));
        setAuthReady(true);
      } catch (err) {
        setAuthError(
          err instanceof ApiError && err.message === 'SESSION_EXPIRED'
            ? 'Sign in to play Vault Mines.'
            : 'Could not reach the server — check your connection and try again.'
        );
      }
    })();
  }, []);

  const adjustBetPreset = (amt: 'half' | 'max' | number) => {
    if (phase === 'ACTIVE') return;
    if (amt === 'half') setBetAmount(clampBetFull(balanceRef.current / 2));
    else if (amt === 'max') setBetAmount(clampBetFull(balanceRef.current));
    else setBetAmount(clampBetFull(amt));
  };

  const adjMines = (delta: number) => {
    if (phase === 'ACTIVE') return;
    setBombCount((b) => Math.max(MIN_MINES, Math.min(MAX_MINES, b + delta)));
  };

  // ── Vault feed — fake other-player rounds, pure flavor, no money ───
  const spawnFeedTick = useCallback(() => {
    const bombs = 1 + Math.floor(Math.random() * 15);
    const won = Math.random() < 0.55;
    const amount = Math.floor(Math.random() * 300 + 10);
    const item: FeedItem = {
      id: ++feedIdRef.current,
      name: FEED_NAMES[Math.floor(Math.random() * FEED_NAMES.length)],
      bombs,
      amount,
      won,
    };
    setFeed((prev) => [item, ...prev].slice(0, 5));
    setTimeout(() => setFeed((prev) => prev.filter((x) => x.id !== item.id)), 4200);
  }, []);

  useEffect(() => {
    feedTimerRef.current = setInterval(spawnFeedTick, 2600);
    return () => { if (feedTimerRef.current) clearInterval(feedTimerRef.current); };
  }, [spawnFeedTick]);

  function handleApiError(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.message === 'SESSION_EXPIRED') {
      setAuthReady(false);
      setAuthError('Your session expired. Please sign in again.');
      return;
    }
    setMessage(err instanceof Error ? err.message : fallback);
  }

  // ── Place bet: opens the round server-side, nothing revealed yet ──
  const placeBet = useCallback(async () => {
    if (phase === 'ACTIVE' || placing) return;
    const bet = clampBetFull(betAmount);
    if (bet > balanceRef.current) {
      setMessage('Insufficient balance.');
      return;
    }
    if (balanceRef.current < minStake) {
      setMessage(`Minimum stake is ${currency.loading ? 'GHS 150' : currency.formatMinStakeEquivalent()} — your balance is below that.`);
      return;
    }

    setPlacing(true);
    try {
      const res = await MinesAPI.start({ stake: bet, bombCount });

      setRoundId(res.roundId);
      setFairness({ roundId: res.roundId, commitHash: res.commitHash, serverSeed: null });
      setBalance(res.walletBalance);
      setLockedBet(res.stake);
      setLockedBombs(res.bombCount);
      setRevealed([]);
      setDiamonds(0);
      setCurrentMult(1);
      setPotentialPayout(res.stake);
      setTileVisuals({});
      setPhase('ACTIVE');
      setMessage(`Round live — ${res.bombCount} mine${res.bombCount !== 1 ? 's' : ''} hidden. Pick a tile.`);
    } catch (err) {
      handleApiError(err, 'Could not start the round.');
    } finally {
      setPlacing(false);
    }
  }, [phase, placing, betAmount, bombCount, clampBetFull, currency]);

  // ── Reveal a tile ───────────────────────────────────────────────────
  const revealTile = useCallback(
    async (idx: number) => {
      if (phase !== 'ACTIVE' || revealing || !roundId) return;
      if (revealed.includes(idx)) return;

      setRevealing(true);
      try {
        const res = await MinesAPI.reveal({ roundId, tileIdx: idx });

        if (res.result === 'BOMB') {
          setTileVisuals((v) => {
            const next = { ...v, [idx]: 'bomb' as TileVisual };
            (res.bombPositions ?? []).forEach((b) => {
              if (b !== idx && next[b] === undefined) next[b] = 'bomb-ghost';
            });
            return next;
          });
          setDiamonds(res.diamondsFound);
          setPhase('BUSTED');
          setLosses((l) => l + 1);
          setStreak(0);
          setFlash('lose');
          setBalance(res.newBalance);
          setFairness((f) => ({ ...f, serverSeed: res.serverSeed }));
          setHistory((h) => [{ won: false, profit: -lockedBet }, ...h].slice(0, 14));
          setMessage(`Boom — you hit a mine. Lost ${currency.loading ? `GHS ${lockedBet.toFixed(2)}` : currency.format(lockedBet)}.`);
          setTimeout(() => setFlash(null), 700);
          setTimeout(() => {
            setPhase('IDLE');
            setRoundId(null);
            setMessage('Set your stake, pick your mines, and hit Place Bet.');
          }, 2600);
          return;
        }

        const nextRevealed = [...revealed, idx];
        setRevealed(nextRevealed);
        setTileVisuals((v) => ({ ...v, [idx]: 'diamond' }));
        setDiamonds(res.diamondsFound);
        setCurrentMult(res.multiplier);
        setPotentialPayout(res.potentialPayout ?? lockedBet * res.multiplier);

        if (res.result === 'AUTO_WIN') {
          finishWinFromServer(res, nextRevealed);
        } else {
          const payoutLabel = currency.loading
            ? `GHS ${res.potentialPayout.toFixed(2)}`
            : currency.format(res.potentialPayout);
          setMessage(`Diamond! ${res.multiplier.toFixed(2)}× — cash out at ${payoutLabel}.`);
        }
      } catch (err) {
        handleApiError(err, 'Could not reveal that tile.');
      } finally {
        setRevealing(false);
      }
    },
    [phase, revealing, roundId, revealed, lockedBet, currency]
  );

  function finishWinFromServer(res: RevealResponse | CashoutResponse, revealedSet: number[]) {
    const payout = res.payout ?? 0;
    setWins((w) => w + 1);
    setStreak((s) => s + 1);
    setFlash('win');
    setPhase('CASHED');
    setBalance(res.newBalance);
    setFairness((f) => ({ ...f, serverSeed: res.serverSeed ?? f.serverSeed }));
    setHistory((h) => [{ won: true, profit: payout - lockedBet }, ...h].slice(0, 14));
    setMessage(`Cashed out! Won ${currency.loading ? `GHS ${payout.toFixed(2)}` : currency.format(payout)} (${res.multiplier.toFixed(2)}×).`);

    setTileVisuals((v) => {
      const next = { ...v };
      (res.bombPositions ?? []).forEach((b) => { if (next[b] === undefined) next[b] = 'bomb-ghost'; });
      for (let i = 0; i < GRID_SIZE; i++) {
        if (!revealedSet.includes(i) && !(res.bombPositions ?? []).includes(i) && next[i] === undefined) {
          next[i] = 'diamond-ghost';
        }
      }
      return next;
    });

    setTimeout(() => setFlash(null), 700);
    setTimeout(() => {
      setPhase('IDLE');
      setRoundId(null);
      setMessage('Set your stake, pick your mines, and hit Place Bet.');
    }, 2600);
  }

  const cashOut = useCallback(async () => {
    if (phase !== 'ACTIVE' || diamonds === 0 || cashingOut || !roundId) return;
    setCashingOut(true);
    try {
      const res = await MinesAPI.cashout({ roundId });
      finishWinFromServer(res, revealed);
    } catch (err) {
      handleApiError(err, 'Could not cash out. Your round is still open — try again.');
    } finally {
      setCashingOut(false);
    }
  }, [phase, diamonds, cashingOut, roundId, revealed, lockedBet, currency]);

  const primaryAction = () => {
    if (phase === 'ACTIVE') cashOut();
    else placeBet();
  };

  const safeLeft = GRID_SIZE - lockedBombs - diamonds;
  const totalLeft = GRID_SIZE - diamonds;
  const safePct =
    phase === 'ACTIVE' && totalLeft > 0
      ? Math.round((safeLeft / totalLeft) * 100)
      : Math.round(((GRID_SIZE - bombCount) / GRID_SIZE) * 100);
  const nextTileWin =
    phase === 'ACTIVE' ? lockedBet * getMultiplier(diamonds + 1, lockedBombs) : betAmount * getMultiplier(1, bombCount);

  // Quick-stake presets — multiples of the real minimum so they're never
  // below the floor, displayed in whatever currency the visitor sees.
  const presetAmounts = [1, 2, 5, 10].map((m) => minStake * m);

  const AmountLabel = ({ ghs }: { ghs: number }) => (
    <>{currency.loading ? `GHS ${ghs.toFixed(2)}` : currency.format(ghs)}</>
  );

  const MinStakeNotice = () => (
    <>
      {currency.loading ? 'GHS 150' : currency.formatMinStakeEquivalent()}
      {/* The old "(GHS 150)" base-currency hint is gone: there is no base
          currency to convert from any more, so showing one would be noise. */}
    </>
  );

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col items-center"
      style={{ backgroundColor: '#070b13', color: '#e6f2fb', border: '1px solid rgba(94,200,255,0.15)', minHeight: '700px' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@700;900&display=swap');
        @keyframes vm-flash-win  { 0% { opacity: 0; background: radial-gradient(circle, rgba(94,200,255,0.30), transparent 70%);} 30% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes vm-flash-lose { 0% { opacity: 0; background: radial-gradient(circle, rgba(255,77,77,0.4), transparent 70%);} 30% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes vm-diamond-in { 0% { transform: scale(0.5) rotateY(90deg); opacity: 0; } 60% { transform: scale(1.1) rotateY(-5deg); } 100% { transform: scale(1) rotateY(0deg); opacity: 1; } }
        @keyframes vm-bomb-in    { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes vm-pill-in    { from { transform: scale(0.4) rotate(-15deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes vm-shimmer    { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.55; } }
        @keyframes vm-top-glow  { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .vm-flash, .vm-pill, .vm-tile-inner, .vm-top-glow { animation: none !important; } }
      `}</style>

      {/* Signature top accent — a thin animated cyan seam, echoing the
          "commit hash" idea: a live, glowing line above the vault. */}
      <div
        className="vm-top-glow w-full"
        style={{ height: 2, background: 'linear-gradient(90deg, transparent, #5ec8ff, transparent)', animation: 'vm-top-glow 2.6s ease-in-out infinite' }}
      />

      {/* Header */}
      <div className="w-full flex items-center justify-between px-3 py-2.5 flex-shrink-0" style={{ backgroundColor: '#0b111c', borderBottom: '1px solid rgba(94,200,255,0.15)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <DiamondIcon sx={{ fontSize: 20, color: '#5ec8ff' }} />
          <span className="text-sm font-black truncate" style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.06em', color: '#eaf9ff' }}>
            VAULT MINES
          </span>
          {phase === 'ACTIVE' && (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'rgba(94,200,255,0.12)', color: '#5ec8ff', border: '1px solid rgba(94,200,255,0.35)' }}>
              <FiberManualRecordIcon sx={{ fontSize: 9 }} />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {!currency.loading && (
            <div
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
              style={{ backgroundColor: 'rgba(94,200,255,0.06)', border: '1px solid rgba(94,200,255,0.2)', color: '#8fdcff' }}
              title={currency.countryName ?? undefined}
            >
              <PublicIcon sx={{ fontSize: 12 }} />
              {currency.currencyCode}
            </div>
          )}
          <div className="flex flex-col items-end leading-none">
            <span className="text-[9px]" style={{ color: '#7a8aaa' }}>BALANCE</span>
            <span className="font-mono font-semibold text-sm" style={{ color: '#f5c518' }}>
              <AmountLabel ghs={balance} />
            </span>
          </div>
          <button onClick={onExit} aria-label="Back to lobby" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#141c2a', border: '1px solid #22304a', color: '#fff' }}>
            <CloseIcon sx={{ fontSize: 14 }} />
            <span className="hidden sm:inline">Back to lobby</span>
          </button>
        </div>
      </div>

      {/* Auth gate */}
      {authError && !authReady && (
        <div className="w-full mx-3 mt-3 px-4 py-3 rounded-lg text-sm text-center" style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', color: '#ff8f8f' }}>
          {authError}
        </div>
      )}

      {/* Stats strip */}
      <div className="flex items-center gap-0 mx-3 mt-3 mb-1 rounded-full px-4 py-1.5" style={{ backgroundColor: 'rgba(94,200,255,0.05)', border: '1px solid rgba(94,200,255,0.15)' }}>
        <div className="flex flex-col items-center px-4">
          <span className="flex items-center gap-1 text-[9px] tracking-widest" style={{ color: '#7a8aaa' }}>
            <ShieldIcon sx={{ fontSize: 10 }} /> WINS
          </span>
          <span className="text-sm font-bold" style={{ color: '#3ee08a' }}>{wins}</span>
        </div>
        <div className="w-px h-6" style={{ backgroundColor: 'rgba(94,200,255,0.15)' }} />
        <div className="flex flex-col items-center px-4">
          <span className="text-[9px] tracking-widest" style={{ color: '#7a8aaa' }}>LOSSES</span>
          <span className="text-sm font-bold" style={{ color: '#ff4d4d' }}>{losses}</span>
        </div>
        <div className="w-px h-6" style={{ backgroundColor: 'rgba(94,200,255,0.15)' }} />
        <div className="flex flex-col items-center px-4">
          <span className="text-[9px] tracking-widest" style={{ color: '#7a8aaa' }}>STREAK</span>
          <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>
            {streak >= 2 ? <span className="inline-flex items-center gap-0.5"><WhatshotIcon sx={{ fontSize: 13 }} />×{streak}</span> : '—'}
          </span>
        </div>
      </div>

      {/* Grid + floating HUD */}
      <div className="relative mt-2 w-full px-4" style={{ maxWidth: 380 }}>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(94,200,255,0.12)', border: '1px solid rgba(94,200,255,0.3)', color: '#8fdcff' }}>
            <TrendingUpIcon sx={{ fontSize: 14 }} />
            {currentMult.toFixed(2)}×
          </div>
          <div className="text-xs font-semibold" style={{ color: diamonds > 0 ? '#3ee08a' : '#7a8aaa' }}>
            {diamonds > 0 ? <>+<AmountLabel ghs={potentialPayout - lockedBet} /></> : 'no diamonds yet'}
          </div>
          <div className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
            next <AmountLabel ghs={nextTileWin} />
          </div>
        </div>

        <div
          className="grid gap-1.5 rounded-xl p-2.5 relative"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, backgroundColor: '#0b111c', border: '1px solid rgba(94,200,255,0.15)' }}
        >
          {Array.from({ length: GRID_SIZE }, (_, i) => {
            const visual: TileVisual = tileVisuals[i] ?? 'hidden';
            const clickable = phase === 'ACTIVE' && visual === 'hidden' && !revealing;
            const dead = (phase === 'BUSTED' || phase === 'CASHED') && visual === 'hidden';
            return (
              <button
                key={i}
                onClick={() => revealTile(i)}
                disabled={!clickable}
                className="aspect-square rounded-lg flex items-center justify-center relative overflow-hidden"
                style={{
                  border: `1px solid ${visual === 'diamond' ? '#5ec8ff' : visual === 'bomb' ? '#ff4d4d' : 'rgba(94,200,255,0.15)'}`,
                  background:
                    visual === 'diamond' ? 'linear-gradient(135deg,#0a2230,#0d3244)' :
                    visual === 'bomb' ? 'linear-gradient(135deg,#2a0a0a,#3d0f0f)' :
                    visual === 'bomb-ghost' ? 'linear-gradient(135deg,#1a0808,#250d0d)' :
                    '#111a29',
                  opacity: visual === 'bomb-ghost' ? 0.55 : visual === 'diamond-ghost' ? 0.35 : dead ? 0.5 : 1,
                  cursor: clickable ? 'pointer' : dead ? 'not-allowed' : 'default',
                  animation:
                    visual === 'diamond' ? 'vm-diamond-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' :
                    visual === 'bomb' ? 'vm-bomb-in 0.3s ease forwards' : undefined,
                  boxShadow:
                    visual === 'diamond' ? '0 0 16px rgba(94,200,255,0.3)' :
                    visual === 'bomb' ? '0 0 16px rgba(255,77,77,0.4)' : 'none',
                }}
              >
                {(visual === 'diamond' || visual === 'diamond-ghost') && <DiamondTileIcon />}
                {(visual === 'bomb' || visual === 'bomb-ghost') && <BombTileIcon />}
                {visual === 'hidden' && (
                  <div
                    className="vm-tile-inner"
                    style={{
                      width: '36%', height: '36%', background: '#5ec8ff', opacity: 0.25,
                      clipPath: 'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)',
                      animation: 'vm-shimmer 3s ease-in-out infinite',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {flash && (
          <div className="vm-flash absolute inset-0 rounded-xl pointer-events-none" style={{ animation: `vm-flash-${flash} 0.7s ease-out forwards` }} />
        )}
      </div>

      {/* Safe-tile bar */}
      <div className="w-full px-4 mt-3" style={{ maxWidth: 380 }}>
        <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: '#7a8aaa' }}>
          <span>Safe tile probability</span>
          <span style={{ color: '#3ee08a', fontWeight: 600 }}>{safePct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#111a29', border: '1px solid rgba(94,200,255,0.1)' }}>
          <div className="h-full rounded-full" style={{ width: `${safePct}%`, background: 'linear-gradient(90deg,#3ee08a,#4ade80)', transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      </div>

      {/* Result banner */}
      <div className="h-7 flex items-center justify-center mt-2 px-4 text-center">
        <span className="text-xs sm:text-sm font-semibold" style={{ color: phase === 'BUSTED' ? '#ff4d4d' : phase === 'CASHED' ? '#3ee08a' : '#8fdcff' }}>
          {message}
        </span>
      </div>

      {/* Control deck */}
      <div className="w-full px-4 flex flex-col gap-3 mt-1" style={{ maxWidth: 380 }}>
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] tracking-widest" style={{ color: '#7a8aaa' }}>BET</span>
          <span className="text-[10px]" style={{ color: '#556' }}>
            Min <MinStakeNotice />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center flex-1 rounded-md overflow-hidden" style={{ backgroundColor: 'rgba(94,200,255,0.05)', border: '1px solid rgba(94,200,255,0.3)' }}>
            <span className="px-2 font-bold" style={{ color: '#f5c518', borderRight: '1px solid rgba(94,200,255,0.15)' }}>
              {currency.loading ? 'GHS' : currency.currencyCode}
            </span>
            <input
              type="number"
              min={minStake}
              disabled={phase === 'ACTIVE'}
              value={betAmount}
              onChange={(e) => setBetAmount(clampBetTyping(parseFloat(e.target.value) || 0))}
              onBlur={() => setBetAmount((v: number) => clampBetFull(v))}
              className="flex-1 min-w-0 bg-transparent outline-none text-right py-1.5 px-2 font-bold disabled:opacity-50"
              style={{ color: '#f5c518' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {presetAmounts.map((amt) => {
            const active = betAmount === amt;
            return (
              <button
                key={amt}
                disabled={phase === 'ACTIVE'}
                onClick={() => adjustBetPreset(amt)}
                className="py-1.5 rounded-md text-xs font-semibold disabled:opacity-40 truncate px-1"
                style={{
                  backgroundColor: active ? 'rgba(94,200,255,0.14)' : 'rgba(94,200,255,0.05)',
                  border: `1px solid ${active ? '#5ec8ff' : 'rgba(94,200,255,0.12)'}`,
                  color: active ? '#8fdcff' : '#9fb3cf',
                }}
              >
                <AmountLabel ghs={amt} />
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button disabled={phase === 'ACTIVE'} onClick={() => adjustBetPreset('half')} className="py-1.5 rounded-md text-xs font-semibold disabled:opacity-40" style={{ backgroundColor: 'rgba(94,200,255,0.05)', border: '1px solid rgba(94,200,255,0.12)', color: '#9fb3cf' }}>
            ½ BAL
          </button>
          <button disabled={phase === 'ACTIVE'} onClick={() => adjustBetPreset('max')} className="py-1.5 rounded-md text-xs font-semibold disabled:opacity-40" style={{ backgroundColor: 'rgba(94,200,255,0.05)', border: '1px solid rgba(94,200,255,0.12)', color: '#9fb3cf' }}>
            MAX
          </button>
        </div>

        {/* Mines count */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(255,77,77,0.05)', border: '1px solid rgba(255,77,77,0.15)' }}>
          <button disabled={phase === 'ACTIVE'} onClick={() => adjMines(-1)} className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-bold disabled:opacity-40" style={{ border: '1px solid rgba(255,77,77,0.3)', color: '#ff4d4d' }}>
            −
          </button>
          <div className="flex-1 text-center">
            <div className="font-black text-xl leading-none" style={{ fontFamily: "'Orbitron', sans-serif", color: '#ff4d4d' }}>{bombCount}</div>
            <div className="text-[9px] tracking-widest" style={{ color: '#7a8aaa' }}>MINES</div>
          </div>
          <button disabled={phase === 'ACTIVE'} onClick={() => adjMines(1)} className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-bold disabled:opacity-40" style={{ border: '1px solid rgba(255,77,77,0.3)', color: '#ff4d4d' }}>
            +
          </button>
        </div>
        <input
          type="range"
          min={MIN_MINES}
          max={MAX_MINES}
          value={bombCount}
          disabled={phase === 'ACTIVE'}
          onChange={(e) => setBombCount(+e.target.value)}
          className="w-full disabled:opacity-40"
          style={{ accentColor: '#ff4d4d', height: 4 }}
        />

        {/* Primary action */}
        <button
          onClick={primaryAction}
          disabled={
            !authReady ||
            phase === 'BUSTED' ||
            phase === 'CASHED' ||
            placing ||
            cashingOut ||
            (phase === 'IDLE' && (betAmount > balance || balance < minStake))
          }
          className="py-3.5 rounded-lg font-extrabold text-sm uppercase tracking-[3px] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: phase === 'ACTIVE'
              ? 'linear-gradient(135deg,#1fae63,#3ee08a)'
              : 'linear-gradient(135deg,#1b7fc4,#5ec8ff)',
            color: '#04101a',
            boxShadow: phase === 'ACTIVE' ? '0 4px 24px rgba(62,224,138,0.3)' : '0 4px 24px rgba(94,200,255,0.3)',
          }}
        >
          {phase === 'ACTIVE' && !cashingOut && <BoltIcon sx={{ fontSize: 16 }} />}
          {phase === 'BUSTED' ? 'ROUND OVER…'
            : phase === 'CASHED' ? 'RESETTING…'
            : placing ? 'PLACING BET…'
            : cashingOut ? 'CASHING OUT…'
            : phase === 'ACTIVE' ? <>CASH OUT — <AmountLabel ghs={potentialPayout} /></>
            : 'PLACE BET'}
        </button>

        {/* Fairness link */}
        <button onClick={() => setFairnessOpen(true)} className="flex items-center justify-center gap-1 text-[10px] py-1" style={{ color: '#7a8aaa' }}>
          <InfoOutlinedIcon sx={{ fontSize: 12 }} />
          Round fairness details
        </button>
      </div>

      {/* History pills */}
      <div className="w-full px-4 mt-1 mb-3" style={{ maxWidth: 380 }}>
        <div className="text-[10px] tracking-widest mb-1.5" style={{ color: '#7a8aaa' }}>ROUND HISTORY</div>
        <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
          {history.length === 0 && <span className="text-xs italic" style={{ color: '#556' }}>No rounds yet</span>}
          {history.map((h, i) => (
            <div
              key={i}
              className="vm-pill px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{
                animation: 'vm-pill-in 0.25s ease-out',
                backgroundColor: h.won ? 'rgba(62,224,138,0.15)' : 'rgba(255,77,77,0.15)',
                border: `1px solid ${h.won ? 'rgba(62,224,138,0.4)' : 'rgba(255,77,77,0.4)'}`,
                color: h.won ? '#3ee08a' : '#ff4d4d',
              }}
            >
              {h.won ? <>💎 +<AmountLabel ghs={h.profit} /></> : <>💣 <AmountLabel ghs={h.profit} /></>}
            </div>
          ))}
        </div>
      </div>

      {/* Vault feed ticker — cosmetic only, not real money */}
      {feed.length > 0 && (
        <div className="w-full px-4 mb-3 flex flex-col gap-1" style={{ maxWidth: 380 }}>
          <div className="text-[10px] tracking-widest mb-0.5" style={{ color: '#7a8aaa' }}>VAULT FEED</div>
          {feed.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded" style={{ backgroundColor: 'rgba(94,200,255,0.04)', color: f.won ? '#3ee08a' : '#7a8aaa' }}>
              <EmojiEventsIcon sx={{ fontSize: 12 }} style={{ opacity: f.won ? 1 : 0.35 }} />
              {f.name} played {f.bombs} mines — {f.won ? <>won <AmountLabel ghs={f.amount} /></> : <>lost <AmountLabel ghs={f.amount} /></>}
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] tracking-wide text-center pb-3" style={{ color: '#333d4d' }}>
        RTP ~97% · odds tighten with fewer mines · Play responsibly
      </div>

      {/* Fairness modal */}
      {fairnessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setFairnessOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-xl p-4 w-full max-w-sm flex flex-col gap-2" style={{ backgroundColor: '#0b111c', border: '1px solid rgba(94,200,255,0.25)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold" style={{ color: '#5ec8ff' }}>Round fairness</span>
              <button onClick={() => setFairnessOpen(false)} aria-label="Close">
                <CloseIcon sx={{ fontSize: 16 }} style={{ color: '#7a8aaa' }} />
              </button>
            </div>
            <FairnessRow label="Round id" value={fairness.roundId || '—'} />
            <FairnessRow label="Commit hash" value={fairness.commitHash || '—'} />
            <FairnessRow label="Server seed" value={fairness.serverSeed ?? (fairness.roundId ? 'revealed after the round ends' : '—')} />
            <FairnessRow label="Mines this round" value={String(lockedBombs || bombCount)} />
            <p className="text-[10px] mt-1" style={{ color: '#556' }}>
              The commit hash is issued before you pick a tile. Once the round settles, the server seed is revealed —
              hashing serverSeed + your user id + the round id (SHA-256) reproduces the commit hash, proving the
              layout wasn't changed after the fact.
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
      <span style={{ color: '#7a8aaa' }}>{label}</span>
      <span className="font-mono truncate max-w-[220px]" style={{ color: '#ccd' }}>{value}</span>
    </div>
  );
}