// ---------------------------------------------------------------------------
// super bet match details — SKYBET layout
// Restyled to match the SkyBet Header.tsx theme (Inter, navy #0a1628/#0d1f3c/
// #082f49, blue accent #3b82f6/#60a5fa) and restructured after the reference
// sportsbook screenshot: breadcrumb + VS header, horizontal market tab bar
// with counts, market cards with solid title bars and divided odds rows, and
// a sticky bet-slip summary panel on the right.
// ---------------------------------------------------------------------------

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import api from '../utils/api';
import type { Match } from '../utils/api';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SportsIcon from '@mui/icons-material/Sports';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';

// ---------------------------------------------------------------------------
// Design tokens — lifted straight from Header.tsx so this page reads as the
// same product, not a re-skinned generic template.
// ---------------------------------------------------------------------------
const T = {
  page:        '#0a1628',
  card:        '#0d1f3c',
  cardHead:    '#082f49',
  border:      'rgba(255,255,255,0.08)',
  borderSoft:  'rgba(255,255,255,0.06)',
  text:        '#ffffff',
  textMuted:   'rgba(255,255,255,0.55)',
  textFaint:   'rgba(255,255,255,0.35)',
  accent:      '#3b82f6',
  accentLight: '#60a5fa',
  accentSoft:  'rgba(59, 130, 246,0.18)',
  live:        '#ef4444',
  font:        "'Inter', sans-serif",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OddsOption { label: string; odd: number; }
interface OddsGroup  { market: string; options: OddsOption[]; }

// ---------------------------------------------------------------------------
// Status sets
// ---------------------------------------------------------------------------
const LIVE_STATUSES = new Set([
  'LIVE','live','IN_PLAY','in_play','inplay',
  'FIRST_HALF','first_half','1H','1h',
  'SECOND_HALF','second_half','2H','2h',
  'HALFTIME','halftime','HALF_TIME','half_time','HT','ht',
  'EXTRA_TIME','extra_time','ET','et','ET1','et1','ET2','et2',
  'PENALTIES','penalties','PEN','pen','P','SHOOTOUT','shootout',
  'BREAK','break','SUSPENDED','suspended',
  'STATUS_IN_PROGRESS','STATUS_HALFTIME','STATUS_END_PERIOD',
  'STATUS_OVERTIME','STATUS_FIRST_HALF','STATUS_SECOND_HALF',
]);

const FINISHED_STATUSES = new Set([
  'FINISHED','finished','FULL_TIME','full_time','FT','ft',
  'AWARDED','awarded','CANCELLED','cancelled','CANCELED','canceled',
  'POSTPONED','postponed','ABANDONED','abandoned','VOID','void',
  'AFTER_EXTRA_TIME','after_extra_time','AET','aet',
  'AFTER_PENALTIES','after_penalties','AP','ap',
  'ENDED','ended','COMPLETED','completed','COMPLETE','complete',
  'WALKOVER','walkover','RETIRED','retired',
  'STATUS_FINAL','STATUS_FULL_TIME','STATUS_POSTPONED',
  'STATUS_CANCELED','STATUS_SUSPENDED','STATUS_ABANDONED',
]);

const HALFTIME_STATUSES = new Set([
  'HALFTIME','halftime','HALF_TIME','half_time','HT','ht','STATUS_HALFTIME',
]);

const EXTRA_TIME_STATUSES = new Set([
  'EXTRA_TIME','extra_time','ET','et','ET1','et1','ET2','et2','STATUS_OVERTIME',
]);

const PENALTY_STATUSES = new Set([
  'PENALTIES','penalties','PEN','pen','SHOOTOUT','shootout',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatKickoff(kickoffAt?: string) {
  if (!kickoffAt) return '--:--';
  return new Date(kickoffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
function formatDate(kickoffAt?: string) {
  if (!kickoffAt) return '';
  return new Date(kickoffAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}
function finishedLabel(status?: string) {
  const s = status ?? '';
  if (['FINISHED','finished','FULL_TIME','full_time','FT','ft','AWARDED','awarded','ENDED','ended','COMPLETED','completed','COMPLETE','complete','STATUS_FINAL','STATUS_FULL_TIME'].includes(s)) return 'FT';
  if (['AFTER_EXTRA_TIME','after_extra_time','AET','aet'].includes(s)) return 'AET';
  if (['AFTER_PENALTIES','after_penalties','AP','ap'].includes(s)) return 'PEN';
  if (['POSTPONED','postponed','STATUS_POSTPONED'].includes(s)) return 'PPD';
  if (['CANCELLED','cancelled','CANCELED','canceled','STATUS_CANCELED'].includes(s)) return 'CANC';
  if (['ABANDONED','abandoned','STATUS_ABANDONED'].includes(s)) return 'ABD';
  if (['VOID','void'].includes(s)) return 'VOID';
  return 'FT';
}

function norm(s: string) { return s.toLowerCase().replace(/[\s_\-]/g, ''); }

// ---------------------------------------------------------------------------
// Live Timer Hook
// ---------------------------------------------------------------------------
function useLiveTimer(match: Match | null): string {
  const status = match?.status ?? '';
  const isLive = LIVE_STATUSES.has(status);

  const getElapsedMins = useCallback((): number => {
    if (match?.kickoffAt) {
      const kickoffMs = new Date(match.kickoffAt).getTime();
      const elapsedMs = Date.now() - kickoffMs;
      if (elapsedMs >= 0) return Math.floor(elapsedMs / 60_000);
    }
    return match?.minutePlayed ?? 0;
  }, [match?.kickoffAt, match?.minutePlayed]);

  const [elapsed, setElapsed] = useState<number>(getElapsedMins);

  useEffect(() => {
    if (!isLive) return;
    setElapsed(getElapsedMins());
    const id = setInterval(() => setElapsed(getElapsedMins()), 30_000);
    return () => clearInterval(id);
  }, [isLive, getElapsedMins]);

  if (!match || !isLive) return '';
  if (HALFTIME_STATUSES.has(status)) return 'HT';
  if (PENALTY_STATUSES.has(status))  return 'PEN';
  if (EXTRA_TIME_STATUSES.has(status)) return `${Math.min(elapsed, 120)}' ET`;
  const displayMin = match.minutePlayed != null ? match.minutePlayed : Math.min(elapsed, 90);
  return `${displayMin}'`;
}

// ---------------------------------------------------------------------------
// Sport detection
// ---------------------------------------------------------------------------
type SportKind = 'football' | 'basketball' | 'nfl' | 'baseball' | 'mma' | 'tennis' | 'admin';

function detectSport(match: Match): SportKind {
  const sport  = (match.sport ?? match.sportEnum ?? '').toLowerCase();
  const source = (match.source ?? '').toUpperCase();
  if (source === 'ADMIN_CREATED') return 'admin';
  if (sport.includes('basket') || sport === 'basketball') return 'basketball';
  if (sport.includes('american') || sport === 'nfl' || sport === 'american_football') return 'nfl';
  if (sport.includes('baseball')) return 'baseball';
  if (sport === 'mma') return 'mma';
  if (sport === 'tennis') return 'tennis';
  return 'football';
}

// ---------------------------------------------------------------------------
// Admin odds classification helpers
// ---------------------------------------------------------------------------
function isScoreLabel(label: string): boolean {
  return /^\d+[\:\-]\d+$/.test(label.trim());
}

const HT_KEYWORDS = ['halftime', 'half-time', 'half time', 'ht ', 'ht/', 'firsthalf', 'first half', '2ndhalf', 'second half'];
function isHalfTimeMarket(market: string): boolean {
  const m = market.toLowerCase();
  return HT_KEYWORDS.some((kw) => m.includes(kw));
}

const HANDICAP_KEYWORDS = ['handicap', 'asian', 'spread', 'ah ', 'ah/'];
function isHandicapMarket(market: string): boolean {
  const m = market.toLowerCase();
  return HANDICAP_KEYWORDS.some((kw) => m.includes(kw));
}

interface AdminOddsClassified {
  odds1x2:          OddsGroup[];
  oddsHalfTime:     OddsGroup[];
  oddsCorrectScore: OddsGroup[];
  oddsHandicap:     OddsGroup[];
}

function classifyAdminOdds(raw: unknown[]): AdminOddsClassified {
  const result: AdminOddsClassified = {
    odds1x2: [], oddsHalfTime: [], oddsCorrectScore: [], oddsHandicap: [],
  };

  if (!raw.length) return result;

  const marketMap = new Map<string, Array<{ selection: string; odd: number; handicap?: string }>>();
  for (const row of raw as Array<Record<string, unknown>>) {
    const market    = String(row.market ?? row.name ?? 'match_result');
    const selection = String(row.selection ?? row.outcome ?? row.label ?? '');
    const odd       = Number(row.value ?? row.odd ?? row.odds ?? row.price ?? 0);
    if (!selection || odd <= 0) continue;
    const handicap  = row.handicap != null ? String(row.handicap) : undefined;
    if (!marketMap.has(market)) marketMap.set(market, []);
    marketMap.get(market)!.push({ selection, odd, handicap });
  }

  for (const [market, entries] of marketMap.entries()) {
    const options: OddsOption[] = entries.map((e) => ({
      label: e.handicap ? `${e.selection} (${e.handicap})` : e.selection,
      odd:   Math.round(e.odd * 100) / 100,
    }));

    const group: OddsGroup = { market, options };

    if (isHandicapMarket(market) || entries.some((e) => e.handicap)) {
      result.oddsHandicap.push(group);
      continue;
    }
    if (isHalfTimeMarket(market)) {
      result.oddsHalfTime.push(group);
      continue;
    }
    if (options.length >= 2 && options.every((o) => isScoreLabel(o.label))) {
      result.oddsCorrectScore.push(group);
      continue;
    }
    const mn = market.toLowerCase();
    if (mn.includes('correct') || mn.includes('exactscore') || mn.includes('exact score') || mn.includes('score')) {
      const selLabels = options.map((o) => norm(o.label));
      const is1x2 = selLabels.some(
        (l) => l === '1' || l === 'home' || l === '2' || l === 'away' || l === 'draw' || l === 'x',
      );
      if (!is1x2) {
        result.oddsCorrectScore.push(group);
        continue;
      }
    }
    result.odds1x2.push(group);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Odds parser
// ---------------------------------------------------------------------------
function parseOddsGroups(raw: unknown, _context: string): OddsGroup[] {
  if (!raw) return [];
  let payload: unknown = raw;
  if (typeof raw === 'object' && raw !== null && 'data' in (raw as Record<string, unknown>)) {
    payload = (raw as Record<string, unknown>).data;
  }
  if (Array.isArray(payload)) {
    const first = payload[0] as Record<string, unknown> | undefined;
    if (first && 'market' in first && 'options' in first) return payload as OddsGroup[];
    const rows = payload as Array<Record<string, unknown>>;
    if (!rows.length) return [];
    const hasHandicap = rows.some((r) => r.handicap != null);
    if (hasHandicap) {
      const lineMap = new Map<string, Map<string, number[]>>();
      const lineOrder: string[] = [];
      for (const o of rows) {
        const handicap = String(o.handicap ?? '');
        const sel      = String(o.selection ?? o.outcome ?? o.label ?? '');
        const odd      = Number(o.value ?? o.odd ?? o.odds ?? o.price ?? 0);
        if (!sel || !handicap || odd <= 0) continue;
        if (!lineMap.has(handicap)) { lineMap.set(handicap, new Map()); lineOrder.push(handicap); }
        const selMap = lineMap.get(handicap)!;
        if (!selMap.has(sel)) selMap.set(sel, []);
        selMap.get(sel)!.push(odd);
      }
      const used = new Set<string>();
      const groups: OddsGroup[] = [];
      const sorted = [...lineOrder].sort((a, b) => parseFloat(a) - parseFloat(b));
      for (const line of sorted) {
        if (used.has(line)) continue;
        const mirrorVal = parseFloat(line) * -1;
        const mirrorKey = lineOrder.find((l) => Math.abs(parseFloat(l) - mirrorVal) < 0.001);
        const options: OddsOption[] = [];
        const addFromMap = (key: string) => {
          const selMap = lineMap.get(key);
          if (!selMap) return;
          for (const [sel, odds] of selMap.entries()) {
            const avg = odds.reduce((a, b) => a + b, 0) / odds.length;
            options.push({ label: `${sel} (${key})`, odd: Math.round(avg * 100) / 100 });
          }
        };
        addFromMap(line);
        if (mirrorKey && mirrorKey !== line) { addFromMap(mirrorKey); used.add(mirrorKey); }
        used.add(line);
        if (options.length > 0) {
          const groupLabel = mirrorKey && mirrorKey !== line ? `${line} / ${mirrorKey}` : line;
          groups.push({ market: groupLabel, options });
        }
      }
      return groups;
    }
    const marketMap = new Map<string, Map<string, number[]>>();
    for (const o of rows) {
      const market = String(o.market ?? o.name ?? o.type ?? 'Other');
      const sel    = String(o.selection ?? o.outcome ?? o.label ?? o.name ?? '');
      const odd    = Number(o.value ?? o.odd ?? o.odds ?? o.price ?? 0);
      if (!sel || odd <= 0) continue;
      if (!marketMap.has(market)) marketMap.set(market, new Map());
      const selMap = marketMap.get(market)!;
      if (!selMap.has(sel)) selMap.set(sel, []);
      selMap.get(sel)!.push(odd);
    }
    const groups: OddsGroup[] = [];
    for (const [market, selMap] of marketMap.entries()) {
      const options: OddsOption[] = [];
      for (const [sel, odds] of selMap.entries()) {
        const avg = odds.reduce((a, b) => a + b, 0) / odds.length;
        options.push({ label: sel, odd: Math.round(avg * 100) / 100 });
      }
      groups.push({ market, options });
    }
    return groups;
  }
  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as Record<string, unknown>;
    const groups: OddsGroup[] = [];
    for (const [market, entries] of Object.entries(obj)) {
      if (!Array.isArray(entries)) continue;
      const options = (entries as Array<Record<string, unknown>>)
        .map((e) => ({
          label: String(e.selection ?? e.outcome ?? e.name ?? e.label ?? ''),
          odd:   Number(e.value ?? e.odd ?? e.odds ?? e.price ?? 0),
        }))
        .filter((o) => o.odd > 0 && o.label);
      if (options.length > 0) groups.push({ market, options });
    }
    return groups;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Correct Score helpers
// ---------------------------------------------------------------------------
function parseCorrectScoreGroups(groups: OddsGroup[]) {
  const all = groups.flatMap((g) => g.options);
  const map = new Map<string, number>();
  for (const o of all) {
    const existing = map.get(o.label);
    if (existing === undefined || o.odd < existing) map.set(o.label, o.odd);
  }
  const parseScore = (s: string) => {
    const m = s.match(/(\d+)[:\-](\d+)/);
    return m ? { h: parseInt(m[1]), a: parseInt(m[2]) } : null;
  };
  return [...map.entries()]
    .map(([label, odd]) => ({ label, odd }))
    .sort((a, b) => {
      const am = parseScore(a.label), bm = parseScore(b.label);
      if (!am || !bm) return a.label.localeCompare(b.label);
      const atype = am.h > am.a ? 0 : am.h === am.a ? 1 : 2;
      const btype = bm.h > bm.a ? 0 : bm.h === bm.a ? 1 : 2;
      if (atype !== btype) return atype - btype;
      return (am.h + am.a) - (bm.h + bm.a);
    });
}

// ---------------------------------------------------------------------------
// API fetch helpers
// ---------------------------------------------------------------------------
const ADMIN_ODDS_BASE = 'https://futballbackend-iw9o.onrender.com';

async function fetchAdminOddsRaw(id: string): Promise<unknown[]> {
  try {
    const raw = await fetch(
      `${ADMIN_ODDS_BASE}/api/public/admin-matches/${id}/odds`
    ).then((r) => r.json());
    if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).data)) {
      return (raw as Record<string, unknown>).data as unknown[];
    }
    if (Array.isArray(raw)) return raw;
    return [];
  } catch (err) {
    console.warn(`[AdminOdds] Failed to fetch odds for match ${id}:`, err);
    return [];
  }
}

async function fetchMatchById(id: string, sport: SportKind): Promise<Match> {
  let res: unknown;
  switch (sport) {
    case 'basketball': res = await api.publicBasketball.getById(id); break;
    case 'nfl':        res = await api.publicNfl.getById(id);        break;
    case 'baseball':   res = await api.publicBaseball.getById(id);   break;
    case 'mma':        res = await api.publicMma.getById(id);        break;
    case 'tennis':     res = await api.publicTennis.getById(id);     break;
    case 'admin':      res = await api.publicAdminMatches.getById(id); break;
    default:           res = await api.publicFootball.getById(id);   break;
  }
  return ((res as Record<string, unknown>)?.data as Match) ?? (res as Match);
}

interface AllOddsResult {
  odds1x2:          OddsGroup[];
  oddsHalfTime:     OddsGroup[];
  oddsCorrectScore: OddsGroup[];
  oddsHandicap:     OddsGroup[];
}

async function fetchAllOddsForSport(id: string, sport: SportKind): Promise<AllOddsResult> {
  const empty: AllOddsResult = { odds1x2: [], oddsHalfTime: [], oddsCorrectScore: [], oddsHandicap: [] };

  if (sport === 'admin') {
    const rawOdds = await fetchAdminOddsRaw(id);
    if (!rawOdds.length) return empty;
    return classifyAdminOdds(rawOdds);
  }

  if (sport === 'football') {
    const [r1, r2, r3, r4] = await Promise.allSettled([
      api.publicFootball.odds(id),
      api.publicFootball.oddsHalfTime(id),
      api.publicFootball.oddsCorrectScore(id),
      api.publicFootball.oddsHandicap(id),
    ]);
    if (r1.status === 'fulfilled') empty.odds1x2          = parseOddsGroups(r1.value, 'football:1x2');
    if (r2.status === 'fulfilled') empty.oddsHalfTime     = parseOddsGroups(r2.value, 'football:halfTime');
    if (r3.status === 'fulfilled') empty.oddsCorrectScore = parseOddsGroups(r3.value, 'football:correctScore');
    if (r4.status === 'fulfilled') empty.oddsHandicap     = parseOddsGroups(r4.value, 'football:handicap');
    return empty;
  }

  if (sport === 'basketball') {
    const [r1, r2, r3] = await Promise.allSettled([
      api.publicBasketball.oddsMoneyline(id),
      api.publicBasketball.oddsSpread(id),
      api.publicBasketball.oddsTotal(id),
    ]);
    if (r1.status === 'fulfilled') empty.odds1x2      = parseOddsGroups(r1.value, 'basketball:moneyline');
    if (r2.status === 'fulfilled') empty.oddsHandicap = parseOddsGroups(r2.value, 'basketball:spread');
    if (r3.status === 'fulfilled') empty.oddsHalfTime = parseOddsGroups(r3.value, 'basketball:total');
    return empty;
  }

  if (sport === 'nfl') {
    const [r1] = await Promise.allSettled([api.publicNfl.oddsAll(id)]);
    if (r1.status === 'fulfilled') empty.odds1x2 = parseOddsGroups(r1.value, 'nfl:all');
    return empty;
  }

  if (sport === 'baseball') {
    const [r1] = await Promise.allSettled([api.publicBaseball.odds(id)]);
    if (r1.status === 'fulfilled') empty.odds1x2 = parseOddsGroups(r1.value, 'baseball:1x2');
    return empty;
  }

  if (sport === 'mma') {
    const [r1] = await Promise.allSettled([api.publicMma.oddsAll(id)]);
    if (r1.status === 'fulfilled') empty.odds1x2 = parseOddsGroups(r1.value, 'mma:all');
    return empty;
  }

  if (sport === 'tennis') {
    const [r1] = await Promise.allSettled([api.publicTennis.odds(id)]);
    if (r1.status === 'fulfilled') empty.odds1x2 = parseOddsGroups(r1.value, 'tennis:1x2');
    return empty;
  }

  return empty;
}

// ---------------------------------------------------------------------------
// UI Primitives — SkyBet navy theme, reference-image layout
// ---------------------------------------------------------------------------
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={className} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8 }} />;
}

/** Solid title bar used at the top of every market card — mirrors the
 *  "MATCH WINNER / DOUBLE CHANCE / DRAW NO BET" bars in the reference. */
function MarketCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden mb-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="px-4 py-2.5" style={{ background: T.cardHead, borderBottom: `1px solid ${T.border}` }}>
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: T.text, fontFamily: T.font }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/** A single divided row of odds cells — label above, odd below, thin
 *  vertical rules between cells, exactly like the reference screenshot. */
function MarketRow({
  cells, locked, wrap = false,
}: {
  cells: { label: string; odd: number; selected: boolean; onClick: () => void }[];
  locked?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className={wrap ? 'flex flex-wrap' : 'flex'} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
      {cells.map((c, i) => {
        const disabled = locked || c.odd <= 0;
        return (
          <button
            key={i}
            disabled={disabled}
            onClick={c.onClick}
            className={wrap ? 'flex flex-col items-center justify-center gap-1 py-3.5 px-2' : 'flex-1 flex flex-col items-center justify-center gap-1 py-3.5 px-2 min-w-0'}
            style={{
              flexBasis: wrap ? '25%' : undefined,
              borderRight: !wrap && i < cells.length - 1 ? `1px solid ${T.borderSoft}` : undefined,
              borderBottom: wrap ? `1px solid ${T.borderSoft}` : undefined,
              background: c.selected ? T.accentSoft : 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: c.odd <= 0 ? 0.35 : 1,
              transition: 'background 0.12s',
              fontFamily: T.font,
            }}
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-wide text-center leading-tight truncate max-w-full px-1"
              style={{ color: c.selected ? T.accentLight : T.textMuted }}
            >
              {c.label}
            </span>
            <span className="text-base font-black tabular-nums" style={{ color: locked ? T.textFaint : c.selected ? T.accentLight : T.text }}>
              {locked ? <LockIcon sx={{ fontSize: 15 }} /> : c.odd > 0 ? c.odd.toFixed(2) : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LockedBanner() {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold mb-3"
      style={{ background: T.card, border: `1px dashed ${T.border}`, color: T.textMuted, fontFamily: T.font }}
    >
      <LockIcon sx={{ fontSize: 15 }} /> Odds locked — match has finished
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-sm py-8" style={{ color: T.textFaint, fontFamily: T.font }}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Match 1X2 / Moneyline Panel
// ---------------------------------------------------------------------------
function Match1x2Panel({ groups, matchId, matchName, homeTeam, awayTeam, locked, sport }: {
  groups: OddsGroup[]; matchId: string; matchName: string;
  homeTeam: string; awayTeam: string; locked: boolean; sport: SportKind;
}) {
  const { betSlip, addToBetSlip, showToast } = useAppStore();
  const isSel = (market: string, sel: string) =>
    betSlip.some((s) => s.matchId === matchId && s.market === market && s.selection === sel);
  const pick = (market: string, sel: string, odd: number) => {
    if (locked) return;
    addToBetSlip({ matchId, matchName, market, selection: sel, odd });
    showToast('Added to bet slip', 'success');
  };

  if (!groups.length) return <EmptyNote>No odds available yet.</EmptyNote>;

  const hasDraw    = sport === 'football' || sport === 'admin';
  const panelTitle = sport === 'basketball' || sport === 'nfl' ? 'Moneyline' : 'Match Winner';

  const main = groups.find((g) => {
    const m = norm(g.market);
    return m.includes('1x2') || m.includes('matchresult') || m.includes('matchodds')
      || m === 'fulltime' || m.includes('moneyline') || m.includes('winner') || m === 'matchresult';
  }) ?? groups.find((g) => g.options.length === (hasDraw ? 3 : 2)) ?? groups[0];
  const rest = groups.filter((g) => g !== main);

  const findBy = (kw: string) => main.options.find((o) => { const s = norm(o.label); return s === kw || s.includes(kw); });
  let homeOpt = findBy('1') ?? findBy(norm(homeTeam));
  let drawOpt = hasDraw ? (findBy('draw') ?? findBy('x')) : undefined;
  let awayOpt = findBy('2') ?? findBy(norm(awayTeam));

  if (!homeOpt && !awayOpt) {
    if (hasDraw && main.options.length >= 3) [homeOpt, drawOpt, awayOpt] = main.options;
    else [homeOpt, awayOpt] = main.options;
  }

  const assigned = new Set([homeOpt, drawOpt, awayOpt]);
  const rem = main.options.filter((o) => !assigned.has(o));
  homeOpt ??= rem.shift() ?? { label: '—', odd: 0 };
  if (hasDraw) drawOpt ??= rem.shift() ?? { label: '—', odd: 0 };
  awayOpt ??= rem.shift() ?? { label: '—', odd: 0 };

  const slots = hasDraw
    ? [
        { label: homeTeam.toUpperCase(), opt: homeOpt! },
        { label: 'DRAW',                  opt: drawOpt! },
        { label: awayTeam.toUpperCase(), opt: awayOpt! },
      ]
    : [
        { label: homeTeam.toUpperCase(), opt: homeOpt! },
        { label: awayTeam.toUpperCase(), opt: awayOpt! },
      ];

  return (
    <>
      {locked && <LockedBanner />}
      <MarketCard title={panelTitle}>
        <MarketRow
          cells={slots.map((s) => ({
            label: s.label, odd: s.opt.odd,
            selected: isSel(main.market, s.opt.label),
            onClick: () => s.opt.odd > 0 && pick(main.market, s.opt.label, s.opt.odd),
          }))}
          locked={locked}
        />
      </MarketCard>
      {rest.map((group, gi) => (
        <MarketCard key={gi} title={group.market.replace(/_/g, ' ')}>
          <MarketRow
            cells={group.options.map((opt) => ({
              label: opt.label, odd: opt.odd,
              selected: isSel(group.market, opt.label),
              onClick: () => pick(group.market, opt.label, opt.odd),
            }))}
            locked={locked}
            wrap={group.options.length > 3}
          />
        </MarketCard>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Half Time / Totals Panel
// ---------------------------------------------------------------------------
function HalfTimePanel({ groups, matchId, matchName, locked, sport }: {
  groups: OddsGroup[]; matchId: string; matchName: string; locked: boolean; sport: SportKind;
}) {
  const { betSlip, addToBetSlip, showToast } = useAppStore();
  const isSel = (market: string, sel: string) =>
    betSlip.some((s) => s.matchId === matchId && s.market === market && s.selection === sel);
  const pick = (market: string, sel: string, odd: number) => {
    if (locked) return;
    addToBetSlip({ matchId, matchName, market, selection: sel, odd });
    showToast('Added to bet slip', 'success');
  };

  const panelTitle = sport === 'basketball' ? 'Totals (Over/Under)' : 'Half Time Result';

  if (!groups.length) return (
    <EmptyNote>{sport === 'basketball' ? 'No totals available.' : 'No half-time odds available.'}</EmptyNote>
  );

  return (
    <>
      {locked && <LockedBanner />}
      {groups.map((group, gi) => (
        <MarketCard key={gi} title={group.market.replace(/_/g, ' ') || panelTitle}>
          <MarketRow
            cells={group.options.map((opt) => ({
              label: opt.label, odd: opt.odd,
              selected: isSel(group.market, opt.label),
              onClick: () => pick(group.market, opt.label, opt.odd),
            }))}
            locked={locked}
            wrap={group.options.length > 3}
          />
        </MarketCard>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Correct Score Panel
// ---------------------------------------------------------------------------
function CorrectScorePanel({ groups, matchId, matchName, homeTeam, awayTeam, locked }: {
  groups: OddsGroup[]; matchId: string; matchName: string;
  homeTeam: string; awayTeam: string; locked: boolean;
}) {
  const { betSlip, addToBetSlip, showToast } = useAppStore();
  const isSel = (market: string, sel: string) =>
    betSlip.some((s) => s.matchId === matchId && s.market === market && s.selection === sel);
  const pick = (market: string, sel: string, odd: number) => {
    if (locked) return;
    addToBetSlip({ matchId, matchName, market, selection: sel, odd });
    showToast('Added to bet slip', 'success');
  };

  const scores = parseCorrectScoreGroups(groups);
  const market = groups[0]?.market ?? 'correct_score';
  if (!scores.length) return <EmptyNote>No correct score odds available.</EmptyNote>;

  const parseScore = (s: string) => { const m = s.match(/(\d+)[:\-](\d+)/); return m ? { h: parseInt(m[1]), a: parseInt(m[2]) } : null; };
  const homeWins: typeof scores = [], draws: typeof scores = [], awayWins: typeof scores = [], other: typeof scores = [];
  for (const s of scores) {
    const p = parseScore(s.label);
    if (!p) { other.push(s); continue; }
    if (p.h > p.a) homeWins.push(s);
    else if (p.h === p.a) draws.push(s);
    else awayWins.push(s);
  }

  const Section = ({ title, tint, items }: { title: string; tint: string; items: typeof scores }) => {
    if (!items.length) return null;
    return (
      <div className="rounded-lg overflow-hidden mb-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
        <div className="px-4 py-2.5" style={{ background: tint }}>
          <span className="text-xs font-extrabold uppercase tracking-widest text-white" style={{ fontFamily: T.font }}>{title}</span>
        </div>
        <div className="p-3 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {items.map((s) => {
            const sel = isSel(market, s.label);
            return (
              <button
                key={s.label}
                onClick={() => !locked && pick(market, s.label, s.odd)}
                disabled={locked}
                className="flex flex-col items-center py-2.5 px-1 rounded-lg border transition-all"
                style={{
                  background: sel ? T.accentSoft : 'rgba(255,255,255,0.03)',
                  borderColor: sel ? T.accent : T.borderSoft,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.5 : 1,
                  fontFamily: T.font,
                }}
              >
                <span className="text-base font-black tabular-nums leading-none" style={{ color: sel ? T.accentLight : T.text }}>
                  {s.label}
                </span>
                <span className="text-xs font-bold tabular-nums mt-1" style={{ color: locked ? T.textFaint : sel ? T.accentLight : T.textMuted }}>
                  {locked ? <LockIcon sx={{ fontSize: 12 }} /> : s.odd.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {locked && <LockedBanner />}
      <Section title={`${homeTeam} Win`} tint={T.accent}            items={homeWins} />
      <Section title="Draw"              tint="rgba(255,255,255,0.14)" items={draws}    />
      <Section title={`${awayTeam} Win`} tint="#1d4ed8"             items={awayWins} />
      {other.length > 0 && <Section title="Other" tint="rgba(255,255,255,0.10)" items={other} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Handicap / Spread Panel
// ---------------------------------------------------------------------------
function HandicapPanel({ groups, matchId, matchName, locked, sport }: {
  groups: OddsGroup[]; matchId: string; matchName: string; locked: boolean; sport: SportKind;
}) {
  const { betSlip, addToBetSlip, showToast } = useAppStore();
  const isSel = (market: string, sel: string) =>
    betSlip.some((s) => s.matchId === matchId && s.market === market && s.selection === sel);
  const pick = (market: string, sel: string, odd: number) => {
    if (locked) return;
    addToBetSlip({ matchId, matchName, market, selection: sel, odd });
    showToast('Added to bet slip', 'success');
  };

  const panelLabel = sport === 'basketball' || sport === 'nfl' ? 'Point Spread' : 'Asian Handicap';

  if (!groups.length) return <EmptyNote>No {panelLabel.toLowerCase()} odds available.</EmptyNote>;

  return (
    <>
      {locked && <LockedBanner />}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: T.textMuted, fontFamily: T.font }}>
          {panelLabel}
        </span>
        <span className="text-xs" style={{ color: T.textFaint, fontFamily: T.font }}>{groups.length} line(s)</span>
      </div>
      {groups.map((group, gi) => {
        const isPushLine = group.options.some((o) => o.label.toLowerCase().includes('push') || o.label.toLowerCase().includes('refund'));
        const mainOpts   = group.options.filter((o) => !o.label.toLowerCase().includes('push') && !o.label.toLowerCase().includes('refund'));
        const pushOpt    = group.options.find((o) => o.label.toLowerCase().includes('push') || o.label.toLowerCase().includes('refund'));

        return (
          <MarketCard key={gi} title={group.market}>
            <div className={`p-3 grid gap-2 ${mainOpts.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {mainOpts.map((opt) => {
                const mtch     = opt.label.match(/^(.+?)\s*\(([^)]+)\)$/);
                const teamName = mtch ? mtch[1] : opt.label;
                const handicap = mtch ? mtch[2] : '';
                const selKey   = `${opt.label}|${gi}`;
                const sel      = isSel('asian_handicap', selKey);
                return (
                  <button
                    key={opt.label}
                    disabled={locked}
                    onClick={() => !locked && pick('asian_handicap', selKey, opt.odd)}
                    className="flex items-center justify-between px-3 py-3 rounded-lg border transition-all"
                    style={{
                      background: sel ? T.accentSoft : 'rgba(255,255,255,0.03)',
                      borderColor: sel ? T.accent : T.borderSoft,
                      cursor: locked ? 'not-allowed' : 'pointer',
                      opacity: locked ? 0.5 : 1,
                      fontFamily: T.font,
                    }}
                  >
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-sm font-bold truncate" style={{ color: sel ? T.accentLight : T.text }}>
                        {teamName}
                      </span>
                      {handicap && (
                        <span className="text-xs font-black tabular-nums" style={{ color: sel ? T.accentLight : T.textMuted }}>
                          {handicap}
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-black tabular-nums ml-2 shrink-0" style={{ color: locked ? T.textFaint : sel ? T.accentLight : T.text }}>
                      {locked ? <LockIcon sx={{ fontSize: 16 }} /> : opt.odd.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
            {pushOpt && !locked && (
              <div className="px-3 pb-3">
                <button
                  onClick={() => pick('asian_handicap', `${pushOpt.label}|${gi}`, pushOpt.odd)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all"
                  style={{
                    background: isSel('asian_handicap', `${pushOpt.label}|${gi}`) ? T.accentSoft : 'rgba(255,255,255,0.03)',
                    borderColor: T.borderSoft,
                    fontFamily: T.font,
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: T.textMuted }}>Push / Refund</span>
                  <span className="text-sm font-black tabular-nums" style={{ color: T.text }}>{pushOpt.odd.toFixed(2)}</span>
                </button>
              </div>
            )}
          </MarketCard>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bet slip summary — sticky right rail, echoes the reference screenshot
// ---------------------------------------------------------------------------
function BetSlipPanel({ matchId }: { matchId: string }) {
  const { betSlip } = useAppStore();
  const picks = betSlip.filter((s) => s.matchId === matchId);

  return (
    <div className="rounded-lg overflow-hidden sticky top-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: T.cardHead }}>
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: T.text, fontFamily: T.font }}>
          Bet Slip
        </span>
        <span
          className="flex items-center justify-center rounded-full text-[11px] font-black"
          style={{ width: 20, height: 20, background: T.accent, color: '#fff', fontFamily: T.font }}
        >
          {picks.length}
        </span>
      </div>
      <div className="p-4">
        {picks.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint, fontFamily: T.font }}>
            Tap any odds to add it to your slip.
          </p>
        ) : (
          <div className="space-y-3">
            {picks.map((p, i) => (
              <div key={i} className="flex items-start justify-between gap-2 pb-3" style={{ borderBottom: i < picks.length - 1 ? `1px solid ${T.borderSoft}` : undefined }}>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: T.text, fontFamily: T.font }}>{p.selection}</p>
                  <p className="text-[11px] truncate" style={{ color: T.textFaint, fontFamily: T.font }}>{p.market.replace(/_/g, ' ')}</p>
                </div>
                <span className="text-sm font-black tabular-nums shrink-0" style={{ color: T.accentLight, fontFamily: T.font }}>
                  {p.odd.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar — horizontal, scrollable, counts in parens (reference layout)
// ---------------------------------------------------------------------------
function TabBar({
  tabs, active, onChange,
}: {
  tabs: { key: string; label: string; count: number }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-6 overflow-x-auto mb-4 -mx-1 px-1"
      style={{ borderBottom: `1px solid ${T.border}`, scrollbarWidth: 'none' }}
    >
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="whitespace-nowrap pb-3 pt-1 text-xs font-extrabold uppercase tracking-widest transition-colors shrink-0"
            style={{
              color: isActive ? T.text : T.textMuted,
              borderBottom: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
              fontFamily: T.font,
            }}
          >
            {t.label} <span style={{ color: isActive ? T.accentLight : T.textFaint }}>({t.count})</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MatchDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [match, setMatch]               = useState<Match | null>(null);
  const [sport, setSport]               = useState<SportKind>('football');
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [matchError, setMatchError]     = useState<string | null>(null);

  const [odds1x2, setOdds1x2]                   = useState<OddsGroup[]>([]);
  const [oddsHalfTime, setOddsHalfTime]         = useState<OddsGroup[]>([]);
  const [oddsCorrectScore, setOddsCorrectScore] = useState<OddsGroup[]>([]);
  const [oddsHandicap, setOddsHandicap]         = useState<OddsGroup[]>([]);
  const [loadingOdds, setLoadingOdds]           = useState(false);
  const [activeTab, setActiveTab]               = useState<string>('all');

  const timerStr = useLiveTimer(match);

  const fetchMatch = useCallback(async () => {
    if (!id) return;
    setLoadingMatch(true);
    setMatchError(null);
    try {
      let m: Match;
      try { m = await fetchMatchById(id, 'football'); }
      catch { m = await fetchMatchById(id, 'admin'); }
      const detectedSport = detectSport(m);
      setSport(detectedSport);
      setMatch(m);
    } catch (err) {
      setMatchError((err as Error).message ?? 'Failed to load match');
    } finally {
      setLoadingMatch(false);
    }
  }, [id]);

  const fetchOdds = useCallback(async (sportKind: SportKind) => {
    if (!id) return;
    setLoadingOdds(true);
    try {
      const result = await fetchAllOddsForSport(id, sportKind);
      setOdds1x2(result.odds1x2);
      setOddsHalfTime(result.oddsHalfTime);
      setOddsCorrectScore(result.oddsCorrectScore);
      setOddsHandicap(result.oddsHandicap);
    } finally {
      setLoadingOdds(false);
    }
  }, [id]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);
  useEffect(() => {
    if (!loadingMatch && match) fetchOdds(sport);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, loadingMatch]);

  useEffect(() => {
    if (!match) return;
    const isLive = LIVE_STATUSES.has(match.status ?? '');
    if (!isLive) return;
    const interval = setInterval(() => { fetchMatch(); }, 30_000);
    return () => clearInterval(interval);
  }, [match, fetchMatch]);

  // ── Sport-specific section config ─────────────────────────────────────
  function getSectionsForSport(s: SportKind) {
    type Section = { key: string; label: string; count: number };
    const count = (groups: OddsGroup[]) => groups.reduce((sum, g) => sum + g.options.length, 0);

    const all: Section[] = [
      { key: '1x2',          label: s === 'basketball' || s === 'nfl' ? 'Moneyline' : 'Main',        count: count(odds1x2) },
      { key: 'halfTime',     label: s === 'basketball' ? 'Totals' : 'Half Time',                      count: count(oddsHalfTime) },
      { key: 'correctScore', label: 'Correct Score',                                                   count: count(oddsCorrectScore) },
      { key: 'handicap',     label: s === 'basketball' || s === 'nfl' ? 'Spread' : 'Handicap',        count: count(oddsHandicap) },
    ];

    let filtered: Section[];
    if (s === 'admin') {
      filtered = all.filter((sec) => {
        if (sec.key === '1x2')          return true;
        if (sec.key === 'halfTime')     return oddsHalfTime.length > 0;
        if (sec.key === 'correctScore') return oddsCorrectScore.length > 0;
        if (sec.key === 'handicap')     return oddsHandicap.length > 0;
        return false;
      });
    } else {
      const allowed: Partial<Record<SportKind, string[]>> = {
        football:   ['1x2', 'halfTime', 'correctScore', 'handicap'],
        basketball: ['1x2', 'halfTime', 'handicap'],
        nfl:        ['1x2', 'handicap'],
        baseball:   ['1x2'],
        mma:        ['1x2'],
        tennis:     ['1x2'],
      };
      const keys = allowed[s] ?? ['1x2'];
      filtered = all.filter((sec) => keys.includes(sec.key));
    }

    const total = filtered.reduce((sum, sec) => sum + sec.count, 0);
    return [{ key: 'all', label: 'All', count: total }, ...filtered];
  }

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loadingMatch) return (
    <div style={{ background: 'transparent' }}>
      <div className="mx-auto p-4 space-y-4" style={{ maxWidth: 1440, fontFamily: T.font }}>
        <SkeletonBlock className="h-4 w-20" />
        <div className="rounded-lg p-6 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <SkeletonBlock className="h-3 w-32" />
          <div className="flex justify-center gap-6">
            <SkeletonBlock className="h-8 w-24" />
            <SkeletonBlock className="h-8 w-20" />
            <SkeletonBlock className="h-8 w-24" />
          </div>
          <SkeletonBlock className="h-3 w-48 mx-auto" />
        </div>
        <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-20" />)}</div>
      </div>
    </div>
  );

  if (matchError || !match) return (
    <div className="p-8 text-center" style={{ fontFamily: T.font }}>
      <p className="text-sm mb-3" style={{ color: '#f87171' }}>{matchError ?? 'Match not found'}</p>
      <button onClick={() => navigate(-1)} className="text-sm hover:underline" style={{ color: T.accentLight }}>
        Go back
      </button>
    </div>
  );

  const isLive     = LIVE_STATUSES.has(match.status ?? '');
  const isFinished = FINISHED_STATUSES.has(match.status ?? '');
  const oddsLocked = isFinished;
  const matchName  = `${match.homeTeam} vs ${match.awayTeam}`;
  const sections   = getSectionsForSport(sport);
  const totalMarkets = sections.find((s) => s.key === 'all')?.count ?? 0;

  return (
    // Background intentionally left transparent so the surrounding app shell
    // (same #0a1628 as the header) shows through — no separate page bg here.
    <div style={{ fontFamily: T.font }}>
      <div className="mx-auto p-4" style={{ maxWidth: 1440 }}>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-xs font-semibold mb-4 transition-colors hover:opacity-80"
          style={{ color: T.textMuted }}
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} /> Back
        </button>

        {/* Match Header */}
        <div className="rounded-lg overflow-hidden mb-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>

          {/* Breadcrumb row */}
          <div className="flex items-center gap-2 flex-wrap px-5 pt-4 pb-2 text-xs font-bold uppercase tracking-widest" style={{ color: T.textMuted }}>
            {match.leagueLogo && (
              <img src={match.leagueLogo} alt={match.league ?? ''} className="w-4 h-4 object-contain"
                   onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span className="truncate max-w-[220px]">{match.league ?? '—'}</span>
            <span style={{ color: T.textFaint }}>•</span>

            {isLive && (
              <span className="flex items-center gap-1" style={{ color: '#34d399' }}>
                <FiberManualRecordIcon sx={{ fontSize: 8 }} className="live-dot" />
                {timerStr || 'LIVE'}
              </span>
            )}
            {isFinished && <span style={{ color: T.accentLight }}>{finishedLabel(match.status)}</span>}
            {!isLive && !isFinished && match.kickoffAt && (
              <span style={{ color: T.accentLight }}>{formatDate(match.kickoffAt)}, {formatKickoff(match.kickoffAt)}</span>
            )}

            <button
              onClick={() => { fetchMatch(); fetchOdds(sport); }}
              className="ml-auto shrink-0 transition-colors hover:opacity-80"
              style={{ color: T.textMuted }}
              title="Refresh"
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </button>
          </div>

          {/* Teams & score */}
          <div className="flex items-center justify-center gap-4 px-5 pb-4">
            <div className="text-center flex-1 min-w-0">
              {match.homeLogo && (
                <img src={match.homeLogo} alt={match.homeTeam} className="w-10 h-10 object-contain mx-auto mb-2"
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              )}
              <h2 className="text-sm md:text-lg font-extrabold leading-tight uppercase" style={{ color: T.text }}>
                {match.homeTeam}
              </h2>
            </div>

            <div className="text-center shrink-0 px-2">
              {(isLive || isFinished) ? (
                <div className="text-4xl md:text-5xl font-black tabular-nums" style={{ color: T.text }}>
                  {match.scoreHome ?? 0}
                  <span style={{ color: T.textFaint, margin: '0 6px' }}>–</span>
                  {match.scoreAway ?? 0}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[11px] uppercase tracking-widest" style={{ color: T.textFaint }}>VS</span>
                  <span className="text-lg font-bold" style={{ color: T.text }}>{formatKickoff(match.kickoffAt)}</span>
                </div>
              )}
              {isLive && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <FiberManualRecordIcon sx={{ fontSize: 8 }} style={{ color: '#34d399' }} className="live-dot" />
                  <span className="text-xs font-semibold" style={{ color: '#34d399' }}>{timerStr}</span>
                </div>
              )}
            </div>

            <div className="text-center flex-1 min-w-0">
              {match.awayLogo && (
                <img src={match.awayLogo} alt={match.awayTeam} className="w-10 h-10 object-contain mx-auto mb-2"
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              )}
              <h2 className="text-sm md:text-lg font-extrabold leading-tight uppercase" style={{ color: T.text }}>
                {match.awayTeam}
              </h2>
            </div>
          </div>

          {/* Meta strip */}
          <div
            className="flex flex-wrap items-center justify-center gap-4 text-xs px-5 py-2.5"
            style={{ color: T.textFaint, borderTop: `1px solid ${T.borderSoft}` }}
          >
            {match.kickoffAt && (
              <span className="flex items-center gap-1">
                <CalendarTodayIcon sx={{ fontSize: 12 }} />{formatDate(match.kickoffAt)}
              </span>
            )}
            {match.sport && (
              <span className="flex items-center gap-1">
                <SportsIcon sx={{ fontSize: 12 }} />{match.sport}
              </span>
            )}
            <span>{totalMarkets} markets</span>
            {oddsLocked && (
              <span className="flex items-center gap-1" style={{ color: '#fbbf24' }}>
                <LockIcon sx={{ fontSize: 12 }} /> Odds locked
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        {!loadingOdds && <TabBar tabs={sections} active={activeTab} onChange={setActiveTab} />}

        {/* Body: content + sticky bet slip rail */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">

          <div className="min-w-0">
            {loadingOdds ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: T.accent, borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <>
                {(activeTab === 'all' || activeTab === '1x2') && (
                  <Match1x2Panel
                    groups={odds1x2} matchId={match.id} matchName={matchName}
                    homeTeam={match.homeTeam} awayTeam={match.awayTeam}
                    locked={oddsLocked} sport={sport}
                  />
                )}
                {(activeTab === 'all' || activeTab === 'halfTime') && sections.some((s) => s.key === 'halfTime') && (
                  <HalfTimePanel
                    groups={oddsHalfTime} matchId={match.id} matchName={matchName}
                    locked={oddsLocked} sport={sport}
                  />
                )}
                {(activeTab === 'all' || activeTab === 'correctScore') && sections.some((s) => s.key === 'correctScore') && (
                  <CorrectScorePanel
                    groups={oddsCorrectScore} matchId={match.id} matchName={matchName}
                    homeTeam={match.homeTeam} awayTeam={match.awayTeam} locked={oddsLocked}
                  />
                )}
                {(activeTab === 'all' || activeTab === 'handicap') && sections.some((s) => s.key === 'handicap') && (
                  <HandicapPanel
                    groups={oddsHandicap} matchId={match.id} matchName={matchName}
                    locked={oddsLocked} sport={sport}
                  />
                )}
              </>
            )}
          </div>

          <BetSlipPanel matchId={match.id} />
        </div>

      </div>
    </div>
  );
}