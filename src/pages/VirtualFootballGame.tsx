import { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PublicIcon from '@mui/icons-material/Public';
import RefreshIcon from '@mui/icons-material/Refresh';
import FlagIcon from '@mui/icons-material/Flag';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import TimerIcon from '@mui/icons-material/Timer';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import { useCountry } from '../hooks/useCountry';
import { TOKEN_KEY as SESSION_TOKEN_KEY, USER_KEY as SESSION_USER_KEY } from '../utils/session';

/* =========================================================================
   VIRTUAL FOOTBALL — backend-integrated, MULTI-ROUND + SPORTSBOOK BOARD
   ------------------------------------------------------------------------
     - No local fake wallet, no local fake match outcome. Every bit of
       money movement and every match result comes from the real backend
       (com.speedbet.api.casinoGames.* — FootballGameController/Service).
     - SPORTSBOOK BOARD: generateMatchups() randomly pairs teams from the
       FULL roster (GET /teams) into fixture cards, grouped so a fixture
       NEVER crosses leagues — a Premier League team only ever plays
       another Premier League team, etc. Each card is laid out as
       "Team A  vs  Team B" with a compact 1X2-style odds card beside it
       — the two odds buttons (Home / Away) are always arranged in a row,
       at every breakpoint. Tap either side to add that pick to your bet
       slip, which pops open a bottom-sheet immediately (see below). The
       odds shown are a live PREVIEW (GET /odds) for display only; the
       real odds are generated and locked server-side the instant a bet
       is placed (see FootballGameService.play()) — this board is just a
       nicer way to pick who you're betting on, it doesn't change how
       odds are sourced or trusted.
     - LEAGUE FILTER (frontend-only grouping): TeamInfo now carries an
       optional `league` field. The board derives the distinct leagues
       present in whatever the backend returns and renders them as
       filter chips (Premier League, La Liga, Serie A, etc., "Other" for
       anything unlabeled). Selecting a league narrows both the fixture
       list AND which teams generateMatchups() is allowed to pair up.
       This is purely a display/pairing concern — nothing here talks to
       a new endpoint; it reads whatever `league` values GET /teams
       already returns, so it lights up automatically once the backend
       starts sending real league names.
     - BET SLIP POPUP: tapping odds adds/removes a selection AND opens a
       bottom-sheet ("slipModalOpen") showing the full current slip —
       team crests, market, editable stake, remove button, running
       total, and the Place Bet(s) button — all reachable without
       scrolling. Closing the sheet (✕ or tapping the backdrop) keeps
       every selection intact so you can go tap more odds; a floating
       "view slip" pill stays pinned at the bottom any time the sheet is
       closed and selections exist, so the slip is always one tap away.
       The pill itself is icon + count + total stake only — no label text.
     - BET SLIP / MULTI-SELECTION: instead of one active pick, selections
       accumulate in a bet slip (`betSlip`). Each entry is its own
       independent bet — its own market, its own stake, editable and
       removable independently of the others. Placing bets fires one
       /play call per slip entry and opens one round per entry, all at
       once, capped at MAX_CONCURRENT_ROUNDS combined with any already-
       live rounds.
     - MULTI-ROUND: each placed bet gets its own PlayResponse and its own
       local clock/reveal state in `roundsRef`. A "Live matches" strip
       lets you pick which one is shown on the pitch panel while others
       run in the background.
     - RESUME ON LOAD: pulls ALL open rounds via GET /open-rounds, not
       just the latest one, so a refresh doesn't drop any live bets.
     - PITCH VISIBILITY FIX (v2): the render loop is self-healing — every
       animation frame it checks the canvas's actual on-screen size and
       resyncs the backing store if it drifted, and it checks whether the
       currently-watched round's players/ball have been seeded yet and
       seeds them itself if not. Placing a bet also auto-switches to the
       Pitch tab on mobile.
     - PITCH VISUALS (v3): each side now fields 7 outfield markers in a
       staggered formation instead of 5, drawn with a radial gradient,
       jersey number, and a soft contact shadow. The pitch itself gets
       drawn corner-kick arcs at all four corners in addition to the
       decorative flag icons overlaid on top, and the ball is a shaded,
       stitched sphere instead of a flat circle.
     - LIVE MATCH STATS (cosmetic): each running round tracks a small
       cosmetic stat line — possession, shots, corners, cards — driven by
       the same event feed that already powered the "commentary" chips.
       This panel now renders directly under the pitch (both on desktop,
       where it sits under the pitch column, and on mobile inside the
       Pitch tab) rather than at the top of the betting panel. These
       stats are purely presentational, exactly like the pitch animation;
       the real score only ever comes from SettleResponse.
     - MINIMUM STAKE ENFORCEMENT: the minimum is enforced live, per slip
       entry, anchored to a fixed 115 GHS (Ghanaian cedis) rather than a
       USD figure — each stake field clamps back up to the minimum on
       blur, and the slip's "Place bets" button is disabled while any
       entry is below minimum.
     - Currency: every amount EXCEPT the minimum-stake notice is a plain
       symbol relabel (1 unit shown as "1" in the local currency's
       symbol, no FX math). The minimum stake is the one place that shows
       a REAL live-converted value: it's fixed at 115 GHS, shown as-is
       for Ghanaian cedis (GHS) or converted at the live rate for every
       other currency.
     - Match outcome is hidden until settle(): the pitch animation during
       "kickoff to final whistle" is cosmetic only. The real score only
       appears in the reveal sequence after /settle.
   ========================================================================= */

// ---------------------------------------------------------------------------
// Types — mirror the backend DTOs exactly (com.speedbet.api.casinoGames.*)
// ---------------------------------------------------------------------------
type BetType = 'home' | 'draw' | 'away' | 'over' | 'under';

interface OddsQuote {
  home: number;
  draw: number;
  away: number;
  over: number;
  under: number;
}

interface PlayResponse {
  roundId: string;
  walletBalance: number;
  stake: number;
  betType: BetType;
  odds: number;
  homeTeam: string;
  awayTeam: string;
  matchDurationSeconds: number;
}

interface SettleResponse {
  won: boolean;
  homeScore: number;
  awayScore: number;
  payout: number;
  newBalance: number;
}

interface RoundView {
  roundId: string;
  homeTeam: string;
  awayTeam: string;
  stake: number;
  betType: BetType;
  odds: number;
  settled: boolean;
}

interface HistoryEntry {
  home: string;
  away: string;
  score: string;
  won: boolean;
  at: string;
}

// Mirrors com.speedbet.api.casinoGames.Team (record: name, shortCode,
// strength, league). `league` is optional so this keeps working the moment
// the backend adds it, without a frontend deploy being a hard dependency.
interface TeamInfo {
  name: string;
  shortCode: string;
  strength: number;
  league?: string;
}

// ---------------------------------------------------------------------------
// footballApi — inlined. Talks directly to FootballGameController endpoints.
// ---------------------------------------------------------------------------
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'https://futballbackend-production-b1a0.up.railway.app/api';
// Unified SkyBet key — see src/utils/session.ts. Was 'accessToken',
// which stopped matching the moment the token was renamed.
const TOKEN_KEY = SESSION_TOKEN_KEY;

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  const text = await res.text();
  let body: ApiEnvelope<T> | null = null;
  try {
    body = text ? (JSON.parse(text) as ApiEnvelope<T>) : null;
  } catch {
    /* non-JSON body — leave body null */
  }

  if (res.status === 401) {
    [localStorage, sessionStorage].forEach((s) => {
      s.removeItem(TOKEN_KEY);
      s.removeItem(SESSION_USER_KEY);
    });
    throw new Error(body?.message ?? 'Your session has expired — please log in again.');
  }

  if (!res.ok || (body && body.success === false)) {
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }

  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }
  return (body as unknown as T) ?? (null as T);
}

const footballApi = {
  getBalance: () => apiFetch<{ balance: number }>('/games/football/balance'),
  previewOdds: () => apiFetch<OddsQuote>('/games/football/odds'),
  teams: () => apiFetch<TeamInfo[]>('/games/football/teams'),

  play: (payload: { stake: number; betType: BetType; odds: number; homeTeam?: string; awayTeam?: string }) =>
    apiFetch<PlayResponse>('/games/football/play', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  settle: (payload: { roundId: string }) =>
    apiFetch<SettleResponse>('/games/football/settle', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  openRounds: () => apiFetch<RoundView[]>('/games/football/open-rounds'),

  history: (limit = 8) => apiFetch<HistoryEntry[]>(`/games/football/history?limit=${limit}`),
};

const QUICK_AMOUNTS_USD = [10, 25, 50, 100];
const MAX_CONCURRENT_ROUNDS = 6;

// Common leagues surface first, in this order; anything else (plus a
// catch-all "Other" bucket for teams with no league set yet) is sorted
// alphabetically after, with "Other" always last.
const LEAGUE_PRIORITY = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];

function sortLeagues(leagues: string[]): string[] {
  return [...leagues].sort((a, b) => {
    const ai = LEAGUE_PRIORITY.indexOf(a);
    const bi = LEAGUE_PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface BoardMatchup {
  id: string;
  home: TeamInfo;
  away: TeamInfo;
}

/** Pairs up every team in a single group (already same-league) into
 *  fixtures. Extracted so generateMatchups can call it once per league. */
function pairTeams(list: TeamInfo[]): { home: TeamInfo; away: TeamInfo }[] {
  if (list.length < 2) return [];
  const shuffled = shuffle(list);
  const pairs: { home: TeamInfo; away: TeamInfo }[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    pairs.push({ home: shuffled[i], away: shuffled[i + 1] });
  }
  // Odd team out (if the group size is odd) gets paired against a random
  // opponent from the same group so nobody is silently dropped.
  if (shuffled.length % 2 === 1 && shuffled.length >= 3) {
    const leftover = shuffled[shuffled.length - 1];
    const opponent = shuffled[Math.floor(Math.random() * (shuffled.length - 1))];
    pairs.push({ home: leftover, away: opponent });
  }
  return pairs;
}

/** Randomly pairs up teams into fixture cards for the sportsbook board.
 *  Teams are grouped by `league` first so a fixture NEVER crosses leagues
 *  (a Premier League side only ever plays another Premier League side),
 *  then the resulting fixtures across all groups are shuffled together for
 *  display order. Passing an already-filtered (single-league) list works
 *  the same way — it just ends up as one group.
 *  Display only — the actual matchup requested at play() time is these
 *  exact home/away names, but the odds shown here are a preview; real
 *  odds are generated fresh server-side when the bet is placed. */
function generateMatchups(teamsList: TeamInfo[]): BoardMatchup[] {
  const groups = new Map<string, TeamInfo[]>();
  teamsList.forEach((t) => {
    const key = t.league || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  });

  let idx = 0;
  let all: BoardMatchup[] = [];
  groups.forEach((group) => {
    pairTeams(group).forEach((p) => {
      all.push({ id: `${p.home.name}::${p.away.name}::${idx++}`, home: p.home, away: p.away });
    });
  });
  return shuffle(all);
}

// ---------------------------------------------------------------------------
// Bet slip — each selection is an independent bet with its own stake
// ---------------------------------------------------------------------------
interface SlipSelection {
  id: string; // `${matchId}::${betType}`
  matchId: string;
  home: string;
  away: string;
  betType: BetType;
  odds: number;
  stake: number;
}

// ---------------------------------------------------------------------------
/* Currency — driven by the REGISTERED country
   ---------------------------------------------------------------------------
   Replaced: an ipapi.co geo lookup plus a USD-based FX table from
   open.er-api.com, used to translate a fixed 115 GHS minimum into local money.
   Same three problems as everywhere else in the app — it contradicted the
   country the player registered with, the floor moved with the live rate, and
   it blocked first paint on two network calls while every figure rendered in
   USD.

   Under the parity rule there is nothing to convert: the floor is a flat
   per-country number and only the symbol changes. `ghsPerUsd` is retained at
   1 purely so any remaining arithmetic downstream is a no-op rather than
   needing a rewrite.
   ------------------------------------------------------------------------- */

function useCurrency() {
  const { country, fmt } = useCountry();

  const format = useCallback((amount: number) => fmt(amount), [fmt]);

  const formatMinStakeEquivalent = useCallback(
    () => fmt(country.minStake, 0),
    [fmt, country.minStake],
  );

  return {
    loading: false,
    countryName: country.name as string | null,
    currencyCode: country.currency,
    rates: null as Record<string, number> | null,
    format,
    formatMinStakeEquivalent,
    minStake: country.minStake,
    ghsPerUsd: 1, // parity — no conversion step exists any more
  };
}

// ---------------------------------------------------------------------------
// Team crest — circular badge design (v2)
// ---------------------------------------------------------------------------
type EmblemShape = 'star' | 'diamond' | 'ring' | 'bolt' | 'chevron' | 'paw' | 'wave';
const EMBLEM_SHAPES: EmblemShape[] = ['star', 'diamond', 'ring', 'bolt', 'chevron', 'paw', 'wave'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

interface DerivedTeam {
  name: string;
  short: string;
  color: string;
  accent: string;
}

function deriveTeam(name: string): DerivedTeam {
  const h = hashString(name);
  const hue = h % 360;
  const words = name.trim().split(/\s+/).filter(Boolean);
  // Multi-word names → initials (e.g. "Ivory Coast" -> "IC"). Single-word
  // names → first 3 letters (e.g. "Nigeria" -> "NIG") so short codes never
  // collapse to one ambiguous letter, which made concurrent matches with
  // single-word team names hard to tell apart.
  const short =
    words.length > 1
      ? words
          .map((w) => w[0])
          .join('')
          .slice(0, 3)
          .toUpperCase()
      : name.slice(0, 3).toUpperCase();
  return {
    name,
    short,
    color: `hsl(${hue}, 62%, 46%)`,
    accent: `hsl(${(hue + 140) % 360}, 70%, 60%)`,
  };
}

function Emblem({ shape, cx, cy, r, fill }: { shape: EmblemShape; cx: number; cy: number; r: number; fill: string }) {
  switch (shape) {
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.42;
        pts.push(`${cx + Math.cos(ang) * rad},${cy + Math.sin(ang) * rad}`);
      }
      return <polygon points={pts.join(' ')} fill={fill} />;
    }
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r * 0.75},${cy} ${cx},${cy + r} ${cx - r * 0.75},${cy}`}
          fill={fill}
        />
      );
    case 'ring':
      return <circle cx={cx} cy={cy} r={r * 0.65} fill="none" stroke={fill} strokeWidth={r * 0.32} />;
    case 'bolt':
      return (
        <polygon
          points={`${cx + r * 0.15},${cy - r} ${cx - r * 0.55},${cy + r * 0.15} ${cx - r * 0.05},${cy + r * 0.15} ${cx - r * 0.15},${cy + r} ${cx + r * 0.55},${cy - r * 0.1} ${cx + r * 0.05},${cy - r * 0.1}`}
          fill={fill}
        />
      );
    case 'chevron':
      return (
        <polygon
          points={`${cx - r * 0.8},${cy + r * 0.5} ${cx},${cy - r * 0.5} ${cx + r * 0.8},${cy + r * 0.5} ${cx + r * 0.4},${cy + r * 0.5} ${cx},${cy - r * 0.05} ${cx - r * 0.4},${cy + r * 0.5}`}
          fill={fill}
        />
      );
    case 'paw':
      return (
        <g fill={fill}>
          <circle cx={cx} cy={cy + r * 0.25} r={r * 0.42} />
          <circle cx={cx - r * 0.5} cy={cy - r * 0.35} r={r * 0.2} />
          <circle cx={cx} cy={cy - r * 0.55} r={r * 0.2} />
          <circle cx={cx + r * 0.5} cy={cy - r * 0.35} r={r * 0.2} />
        </g>
      );
    case 'wave':
      return (
        <path
          d={`M ${cx - r} ${cy} q ${r * 0.5} ${-r * 0.7} ${r} 0 q ${r * 0.5} ${r * 0.7} ${r} 0`}
          fill="none"
          stroke={fill}
          strokeWidth={r * 0.3}
          strokeLinecap="round"
        />
      );
    default:
      return null;
  }
}

/** Circular gradient badge: a soft radial fill in the team's color pair,
 *  a faint emblem watermark behind the monogram, and a thin two-tone ring.
 *  Reads well from the 16px board buttons up to the 28px scoreboard usage. */
function TeamCrest({ team, size = 28 }: { team: DerivedTeam; size?: number }) {
  const uid = useId().replace(/[:]/g, '');
  const initials = team.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const shape = EMBLEM_SHAPES[hashString(team.name) % EMBLEM_SHAPES.length];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id={`crest-fill-${uid}`} cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor={team.accent} />
          <stop offset="100%" stopColor={team.color} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={`url(#crest-fill-${uid})`} />
      <g opacity={0.22}>
        <Emblem shape={shape} cx={20} cy={21} r={12.5} fill="#ffffff" />
      </g>
      <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.1" />
      <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="0.6" />
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        fontFamily="'Orbitron', monospace"
        fontWeight={900}
        fontSize="13.5"
        fill="#fff"
        style={{ paintOrder: 'stroke' }}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="2.4"
      >
        {initials}
      </text>
    </svg>
  );
}

function BallMark({ live, size = 20 }: { live: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: live ? 'vf-spin 1.8s linear infinite' : 'none' }}>
      <circle cx="12" cy="12" r="10.5" fill="#F5F5F5" stroke="#1a1a1a" strokeWidth="0.75" />
      <g fill="#111">
        <polygon points="12,6.2 14.6,8.1 13.6,11.1 10.4,11.1 9.4,8.1" />
        <polygon points="12,6.2 9.4,8.1 7.3,6.4 9.6,4 14.4,4 16.7,6.4 14.6,8.1" fill="none" stroke="#111" strokeWidth="0.9" />
      </g>
      <path
        d="M12 6.2 L9.4 8.1 L10.4 11.1 L13.6 11.1 L14.6 8.1 Z M9.4 8.1 L5.5 9.4 M14.6 8.1 L18.5 9.4 M10.4 11.1 L9 15.4 M13.6 11.1 L15 15.4"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="0.7"
      />
    </svg>
  );
}

/** Compact home/away comparison bar used inside the Live Match Stats panel.
 *  A single label with an icon sits in the middle, values on either side,
 *  and a two-tone bar underneath shows the split at a glance. */
function StatBar({ icon, label, home, away }: { icon: React.ReactNode; label: string; home: number; away: number }) {
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="font-mono font-bold w-6 text-left" style={{ color: home >= away && total > 1 ? '#00E676' : '#ccc' }}>
          {home}
        </span>
        <span className="flex items-center gap-1 uppercase tracking-wider" style={{ color: '#888', fontSize: '9.5px' }}>
          {icon}
          {label}
        </span>
        <span className="font-mono font-bold w-6 text-right" style={{ color: away >= home && total > 1 ? '#00E676' : '#ccc' }}>
          {away}
        </span>
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden flex" style={{ backgroundColor: '#1C1C1C' }}>
        <div style={{ width: `${homePct}%`, backgroundColor: '#00D4FF' }} />
        <div style={{ width: `${100 - homePct}%`, backgroundColor: '#FFB300' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cosmetic pitch physics — purely visual. Score only ever comes from
// SettleResponse.
// ---------------------------------------------------------------------------
interface Player {
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  speed: number;
  color: string;
  accent: string;
  number: number;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface EventItem {
  id: number;
  minute: number;
  team: string;
  text: string;
  type: 'shot' | 'corner' | 'card' | 'info';
}

// Cosmetic live stat line — driven by the same event feed as the
// commentary chips. Purely presentational, never affects the real result.
interface MatchStats {
  possessionHome: number; // 0-100, home share
  shotsHome: number;
  shotsAway: number;
  cornersHome: number;
  cornersAway: number;
  cardsHome: number;
  cardsAway: number;
}

function freshStats(): MatchStats {
  return {
    possessionHome: 50,
    shotsHome: 0,
    shotsAway: 0,
    cornersHome: 0,
    cornersAway: 0,
    cardsHome: 0,
    cardsAway: 0,
  };
}

/** Builds a 7-player staggered formation for one side of the pitch. Shared
 *  by the resize-driven seeding effect and the self-healing render loop so
 *  both paths always produce the same look. Home hugs the left third, away
 *  mirrors it on the right, each with a light zigzag so markers never sit
 *  in a straight, overlapping line. */
function buildFormation(side: 'home' | 'away', W: number, H: number, color: string, accent: string): Player[] {
  const xBase = side === 'home' ? 0.14 : 0.86;
  const xJitter = side === 'home' ? [0, 0.09, -0.02, 0.09, 0.02, 0.11, 0.04] : [0, -0.09, 0.02, -0.09, -0.02, -0.11, -0.04];
  const players: Player[] = [];
  for (let i = 0; i < 7; i++) {
    players.push({
      x: W * (xBase + xJitter[i]),
      y: H * (0.08 + i * (0.84 / 6)),
      targetX: null,
      targetY: null,
      speed: 0.5 + Math.random() * 0.5,
      color,
      accent,
      number: i + 1,
    });
  }
  return players;
}

type RoundPhase = 'RUNNING' | 'REVEALING' | 'RESULT';

interface ActiveRound {
  round: PlayResponse;
  phase: RoundPhase;
  matchSeconds: number;
  progress: number;
  events: EventItem[];
  stats: MatchStats;
  revealedHome: number;
  revealedAway: number;
  goalFlashSide: 'home' | 'away' | null;
  result: SettleResponse | null;
  startTime: number;
  settling: boolean;
}

export default function VirtualFootballGame({ onExit }: { onExit: () => void }) {
  const currency = useCurrency();
  const MIN_STAKE = currency.minStake;

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [oddsPreview, setOddsPreview] = useState<OddsQuote | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [boardMatchups, setBoardMatchups] = useState<BoardMatchup[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>('All');

  const roundsRef = useRef<Record<string, ActiveRound>>({});
  const [, setRenderTick] = useState(0);
  const forceRender = useCallback(() => setRenderTick((t) => t + 1), []);

  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const activeRoundIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeRoundIdRef.current = activeRoundId;
  }, [activeRoundId]);

  // ── Bet slip — a list of independent selections, each with its own stake ─
  const [betSlip, setBetSlip] = useState<SlipSelection[]>([]);
  const [defaultStakeUsd, setDefaultStakeUsd] = useState<number>(MIN_STAKE);
  const [placing, setPlacing] = useState(false);
  const [betStatus, setBetStatus] = useState<{ text: string; color: string } | null>(null);
  // Bet-slip bottom sheet — opens automatically the moment odds are tapped,
  // closable independently so the user can keep adding picks from the board.
  const [slipModalOpen, setSlipModalOpen] = useState(false);

  const [mobileTab, setMobileTab] = useState<'pitch' | 'bet' | 'stats'>('pitch');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pitchWrapRef = useRef<HTMLDivElement | null>(null);
  const playersRef = useRef<{ home: Player[]; away: Player[] }>({ home: [], away: [] });
  const ballRef = useRef<Ball>({ x: 0, y: 0, vx: 0, vy: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const eventIdRef = useRef(0);
  // Tracks which round's players/ball are currently seeded on the pitch so
  // the render loop can self-heal instead of relying solely on a resize effect.
  const seededRoundIdRef = useRef<string | null>(null);

  const activeEntry = activeRoundId ? roundsRef.current[activeRoundId] : null;
  const homeTeam = activeEntry ? deriveTeam(activeEntry.round.homeTeam) : null;
  const awayTeam = activeEntry ? deriveTeam(activeEntry.round.awayTeam) : null;

  const safeHistory = Array.isArray(history) ? history : [];

  // Keep the default per-pick stake in sync with the live minimum until the
  // user has actually started a slip — once they have picks, leave it alone.
  useEffect(() => {
    if (betSlip.length === 0) setDefaultStakeUsd(MIN_STAKE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [MIN_STAKE]);

  // ── League filtering — derived from whatever `league` values the
  //     backend roster actually contains, so new leagues show up on
  //     their own once the backend starts sending them. ────────────────────
  const availableLeagues = useMemo(() => {
    const set = new Set(teams.map((t) => t.league || 'Other'));
    return sortLeagues(Array.from(set));
  }, [teams]);

  const leagueTeams = useMemo(() => {
    if (selectedLeague === 'All') return teams;
    return teams.filter((t) => (t.league || 'Other') === selectedLeague);
  }, [teams, selectedLeague]);

  // Bet-slip derived numbers
  const slipTotalStake = betSlip.reduce((sum, s) => sum + s.stake, 0);
  const slipBelowMin = betSlip.some((s) => s.stake < MIN_STAKE);
  const slipOverBalance = slipTotalStake > balance;
  const activeList = Object.values(roundsRef.current);
  const availableSlots = MAX_CONCURRENT_ROUNDS - activeList.length;
  const slipTooBig = betSlip.length > availableSlots;

  const refreshBoard = useCallback(() => {
    setBoardMatchups(generateMatchups(leagueTeams));
    footballApi.previewOdds().then(setOddsPreview).catch(() => {});
  }, [leagueTeams]);

  // Rebuild the board whenever the team roster loads OR the league filter
  // changes, so switching leagues always regenerates fixtures for that league.
  useEffect(() => {
    if (leagueTeams.length >= 2) {
      setBoardMatchups(generateMatchups(leagueTeams));
    } else {
      setBoardMatchups([]);
    }
  }, [leagueTeams]);

  // ── Settle a single round by id ──────────────────────────────────────────
  const animateReveal = useCallback(
    async (id: string, finalHome: number, finalAway: number) => {
      const entry = roundsRef.current[id];
      if (!entry) return;
      entry.revealedHome = 0;
      entry.revealedAway = 0;
      forceRender();

      const steps: ('home' | 'away')[] = [];
      for (let i = 0; i < finalHome; i++) steps.push('home');
      for (let i = 0; i < finalAway; i++) steps.push('away');
      steps.sort(() => Math.random() - 0.5);

      for (const side of steps) {
        await sleep(650);
        const e = roundsRef.current[id];
        if (!e) return;
        e.goalFlashSide = side;
        if (side === 'home') e.revealedHome += 1;
        else e.revealedAway += 1;
        forceRender();
        await sleep(550);
        const e2 = roundsRef.current[id];
        if (e2) {
          e2.goalFlashSide = null;
          forceRender();
        }
      }
      if (steps.length === 0) await sleep(400);
    },
    [forceRender]
  );

  const settleRoundById = useCallback(
    async (id: string) => {
      const entry = roundsRef.current[id];
      if (!entry || entry.settling) return;
      entry.settling = true;
      entry.phase = 'REVEALING';
      forceRender();

      try {
        const res = await footballApi.settle({ roundId: entry.round.roundId });

        if (activeRoundIdRef.current === id) {
          await animateReveal(id, res.homeScore, res.awayScore);
        } else {
          const e = roundsRef.current[id];
          if (e) {
            e.revealedHome = res.homeScore;
            e.revealedAway = res.awayScore;
          }
        }

        const finalEntry = roundsRef.current[id];
        if (finalEntry) {
          finalEntry.result = res;
          finalEntry.phase = 'RESULT';
        }
        forceRender();
        setBalance(res.newBalance);
        footballApi.history(8).then(setHistory).catch(() => {});

        setTimeout(() => {
          delete roundsRef.current[id];
          if (activeRoundIdRef.current === id) {
            const remaining = Object.keys(roundsRef.current);
            setActiveRoundId(remaining[0] ?? null);
          }
          forceRender();
        }, 4500);
      } catch (e) {
        const entryAfter = roundsRef.current[id];
        if (entryAfter) {
          entryAfter.settling = false;
          entryAfter.phase = 'RUNNING';
        }
        setBetStatus({ text: e instanceof Error ? e.message : 'Could not settle a round', color: '#E8003D' });
        forceRender();
      }
    },
    [animateReveal, forceRender]
  );

  // ── Single driving interval for ALL active rounds ────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      let any = false;
      Object.entries(roundsRef.current).forEach(([id, r]) => {
        if (r.phase !== 'RUNNING') return;
        any = true;
        const elapsed = (Date.now() - r.startTime) / 1000;
        const p = Math.min(elapsed / r.round.matchDurationSeconds, 1);
        r.progress = p;
        r.matchSeconds = Math.floor(p * 90);

        if (!r.stats) r.stats = freshStats();
        // Gentle random walk so possession feels alive without ever being
        // extreme — clamped so neither side is ever shown dominating totally.
        r.stats.possessionHome = Math.max(28, Math.min(72, r.stats.possessionHome + (Math.random() - 0.5) * 3));

        if (Math.random() < 0.02) {
          const home = deriveTeam(r.round.homeTeam);
          const away = deriveTeam(r.round.awayTeam);
          const isHome = Math.random() < 0.5;
          const side = isHome ? home : away;
          const roll = Math.random();
          const text = roll < 0.5 ? 'Shot on target' : roll < 0.8 ? 'Corner kick' : 'Yellow card';
          const type: EventItem['type'] = roll < 0.5 ? 'shot' : roll < 0.8 ? 'corner' : 'card';
          if (type === 'shot') {
            if (isHome) r.stats.shotsHome += 1;
            else r.stats.shotsAway += 1;
          } else if (type === 'corner') {
            if (isHome) r.stats.cornersHome += 1;
            else r.stats.cornersAway += 1;
          } else {
            if (isHome) r.stats.cardsHome += 1;
            else r.stats.cardsAway += 1;
          }
          const evId = ++eventIdRef.current;
          r.events = [{ id: evId, minute: r.matchSeconds, team: side.name, text, type }, ...r.events].slice(0, 5);
          setTimeout(() => {
            const rr = roundsRef.current[id];
            if (rr) {
              rr.events = rr.events.filter((e) => e.id !== evId);
              forceRender();
            }
          }, 3000);
        }

        if (p >= 1 && !r.settling) {
          void settleRoundById(id);
        }
      });
      if (any) forceRender();
    }, 200);
    return () => clearInterval(iv);
  }, [forceRender, settleRoundById]);

  // ── Initial load: balance, odds preview, team roster, resume ALL rounds ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [balRes, oddsRes, teamsRes, openRoundsRes] = await Promise.all([
          footballApi.getBalance(),
          footballApi.previewOdds(),
          footballApi.teams().catch(() => []),
          footballApi.openRounds().catch(() => []),
        ]);
        if (cancelled) return;
        setBalance(balRes.balance);
        setOddsPreview(oddsRes);
        setTeams(Array.isArray(teamsRes) ? teamsRes : []);

        const openRounds = Array.isArray(openRoundsRes) ? openRoundsRes : [];
        let firstId: string | null = null;
        for (const rv of openRounds) {
          if (!rv || !rv.roundId || rv.settled) continue;
          const resumed: PlayResponse = {
            roundId: rv.roundId,
            walletBalance: balRes.balance,
            stake: rv.stake,
            betType: rv.betType,
            odds: rv.odds,
            homeTeam: rv.homeTeam,
            awayTeam: rv.awayTeam,
            matchDurationSeconds: 30,
          };
          roundsRef.current[resumed.roundId] = {
            round: resumed,
            phase: 'RUNNING',
            matchSeconds: 0,
            progress: 0,
            events: [],
            stats: freshStats(),
            revealedHome: 0,
            revealedAway: 0,
            goalFlashSide: null,
            result: null,
            startTime: Date.now(),
            settling: false,
          };
          if (!firstId) firstId = resumed.roundId;
        }
        if (firstId) setActiveRoundId(firstId);

        setLoading(false);
        forceRender();
      } catch (e) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : 'Failed to load game');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    footballApi.history(8).then(setHistory).catch(() => {});
  }, []);

  // ── Cosmetic player/ball setup ──────────────────────────────────────────
  const ensurePlayers = useCallback((homeColor: string, awayColor: string, homeAccent: string, awayAccent: string) => {
    const canvas = canvasRef.current;
    const W = canvas?.clientWidth || 300;
    const H = canvas?.clientHeight || 300;
    playersRef.current = {
      home: buildFormation('home', W, H, homeColor, homeAccent),
      away: buildFormation('away', W, H, awayColor, awayAccent),
    };
  }, []);

  const ensureBall = useCallback(() => {
    const canvas = canvasRef.current;
    ballRef.current = { x: (canvas?.clientWidth || 300) / 2, y: (canvas?.clientHeight || 300) / 2, vx: 0, vy: 0 };
  }, []);

  // ── Canvas sizing — re-seeds players/ball whenever the WATCHED round
  //     changes, AND whenever the mobile tab switches to "pitch". This is a
  //     best-effort resize; the render loop below is the real safety net
  //     that guarantees the pitch shows up even if this effect's timing
  //     misses (e.g. container was hidden/zero-size at the wrong instant).
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = pitchWrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 2 || h < 2) return;
      canvas.width = w;
      canvas.height = h;
      if (homeTeam && awayTeam) {
        ensurePlayers(homeTeam.color, awayTeam.color, homeTeam.accent, awayTeam.accent);
        ensureBall();
        seededRoundIdRef.current = activeRoundId;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('orientationchange', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoundId, mobileTab]);

  // ── Cosmetic render loop — self-healing + waits for canvas to exist ─────
  useEffect(() => {
    if (loading) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let running = true;

    const drawPitch = (W: number, H: number) => {
      const grass = ctx.createLinearGradient(0, 0, W, 0);
      grass.addColorStop(0, '#0a3d0a');
      grass.addColorStop(0.5, '#0d4d0d');
      grass.addColorStop(1, '#0a3d0a');
      ctx.fillStyle = grass;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < W; i += 40) {
        ctx.fillStyle = i % 80 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
        ctx.fillRect(i, 0, 40, H);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, W - 40, H - 40);
      ctx.beginPath();
      ctx.moveTo(W / 2, 20);
      ctx.lineTo(W / 2, H - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      const goalH = H * 0.3;
      const goalY = H / 2 - goalH / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(10, goalY, 10, goalH);
      ctx.fillRect(W - 20, goalY, 10, goalH);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(20, H / 2 - H * 0.22, W * 0.15, H * 0.44);
      ctx.strokeRect(W - 20 - W * 0.15, H / 2 - H * 0.22, W * 0.15, H * 0.44);

      // Corner-kick arcs — standard pitch markings drawn right into the
      // canvas at each of the four corners, complementing the flag icons
      // overlaid on top of the canvas.
      const cr = Math.max(10, Math.min(W, H) * 0.05);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(20, 20, cr, 0, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W - 20, 20, cr, Math.PI / 2, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(20, H - 20, cr, -Math.PI / 2, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W - 20, H - 20, cr, Math.PI, Math.PI * 1.5);
      ctx.stroke();
    };

    const drawPlayer = (p: Player) => {
      // contact shadow
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 9.5, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fill();

      // shaded body
      const grad = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, 11);
      grad.addColorStop(0, p.accent);
      grad.addColorStop(1, p.color);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // jersey number
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.number), p.x, p.y + 0.5);
    };

    const drawBall = (b: Ball) => {
      // contact shadow
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 4, 8, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      // shaded sphere
      const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, 9);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#d4d4d4');
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1;
      ctx.stroke();

      // stitched pentagon pattern
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 3.4);
      ctx.lineTo(b.x + 3, b.y - 1.1);
      ctx.lineTo(b.x + 1.8, b.y + 2.6);
      ctx.lineTo(b.x - 1.8, b.y + 2.6);
      ctx.lineTo(b.x - 3, b.y - 1.1);
      ctx.closePath();
      ctx.fill();
    };

    const movePlayers = (dt: number, W: number, H: number) => {
      [...playersRef.current.home, ...playersRef.current.away].forEach((p) => {
        if (p.targetX === null || p.targetY === null) {
          p.targetX = Math.max(20, Math.min(W - 20, p.x + (Math.random() - 0.5) * W * 0.3));
          p.targetY = Math.max(20, Math.min(H - 20, p.y + (Math.random() - 0.5) * H * 0.3));
        }
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) {
          p.targetX = null;
          p.targetY = null;
        } else {
          p.x += (dx / dist) * p.speed * dt * 0.05;
          p.y += (dy / dist) * p.speed * dt * 0.05;
        }
      });
    };

    const moveBall = (dt: number, W: number, H: number) => {
      const b = ballRef.current;
      if (Math.random() < 0.012) {
        const all = [...playersRef.current.home, ...playersRef.current.away];
        const target = all[Math.floor(Math.random() * all.length)];
        if (target) {
          const dx = target.x - b.x;
          const dy = target.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const power = 2 + Math.random() * 2.5;
          b.vx = (dx / dist) * power;
          b.vy = (dy / dist) * power;
        }
      }
      b.x += b.vx * dt * 0.05;
      b.y += b.vy * dt * 0.05;
      if (b.x < 20 || b.x > W - 20) {
        b.vx *= -1;
        b.x = Math.max(20, Math.min(W - 20, b.x));
      }
      if (b.y < 20 || b.y > H - 20) {
        b.vy *= -1;
        b.y = Math.max(20, Math.min(H - 20, b.y));
      }
    };

    const loop = (ts: number) => {
      if (!running) return;
      rafRef.current = requestAnimationFrame(loop);
      const dt = ts - lastTsRef.current || 16;
      lastTsRef.current = ts;

      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (W < 2 || H < 2) return;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      const curId = activeRoundIdRef.current;
      if (curId && roundsRef.current[curId]) {
        if (seededRoundIdRef.current !== curId) {
          const r = roundsRef.current[curId];
          const h = deriveTeam(r.round.homeTeam);
          const a = deriveTeam(r.round.awayTeam);
          playersRef.current = {
            home: buildFormation('home', W, H, h.color, h.accent),
            away: buildFormation('away', W, H, a.color, a.accent),
          };
          ballRef.current = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
          seededRoundIdRef.current = curId;
        }
      } else if (!curId) {
        seededRoundIdRef.current = null;
      }

      ctx.clearRect(0, 0, W, H);
      drawPitch(W, H);
      const watchedRunning = curId !== null && roundsRef.current[curId as string]?.phase === 'RUNNING';
      if (watchedRunning) {
        movePlayers(dt, W, H);
        moveBall(dt, W, H);
      }
      playersRef.current.home.forEach(drawPlayer);
      playersRef.current.away.forEach(drawPlayer);
      drawBall(ballRef.current);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loading]);

  // ── Bet slip actions ──────────────────────────────────────────────────
  // Tapping odds adds/removes the pick AND opens the bottom-sheet so the
  // user can immediately review/adjust the stake without scrolling — unless
  // that tap just emptied the slip entirely, in which case there's nothing
  // to show, so the sheet stays closed.
  const selectMarket = (m: BoardMatchup, bet: 'home' | 'away') => {
    const id = `${m.id}::${bet}`;
    setBetSlip((prev) => {
      const existingSame = prev.find((s) => s.id === id);
      if (existingSame) {
        const filtered = prev.filter((s) => s.id !== id);
        setSlipModalOpen(filtered.length > 0);
        return filtered;
      }
      // a fixture can only carry one pick at a time — switching market
      // on the same fixture replaces the old pick, it doesn't stack
      const withoutThisFixture = prev.filter((s) => s.matchId !== m.id);
      const odds = bet === 'home' ? oddsPreview?.home ?? 0 : oddsPreview?.away ?? 0;
      setSlipModalOpen(true);
      return [
        ...withoutThisFixture,
        { id, matchId: m.id, home: m.home.name, away: m.away.name, betType: bet, odds, stake: defaultStakeUsd },
      ];
    });
    setBetStatus(null);
  };

  const removeSlipSelection = (id: string) =>
    setBetSlip((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) setSlipModalOpen(false);
      return next;
    });

  const updateSlipStake = (id: string, value: number) =>
    setBetSlip((prev) => prev.map((s) => (s.id === id ? { ...s, stake: Math.max(0, value) } : s)));

  const clampSlipStakeOnBlur = (id: string) =>
    setBetSlip((prev) => prev.map((s) => (s.id === id ? { ...s, stake: s.stake < MIN_STAKE ? MIN_STAKE : s.stake } : s)));

  const adjustSlipStake = (id: string, mult: number) =>
    setBetSlip((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = mult < 1 ? Math.max(MIN_STAKE, s.stake * mult) : Math.min(100000, s.stake * mult);
        return { ...s, stake: Math.round(next * 100) / 100 };
      })
    );

  const applyStakeToAll = (amount: number) => {
    setDefaultStakeUsd(amount);
    setBetSlip((prev) => (prev.length > 0 ? prev.map((s) => ({ ...s, stake: amount })) : prev));
  };

  // ── Place ALL slip selections — each becomes its own independent round ──
  const placeAllBets = useCallback(async () => {
    if (placing) return;
    if (betSlip.length === 0) {
      setBetStatus({ text: 'Tap odds on the board below to add a selection first', color: '#FFB300' });
      return;
    }
    if (slipBelowMin) {
      setBetSlip((prev) => prev.map((s) => (s.stake < MIN_STAKE ? { ...s, stake: MIN_STAKE } : s)));
      setBetStatus({
        text: `Minimum stake is ${currency.loading ? 'GHS 115' : currency.formatMinStakeEquivalent()} per pick — amounts raised to the minimum`,
        color: '#E8003D',
      });
      return;
    }
    if (slipOverBalance) {
      setBetStatus({ text: 'Insufficient balance for your total stake', color: '#E8003D' });
      return;
    }
    if (!oddsPreview) {
      setBetStatus({ text: 'Odds not loaded yet, try again', color: '#E8003D' });
      return;
    }
    if (slipTooBig) {
      setBetStatus({
        text: `You can only watch ${MAX_CONCURRENT_ROUNDS} matches at once — remove ${betSlip.length - availableSlots} pick(s) or wait for one to finish`,
        color: '#FFB300',
      });
      return;
    }

    setPlacing(true);
    setBetStatus({ text: betSlip.length > 1 ? 'Placing bets…' : 'Placing bet…', color: '#888' });

    let lastBalance = balance;
    let firstNewRoundId: string | null = null;
    let placedCount = 0;
    const failures: string[] = [];

    for (const sel of betSlip) {
      try {
        const res = await footballApi.play({
          stake: sel.stake,
          betType: sel.betType,
          odds: sel.odds,
          homeTeam: sel.home,
          awayTeam: sel.away,
        });
        lastBalance = res.walletBalance;
        roundsRef.current[res.roundId] = {
          round: res,
          phase: 'RUNNING',
          matchSeconds: 0,
          progress: 0,
          events: [],
          stats: freshStats(),
          revealedHome: 0,
          revealedAway: 0,
          goalFlashSide: null,
          result: null,
          startTime: Date.now(),
          settling: false,
        };
        if (!firstNewRoundId) firstNewRoundId = res.roundId;
        placedCount += 1;
      } catch (e) {
        failures.push(`${sel.home} vs ${sel.away}`);
      }
    }

    setBalance(lastBalance);
    if (firstNewRoundId) {
      setActiveRoundId(firstNewRoundId);
      setMobileTab('pitch'); // jump straight to a live match on mobile
    }
    setBetSlip([]);
    setSlipModalOpen(false);
    setBetStatus(
      failures.length > 0
        ? { text: `${placedCount} placed, ${failures.length} failed (${failures.join(', ')})`, color: '#FFB300' }
        : { text: `${placedCount} bet${placedCount === 1 ? '' : 's'} placed — kicking off…`, color: '#FFD166' }
    );
    forceRender();
    setPlacing(false);
  }, [placing, betSlip, slipBelowMin, slipOverBalance, slipTooBig, availableSlots, balance, oddsPreview, currency, MIN_STAKE, forceRender]);

  const isLive = activeList.some((r) => r.phase === 'RUNNING' || r.phase === 'REVEALING');
  const isWatchedLive = activeEntry ? activeEntry.phase === 'RUNNING' || activeEntry.phase === 'REVEALING' : false;
  const minutesLabel = activeEntry
    ? `${String(Math.floor(activeEntry.matchSeconds / 60)).padStart(2, '0')}:${String(activeEntry.matchSeconds % 60).padStart(2, '0')}`
    : '00:00';

  const oddsBtnStyle = (active: boolean): React.CSSProperties => ({
    borderColor: active ? '#00E676' : '#2A2A2A',
    backgroundColor: active ? 'rgba(0, 230, 118, 0.15)' : '#161616',
  });

  const AmountLabel = ({ usd, primaryClassName, primaryStyle }: { usd: number; primaryClassName?: string; primaryStyle?: React.CSSProperties }) => (
    <span className={primaryClassName} style={primaryStyle}>
      {currency.loading ? `$${usd.toFixed(2)}` : currency.format(usd)}
    </span>
  );

  const MinStakeNotice = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <span className={className} style={style}>
      {currency.formatMinStakeEquivalent()}
      {/* The old "(GHS 115)" base-currency hint is gone — under the parity
          rule the figure above is already in the player's own currency, so
          there is nothing to convert from. */}
    </span>
  );

  // Reusable slip-row renderer — used inside the bottom-sheet modal.
  const renderSlipRow = (s: SlipSelection) => {
    const belowMin = s.stake < MIN_STAKE;
    const sh = deriveTeam(s.home);
    const sa = deriveTeam(s.away);
    return (
      <div key={s.id} className="rounded-md p-2.5 flex flex-col gap-1.5" style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1.5">
            <TeamCrest team={sh} size={16} />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold truncate">
                {s.home} vs {s.away}
              </div>
              <div className="text-[9.5px] font-mono" style={{ color: '#888' }}>
                {s.betType.toUpperCase()} @ {s.odds.toFixed(2)}
              </div>
            </div>
            <TeamCrest team={sa} size={16} />
          </div>
          <button onClick={() => removeSlipSelection(s.id)} aria-label="Remove selection" className="flex-shrink-0 p-1 rounded" style={{ color: '#E8003D' }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => adjustSlipStake(s.id, 0.5)}
            className="w-7 h-7 rounded-md flex-shrink-0 text-xs"
            style={{ backgroundColor: '#1C1C1C', border: '1px solid #2A2A2A', color: '#888' }}
          >
            ½
          </button>
          <input
            type="number"
            min={MIN_STAKE}
            max={100000}
            value={s.stake}
            onChange={(e) => updateSlipStake(s.id, parseFloat(e.target.value) || 0)}
            onBlur={() => clampSlipStakeOnBlur(s.id)}
            className="flex-1 min-w-0 text-center rounded-md py-1 font-mono text-xs"
            style={{
              backgroundColor: '#0F0F0F',
              border: `1px solid ${belowMin ? '#E8003D' : '#2A2A2A'}`,
              color: '#fff',
            }}
          />
          <button
            onClick={() => adjustSlipStake(s.id, 2)}
            className="w-7 h-7 rounded-md flex-shrink-0 text-xs"
            style={{ backgroundColor: '#1C1C1C', border: '1px solid #2A2A2A', color: '#888' }}
          >
            2×
          </button>
          <span className="text-[9.5px] font-mono flex-shrink-0" style={{ color: '#00E676' }}>
            → <AmountLabel usd={s.stake * s.odds} />
          </span>
        </div>
        {belowMin && (
          <div className="text-[9px]" style={{ color: '#E8003D' }}>
            Below minimum — will be raised to <MinStakeNotice />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className="rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: '#0A0A0A', color: '#fff', border: '1px solid #2A2A2A', minHeight: '640px' }}
      >
        <div className="flex flex-col items-center gap-3">
          <BallMark live size={32} />
          <span className="text-sm" style={{ color: '#888' }}>
            Loading your wallet and today's odds…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col relative"
      style={{ backgroundColor: '#0A0A0A', color: '#FFFFFF', border: '1px solid #2A2A2A', minHeight: '640px' }}
    >
      <style>{`
        @keyframes vf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes vf-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes vf-pop { 0% { transform: scale(0.6); opacity: 0; } 30% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes vf-slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes vf-fadein { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .vf-spin, .vf-pulse-dot, .vf-goal-pop, .vf-sheet, .vf-sheet-backdrop { animation: none !important; }
        }
      `}</style>

      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ backgroundColor: '#111111', borderBottom: '1px solid #2A2A2A' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <BallMark live={isLive} size={20} />
          <span className="text-sm font-black truncate" style={{ fontFamily: "'Orbitron', monospace", letterSpacing: '0.03em', color: '#00E676' }}>
            VIRTUAL FOOTBALL
          </span>
          {isLive && (
            <span
              className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: 'rgba(232,0,61,0.15)', color: '#E8003D', border: '1px solid rgba(232,0,61,0.4)' }}
            >
              <FiberManualRecordIcon className="vf-pulse-dot" sx={{ fontSize: 9, animation: 'vf-pulse 1.2s ease-in-out infinite' }} />
              {activeList.length > 1 ? `${activeList.length} LIVE` : 'LIVE'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {!currency.loading && (
            <div
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
              style={{ backgroundColor: '#1C1C1C', border: '1px solid #2A2A2A', color: '#888' }}
              title={currency.countryName ?? undefined}
            >
              <PublicIcon sx={{ fontSize: 12 }} />
              {currency.currencyCode}
            </div>
          )}
          <div className="flex flex-col items-end leading-none">
            <span className="text-[9px]" style={{ color: '#888' }}>
              BALANCE
            </span>
            <AmountLabel usd={balance} primaryClassName="font-mono font-semibold text-sm" primaryStyle={{ color: '#00E676' }} />
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

      {initError && (
        <div className="px-3 py-2 text-xs text-center" style={{ backgroundColor: 'rgba(232,0,61,0.1)', color: '#E8003D' }}>
          {initError} — some data may be stale.
        </div>
      )}

      {/* Mobile sticky scoreboard */}
      <div
        className="flex lg:hidden items-center justify-between px-3 py-2 flex-shrink-0"
        style={{
          backgroundColor: activeEntry?.goalFlashSide ? 'rgba(0,230,118,0.12)' : 'rgba(17,17,17,0.9)',
          borderBottom: '1px solid #2A2A2A',
          transition: 'background-color 0.3s ease',
        }}
      >
        {homeTeam && awayTeam && activeEntry ? (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <TeamCrest team={homeTeam} size={22} />
              <span className="text-[11px] font-semibold truncate max-w-[64px]">{homeTeam.short}</span>
            </div>
            <div className="flex flex-col items-center px-2">
              <div className="flex items-center gap-2 font-black" style={{ fontFamily: "'Orbitron', monospace", fontSize: '1.1rem' }}>
                <span>{activeEntry.phase === 'RESULT' || activeEntry.phase === 'REVEALING' ? activeEntry.revealedHome : '–'}</span>
                <span style={{ color: '#555' }}>:</span>
                <span>{activeEntry.phase === 'RESULT' || activeEntry.phase === 'REVEALING' ? activeEntry.revealedAway : '–'}</span>
              </div>
              <span className="text-[9px] font-mono flex items-center gap-0.5" style={{ color: isWatchedLive ? '#00D4FF' : '#666' }}>
                {activeEntry.phase === 'RUNNING' && <TimerIcon sx={{ fontSize: 9 }} />}
                {activeEntry.phase === 'RUNNING' ? minutesLabel : activeEntry.phase === 'REVEALING' ? 'FULL TIME' : 'RESULT'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-semibold truncate max-w-[64px] text-right">{awayTeam.short}</span>
              <TeamCrest team={awayTeam} size={22} />
            </div>
          </>
        ) : (
          <span className="text-xs mx-auto" style={{ color: '#666' }}>
            No match in progress — place a bet to kick off
          </span>
        )}
      </div>

      {/* Mobile tab bar */}
      <div className="flex lg:hidden" style={{ borderBottom: '1px solid #2A2A2A' }}>
        {(['pitch', 'bet', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-bold uppercase tracking-wide relative"
            style={{ color: mobileTab === tab ? '#00E676' : '#666' }}
          >
            {tab === 'pitch' && <SportsSoccerIcon sx={{ fontSize: 14 }} />}
            {tab === 'bet' && <TrackChangesIcon sx={{ fontSize: 14 }} />}
            {tab === 'stats' && <BarChartIcon sx={{ fontSize: 14 }} />}
            {tab === 'pitch' ? 'Pitch' : tab === 'bet' ? 'Bet' : 'Stats'}
            {tab === 'bet' && betSlip.length > 0 && (
              <span
                className="absolute top-1 right-[22%] flex items-center justify-center rounded-full text-[9px] font-black"
                style={{ width: 14, height: 14, backgroundColor: '#00E676', color: '#0A0A0A' }}
              >
                {betSlip.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Pitch + live stats */}
        <div className={`${mobileTab === 'pitch' ? 'block' : 'hidden'} lg:block lg:flex-[1.15] lg:min-w-0 overflow-y-auto`}>
          {activeList.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-2 py-2" style={{ borderBottom: '1px solid #2A2A2A' }}>
              {activeList.map((r) => {
                const h = deriveTeam(r.round.homeTeam);
                const a = deriveTeam(r.round.awayTeam);
                const isActive = activeRoundId === r.round.roundId;
                const mm = String(Math.floor(r.matchSeconds / 60)).padStart(2, '0');
                const ss = String(r.matchSeconds % 60).padStart(2, '0');
                return (
                  <button
                    key={r.round.roundId}
                    onClick={() => setActiveRoundId(r.round.roundId)}
                    className="flex flex-col gap-1 px-2.5 py-1.5 rounded-lg flex-shrink-0 text-left"
                    style={{
                      minWidth: '136px',
                      backgroundColor: isActive ? 'rgba(0,230,118,0.1)' : '#161616',
                      border: `1px solid ${isActive ? '#00E676' : '#2A2A2A'}`,
                      borderLeft: `3px solid ${h.color}`,
                    }}
                    title={`${r.round.homeTeam} vs ${r.round.awayTeam}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <TeamCrest team={h} size={16} />
                        <span
                          className="text-[10px] font-bold truncate max-w-[36px]"
                          style={{ color: isActive ? '#00E676' : '#ddd' }}
                        >
                          {h.short}
                        </span>
                      </div>
                      <span className="text-[8px] flex-shrink-0" style={{ color: '#555' }}>
                        vs
                      </span>
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className="text-[10px] font-bold truncate max-w-[36px] text-right"
                          style={{ color: isActive ? '#00E676' : '#ddd' }}
                        >
                          {a.short}
                        </span>
                        <TeamCrest team={a} size={16} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono flex items-center gap-1" style={{ color: '#888' }}>
                        {r.phase === 'RUNNING' && <FiberManualRecordIcon sx={{ fontSize: 7, color: '#E8003D' }} />}
                        {r.phase === 'RUNNING' ? `${mm}:${ss}` : r.phase === 'REVEALING' ? 'FULL TIME' : 'RESULT'}
                      </span>
                      {(r.phase === 'REVEALING' || r.phase === 'RESULT') && (
                        <span className="text-[11px] font-mono font-black" style={{ color: '#fff' }}>
                          {r.revealedHome}-{r.revealedAway}
                        </span>
                      )}
                    </div>
                    <div className="text-[8.5px] font-mono truncate" style={{ color: '#666' }}>
                      {r.round.betType.toUpperCase()} · {currency.loading ? `$${r.round.stake.toFixed(0)}` : currency.format(r.round.stake)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div ref={pitchWrapRef} className="relative w-full" style={{ aspectRatio: '4 / 3', minHeight: '240px' }}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

            {/* Corner flags — decorative pitch furniture, aligned to the
                boundary line the canvas draws at a fixed 20px inset, on top
                of the corner arcs drawn directly on the canvas. */}
            <FlagIcon sx={{ fontSize: 15 }} className="absolute top-2 left-2 pointer-events-none z-10" style={{ color: 'rgba(255,255,255,0.5)', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />
            <FlagIcon sx={{ fontSize: 15, transform: 'scaleX(-1)' }} className="absolute top-2 right-2 pointer-events-none z-10" style={{ color: 'rgba(255,255,255,0.5)', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />
            <FlagIcon sx={{ fontSize: 15 }} className="absolute bottom-2 left-2 pointer-events-none z-10" style={{ color: 'rgba(255,255,255,0.5)', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />
            <FlagIcon sx={{ fontSize: 15, transform: 'scaleX(-1)' }} className="absolute bottom-2 right-2 pointer-events-none z-10" style={{ color: 'rgba(255,255,255,0.5)', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col gap-1 z-10 pointer-events-none w-max max-w-[90%]">
              {(activeEntry?.events ?? []).map((e) => {
                const EvIcon = e.type === 'shot' ? SportsScoreIcon : e.type === 'corner' ? FlagIcon : e.type === 'card' ? CropSquareIcon : WhatshotIcon;
                const evColor = e.type === 'card' ? '#FFB300' : e.type === 'shot' ? '#00D4FF' : e.type === 'corner' ? '#00E676' : '#fff';
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap"
                    style={{
                      backgroundColor: 'rgba(17,17,17,0.9)',
                      border: `1px solid ${e.type === 'card' ? '#FFB300' : '#2A2A2A'}`,
                      color: '#fff',
                    }}
                  >
                    <EvIcon sx={{ fontSize: 12 }} style={{ color: evColor }} />
                    <span style={{ color: '#888' }}>[{String(e.minute).padStart(2, '0')}']</span>
                    <span style={{ fontWeight: 700 }}>{e.team}</span>
                    <span style={{ color: '#bbb' }}>{e.text}</span>
                  </div>
                );
              })}
            </div>

            {activeEntry?.goalFlashSide && (homeTeam || awayTeam) && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div
                  className="vf-goal-pop flex items-center gap-2 px-5 py-2.5 rounded-xl"
                  style={{
                    animation: 'vf-pop 0.4s ease-out',
                    backgroundColor: 'rgba(10,10,10,0.85)',
                    border: `2px solid ${(activeEntry.goalFlashSide === 'home' ? homeTeam : awayTeam)?.color}`,
                    boxShadow: `0 0 30px ${(activeEntry.goalFlashSide === 'home' ? homeTeam : awayTeam)?.color}88`,
                  }}
                >
                  {activeEntry.goalFlashSide === 'home' && homeTeam && <TeamCrest team={homeTeam} size={28} />}
                  {activeEntry.goalFlashSide === 'away' && awayTeam && <TeamCrest team={awayTeam} size={28} />}
                  <WhatshotIcon sx={{ fontSize: 20, color: '#00E676' }} />
                  <span className="font-black text-xl" style={{ fontFamily: "'Orbitron', monospace", color: '#00E676' }}>
                    GOAL!
                  </span>
                </div>
              </div>
            )}

            {activeList.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-20 px-4">
                <div
                  className="text-center rounded-xl px-5 py-4 pointer-events-auto"
                  style={{ backgroundColor: 'rgba(10,10,10,0.72)', border: '1px solid #2A2A2A', maxWidth: '300px' }}
                >
                  <div className="text-sm font-semibold mb-1">Place a bet to kick off</div>
                  <div className="text-xs mb-3" style={{ color: '#888' }}>
                    Minimum stake is <MinStakeNotice />. Pick fixtures from the board and tap Home or Away to add them to
                    your slip — you can back several matches at once and switch between them here.
                  </div>
                  <button
                    onClick={() => setMobileTab('bet')}
                    className="lg:hidden py-2 px-4 rounded-lg text-xs font-semibold"
                    style={{ background: 'linear-gradient(135deg, #00E676, #00B25A)', color: '#0A0A0A' }}
                  >
                    Go to betting
                  </button>
                </div>
              </div>
            )}

            {activeEntry?.phase === 'REVEALING' && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs font-mono" style={{ backgroundColor: 'rgba(17,17,17,0.9)', border: '1px solid #2A2A2A', color: '#FFD166' }}>
                Revealing result…
              </div>
            )}
          </div>

          {/* Live Match Stats — now sits directly under the pitch, always
              visible whenever a round is watched. Cosmetic, driven by the
              same event feed as the commentary chips above. */}
          {activeEntry && homeTeam && awayTeam && (
            <div className="flex flex-col gap-2.5 p-3 m-2 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.28)', border: '1px solid #2A2A2A' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: '#00D4FF' }}>
                  <BarChartIcon sx={{ fontSize: 14 }} />
                  Live match stats
                </div>
                {isWatchedLive && (
                  <span className="flex items-center gap-1 text-[9px] font-bold" style={{ color: '#E8003D' }}>
                    <FiberManualRecordIcon className="vf-pulse-dot" sx={{ fontSize: 7, animation: 'vf-pulse 1.2s ease-in-out infinite' }} />
                    LIVE
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="font-mono font-bold w-9 text-left" style={{ color: '#ccc' }}>
                    {Math.round(activeEntry.stats.possessionHome)}%
                  </span>
                  <span className="flex items-center gap-1 uppercase tracking-wider" style={{ color: '#888', fontSize: '9.5px' }}>
                    <SwapHorizIcon sx={{ fontSize: 12 }} />
                    Possession
                  </span>
                  <span className="font-mono font-bold w-9 text-right" style={{ color: '#ccc' }}>
                    {Math.round(100 - activeEntry.stats.possessionHome)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden flex" style={{ backgroundColor: '#1C1C1C' }}>
                  <div style={{ width: `${activeEntry.stats.possessionHome}%`, backgroundColor: homeTeam.color, transition: 'width 0.4s ease' }} />
                  <div style={{ width: `${100 - activeEntry.stats.possessionHome}%`, backgroundColor: awayTeam.color, transition: 'width 0.4s ease' }} />
                </div>
              </div>

              <StatBar icon={<SportsScoreIcon sx={{ fontSize: 12 }} />} label="Shots" home={activeEntry.stats.shotsHome} away={activeEntry.stats.shotsAway} />
              <StatBar icon={<FlagIcon sx={{ fontSize: 12 }} />} label="Corners" home={activeEntry.stats.cornersHome} away={activeEntry.stats.cornersAway} />
              <StatBar icon={<CropSquareIcon sx={{ fontSize: 12, color: '#FFB300' }} />} label="Cards" home={activeEntry.stats.cardsHome} away={activeEntry.stats.cardsAway} />
            </div>
          )}
        </div>

        {/* Bet / result panel */}
        <aside
          className={`flex-1 flex-col gap-3 p-3 overflow-y-auto ${mobileTab === 'bet' || mobileTab === 'stats' ? 'flex' : 'hidden'} lg:flex`}
          style={{ borderTop: '1px solid #2A2A2A', backgroundColor: 'rgba(17,17,17,0.92)' }}
        >
          <div className={mobileTab === 'stats' ? 'hidden lg:flex lg:flex-col lg:gap-3' : 'flex flex-col gap-3'}>
            {activeEntry && homeTeam && awayTeam ? (
              <div
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TeamCrest team={homeTeam} size={24} />
                  <span className="text-[11px] font-semibold truncate">{homeTeam.name}</span>
                </div>
                <span className="text-xs font-bold flex-shrink-0 px-2" style={{ fontFamily: "'Orbitron', monospace", color: '#888' }}>
                  VS
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold truncate text-right">{awayTeam.name}</span>
                  <TeamCrest team={awayTeam} size={24} />
                </div>
              </div>
            ) : (
              <div className="text-center text-xs py-2" style={{ color: '#666' }}>
                No round watched. Pick a fixture from the board below, or tap a live match above.
              </div>
            )}

            {activeEntry && (activeEntry.phase === 'RUNNING' || activeEntry.phase === 'REVEALING') && (
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest mb-1" style={{ color: '#888' }}>
                  <TimerIcon sx={{ fontSize: 11 }} />
                  Match time
                </div>
                <div className="text-2xl font-bold mb-2" style={{ fontFamily: "'Orbitron', monospace", color: '#00D4FF' }}>
                  {minutesLabel}
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#1C1C1C' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${activeEntry.progress * 100}%`, background: 'linear-gradient(90deg, #00D4FF, #00E676)', transition: 'width 0.3s linear' }}
                  />
                </div>
                <div className="text-[10px] mt-2" style={{ color: '#666' }}>
                  Your stake: <AmountLabel usd={activeEntry.round.stake} /> on {activeEntry.round.betType.toUpperCase()} @{' '}
                  {activeEntry.round.odds.toFixed(2)}
                </div>
              </div>
            )}

            {activeEntry?.result && activeEntry.phase === 'RESULT' && (
              <div
                className="text-center p-3 rounded-lg"
                style={{
                  backgroundColor: activeEntry.result.won ? 'rgba(0,230,118,0.08)' : 'rgba(232,0,61,0.08)',
                  border: `1px solid ${activeEntry.result.won ? 'rgba(0,230,118,0.3)' : 'rgba(232,0,61,0.3)'}`,
                }}
              >
                <div className="text-2xl font-black" style={{ fontFamily: "'Orbitron', monospace" }}>
                  {activeEntry.result.homeScore} – {activeEntry.result.awayScore}
                </div>
                <div className="flex items-center justify-center gap-1 text-sm font-semibold mt-1" style={{ color: activeEntry.result.won ? '#00E676' : '#E8003D' }}>
                  {activeEntry.result.won ? (
                    <>
                      <MilitaryTechIcon sx={{ fontSize: 16 }} />
                      You won <AmountLabel usd={activeEntry.result.payout} />!
                    </>
                  ) : (
                    'Better luck next time'
                  )}
                </div>
              </div>
            )}

            {/* ── League filter + sportsbook board ─────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#00D4FF' }}>
                  Upcoming matches
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: '#555' }}>
                    {boardMatchups.length} fixture{boardMatchups.length === 1 ? '' : 's'} · {leagueTeams.length} team{leagueTeams.length === 1 ? '' : 's'}
                  </span>
                  <button
                    onClick={refreshBoard}
                    disabled={leagueTeams.length < 2}
                    className="flex items-center gap-1 text-[10px] disabled:opacity-40"
                    style={{ color: '#888' }}
                  >
                    <RefreshIcon sx={{ fontSize: 12 }} />
                    Refresh
                  </button>
                </div>
              </div>

              {availableLeagues.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    onClick={() => setSelectedLeague('All')}
                    className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10.5px] font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: selectedLeague === 'All' ? 'rgba(0,230,118,0.15)' : '#161616',
                      border: `1px solid ${selectedLeague === 'All' ? '#00E676' : '#2A2A2A'}`,
                      color: selectedLeague === 'All' ? '#00E676' : '#888',
                    }}
                  >
                    All leagues
                  </button>
                  {availableLeagues.map((lg) => (
                    <button
                      key={lg}
                      onClick={() => setSelectedLeague(lg)}
                      className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10.5px] font-semibold whitespace-nowrap"
                      style={{
                        backgroundColor: selectedLeague === lg ? 'rgba(0,230,118,0.15)' : '#161616',
                        border: `1px solid ${selectedLeague === lg ? '#00E676' : '#2A2A2A'}`,
                        color: selectedLeague === lg ? '#00E676' : '#888',
                      }}
                    >
                      {lg}
                    </button>
                  ))}
                </div>
              )}

              {leagueTeams.length < 2 && (
                <div className="text-[11px] py-3 text-center" style={{ color: '#666' }}>
                  {teams.length < 2 ? 'Team list unavailable right now — try refreshing.' : 'Not enough teams in this league yet.'}
                </div>
              )}

              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-0.5">
                {boardMatchups.map((m) => {
                  const h = deriveTeam(m.home.name);
                  const a = deriveTeam(m.away.name);
                  const picked = betSlip.find((s) => s.matchId === m.id);
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl p-3 flex flex-col gap-2 transition-colors"
                      style={{
                        backgroundColor: picked ? 'rgba(0,230,118,0.055)' : '#141414',
                        border: `1px solid ${picked ? 'rgba(0,230,118,0.4)' : '#232323'}`,
                        borderLeft: `3px solid ${picked ? '#00E676' : h.color}`,
                      }}
                    >
                      {selectedLeague === 'All' && (
                        <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest" style={{ color: '#00D4FF' }}>
                          <EmojiEventsIcon sx={{ fontSize: 10 }} />
                          {m.home.league || 'Other'}
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Match info: Team A vs Team B */}
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <TeamCrest team={h} size={22} />
                            <div className="min-w-0 leading-tight">
                              <div className="text-[11.5px] font-semibold truncate">{h.name}</div>
                              <div className="text-[8.5px] uppercase tracking-wide" style={{ color: '#666' }}>
                                {h.short} · Home
                              </div>
                            </div>
                          </div>
                          <span
                            className="text-[9px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                            style={{ color: '#777', backgroundColor: '#0A0A0A', border: '1px solid #2A2A2A' }}
                          >
                            VS
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end text-right">
                            <div className="min-w-0 leading-tight">
                              <div className="text-[11.5px] font-semibold truncate">{a.name}</div>
                              <div className="text-[8.5px] uppercase tracking-wide" style={{ color: '#666' }}>
                                Away · {a.short}
                              </div>
                            </div>
                            <TeamCrest team={a} size={22} />
                          </div>
                        </div>

                        {/* Odds card — Home / Away always in a row, like a 1X2 line */}
                        <div
                          className="flex flex-row items-stretch gap-1.5 flex-shrink-0 w-full sm:w-[172px] rounded-lg p-1.5"
                          style={{ backgroundColor: '#0F0F0F', border: '1px solid #222' }}
                        >
                          <button
                            disabled={!oddsPreview}
                            onClick={() => selectMarket(m, 'home')}
                            className="flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-md border transition-colors disabled:opacity-50"
                            style={oddsBtnStyle(picked?.betType === 'home')}
                          >
                            <span
                              className="text-[8px] font-bold uppercase tracking-wider"
                              style={{ color: picked?.betType === 'home' ? '#00E676' : '#888' }}
                            >
                              1 · {h.short}
                            </span>
                            <span className="font-mono text-sm font-bold">{oddsPreview ? oddsPreview.home.toFixed(2) : '—'}</span>
                          </button>
                          <div className="w-px my-1" style={{ backgroundColor: '#222' }} />
                          <button
                            disabled={!oddsPreview}
                            onClick={() => selectMarket(m, 'away')}
                            className="flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-md border transition-colors disabled:opacity-50"
                            style={oddsBtnStyle(picked?.betType === 'away')}
                          >
                            <span
                              className="text-[8px] font-bold uppercase tracking-wider"
                              style={{ color: picked?.betType === 'away' ? '#00E676' : '#888' }}
                            >
                              2 · {a.short}
                            </span>
                            <span className="font-mono text-sm font-bold">{oddsPreview ? oddsPreview.away.toFixed(2) : '—'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Default stake quick-picks — sets the stake used for new
                selections, and (if the slip already has entries) applies
                the same amount across every current pick for convenience. */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#00D4FF' }}>
                  Stake per pick
                </span>
                <span className="text-[10px]" style={{ color: '#666' }}>
                  Min <MinStakeNotice />
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_AMOUNTS_USD.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => applyStakeToAll(amt)}
                    className="py-1.5 rounded text-xs"
                    style={{
                      backgroundColor: defaultStakeUsd === amt ? 'rgba(0,230,118,0.12)' : '#1C1C1C',
                      border: `1px solid ${defaultStakeUsd === amt ? '#00E676' : '#2A2A2A'}`,
                      color: defaultStakeUsd === amt ? '#00E676' : '#888',
                    }}
                  >
                    <AmountLabel usd={amt} />
                  </button>
                ))}
              </div>
            </div>

            {betSlip.length > 0 && (
              <button
                onClick={() => setSlipModalOpen(true)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)' }}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#00E676' }}>
                  <TrackChangesIcon sx={{ fontSize: 14 }} />
                  {betSlip.length} pick{betSlip.length === 1 ? '' : 's'} in your slip
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: '#00E676' }}>
                  Review & place →
                </span>
              </button>
            )}

            {safeHistory.length > 0 && (
              <div className="flex flex-col gap-1 pt-1">
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
                  <EmojiEventsIcon sx={{ fontSize: 13 }} />
                  Recent results
                </div>
                {safeHistory.slice(0, 6).map((h, i) => (
                  <div
                    key={`${h.at}-${i}`}
                    className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded"
                    style={{ backgroundColor: '#1C1C1C' }}
                  >
                    <span className="truncate">
                      {h.home} {h.score} {h.away}
                    </span>
                    {h.won ? <CheckCircleIcon sx={{ fontSize: 14, color: '#00E676' }} /> : <CancelIcon sx={{ fontSize: 14, color: '#E8003D' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History-only view for the mobile "stats" tab */}
          <div className={`flex-col gap-2 pt-3 mt-1 ${mobileTab === 'stats' ? 'flex' : 'hidden'} lg:hidden`} style={{ borderTop: '1px solid #2A2A2A' }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#888' }}>
              All recent results
            </div>
            {safeHistory.length === 0 && (
              <div className="text-xs" style={{ color: '#666' }}>
                No settled rounds yet.
              </div>
            )}
            {safeHistory.map((h, i) => (
              <div
                key={`${h.at}-${i}-full`}
                className="flex items-center justify-between text-[11px] font-mono px-2 py-1.5 rounded"
                style={{ backgroundColor: '#1C1C1C' }}
              >
                <span className="truncate">
                  {h.home} {h.score} {h.away}
                </span>
                {h.won ? <CheckCircleIcon sx={{ fontSize: 14, color: '#00E676' }} /> : <CancelIcon sx={{ fontSize: 14, color: '#E8003D' }} />}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Bet slip bottom-sheet — pops up the instant odds are tapped.
          Closing it (✕ or backdrop tap) keeps every selection intact so the
          user can go tap more odds; reachable again via the floating pill
          below without ever needing to scroll. ─────────────────────────── */}
      {slipModalOpen && (
        <div
          className="vf-sheet-backdrop absolute inset-0 z-40 flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', animation: 'vf-fadein 0.15s ease-out' }}
          onClick={() => setSlipModalOpen(false)}
        >
          <div
            className="vf-sheet w-full rounded-t-2xl flex flex-col"
            style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A', borderBottom: 'none', maxHeight: '84%', animation: 'vf-slideup 0.25s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #2A2A2A' }}>
              <div className="flex items-center gap-2">
                <TrackChangesIcon sx={{ fontSize: 16, color: '#00D4FF' }} />
                <span className="text-sm font-bold uppercase tracking-wide">Bet slip</span>
                {betSlip.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#00E676', color: '#0A0A0A' }}>
                    {betSlip.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSlipModalOpen(false)}
                aria-label="Close bet slip"
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: '#1C1C1C', border: '1px solid #2A2A2A' }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {betSlip.length === 0 ? (
                <div className="text-center text-xs py-6" style={{ color: '#666' }}>
                  No selections yet — close this and tap odds on the board to add a pick.
                </div>
              ) : (
                betSlip.map((s) => renderSlipRow(s))
              )}
              <button
                onClick={() => setSlipModalOpen(false)}
                className="text-center text-[11px] py-2.5 rounded-md"
                style={{ color: '#00D4FF', border: '1px dashed #2A2A2A' }}
              >
                + Close and tap more odds to add another pick
              </button>
            </div>

            <div className="flex-shrink-0 px-4 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid #2A2A2A', backgroundColor: '#111111' }}>
              {betSlip.length > 0 && (
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-md"
                  style={{ backgroundColor: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)' }}
                >
                  <span className="text-xs" style={{ color: '#888' }}>
                    Total stake ({betSlip.length}):
                  </span>
                  <AmountLabel usd={slipTotalStake} primaryClassName="font-mono text-sm font-bold" primaryStyle={{ color: '#00E676' }} />
                </div>
              )}
              <button
                onClick={placeAllBets}
                disabled={placing || betSlip.length === 0 || !oddsPreview || slipBelowMin || slipOverBalance || slipTooBig}
                className="py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #00E676, #00B25A)',
                  color: '#0A0A0A',
                  boxShadow: '0 0 20px rgba(0,230,118,0.35)',
                }}
              >
                {placing
                  ? 'PLACING…'
                  : betSlip.length > 1
                  ? `PLACE ${betSlip.length} BETS & KICK OFF`
                  : 'PLACE BET & KICK OFF'}
              </button>
              {slipTooBig && (
                <div className="text-center text-[10px]" style={{ color: '#FFB300' }}>
                  Only {availableSlots} more match{availableSlots === 1 ? '' : 'es'} can run at once ({activeList.length}/{MAX_CONCURRENT_ROUNDS} live)
                </div>
              )}
              {betStatus && (
                <div className="text-center text-xs font-medium" style={{ color: betStatus.color }}>
                  {betStatus.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating status toast / "view slip" pill — pinned to the bottom
          of the whole widget so the slip (or the latest status message) is
          always one tap away, no scrolling required. The pill itself is
          icon + count + total stake only — no "View slip" label text. ──── */}
      {!slipModalOpen && betStatus && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full text-xs font-semibold text-center max-w-[90%]"
          style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A', color: betStatus.color, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
        >
          {betStatus.text}
        </div>
      )}
      {!slipModalOpen && !betStatus && betSlip.length > 0 && (
        <button
          onClick={() => setSlipModalOpen(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg, #00E676, #00B25A)', color: '#0A0A0A', boxShadow: '0 4px 20px rgba(0,230,118,0.45)' }}
        >
          <TrackChangesIcon sx={{ fontSize: 16 }} />
          {betSlip.length} · <AmountLabel usd={slipTotalStake} />
        </button>
      )}
    </div>
  );
}