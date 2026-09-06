import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import api from '../utils/api';
import type { Match } from '../utils/api';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SportsBasketballIcon from '@mui/icons-material/SportsBasketball';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import SportsMmaIcon from '@mui/icons-material/SportsMma';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import LockIcon from '@mui/icons-material/Lock';
import ScheduleIcon from '@mui/icons-material/Schedule';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SportTab = 'football' | 'basketball' | 'tennis' | 'baseball' | 'nfl' | 'mma';

interface OddsMap { home: number; draw: number; away: number; }
interface EnrichedMatch extends Match { oddsMap?: OddsMap; }
interface BetSlipEntry {
  matchId: string; matchName: string; market: string; selection: string; odd: number;
}

// ---------------------------------------------------------------------------
// Sport tab config
// ---------------------------------------------------------------------------
const SPORT_TABS: { key: SportTab; label: string; icon: React.ReactNode }[] = [
  { key: 'football',   label: 'Football',   icon: <SportsSoccerIcon sx={{ fontSize: 15 }} /> },
  { key: 'basketball', label: 'Basketball', icon: <SportsBasketballIcon sx={{ fontSize: 15 }} /> },
  { key: 'tennis',     label: 'Tennis',     icon: <SportsTennisIcon sx={{ fontSize: 15 }} /> },
  { key: 'baseball',   label: 'Baseball',   icon: <SportsBaseballIcon sx={{ fontSize: 15 }} /> },
  { key: 'nfl',        label: 'NFL',        icon: <SportsFootballIcon sx={{ fontSize: 15 }} /> },
  { key: 'mma',        label: 'MMA',        icon: <SportsMmaIcon sx={{ fontSize: 15 }} /> },
];

const TWO_WAY_ODDS_SPORTS = new Set<SportTab>(['baseball', 'basketball', 'nfl', 'mma']);

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
  'BREAK','break','SUSPENDED','suspended','INTERRUPTED','interrupted',
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
  'WALKOVER','walkover','RETIRED','retired','DELAYED','delayed',
  'COVERAGE_LOST','coverage_lost',
  'STATUS_FINAL','STATUS_FULL_TIME','STATUS_POSTPONED',
  'STATUS_CANCELED','STATUS_SUSPENDED','STATUS_ABANDONED',
  'STATUS_RAIN_DELAY',
]);

const HALFTIME_STATUSES   = new Set(['HALFTIME','halftime','HALF_TIME','half_time','HT','ht','STATUS_HALFTIME']);
const EXTRA_TIME_STATUSES = new Set(['EXTRA_TIME','extra_time','ET','et','ET1','et1','ET2','et2','STATUS_OVERTIME']);
const PENALTY_STATUSES    = new Set(['PENALTIES','penalties','PEN','pen','SHOOTOUT','shootout']);

// ---------------------------------------------------------------------------
// Helpers (copied from MatchList)
// ---------------------------------------------------------------------------
function inferLeagueFromTeams(homeTeam: string, awayTeam: string): string {
  const LEAGUE_TEAMS: Record<string, { leagueNames: string[]; teams: string[] }> = {
    premier_league: { leagueNames: ['Premier League'], teams: ['Arsenal','Aston Villa','Bournemouth','Brentford','Brighton','Chelsea','Crystal Palace','Everton','Fulham','Ipswich Town','Leicester City','Liverpool','Manchester City','Manchester United','Newcastle United','Nottingham Forest','Southampton','Tottenham Hotspur','West Ham United','Wolverhampton Wanderers'] },
    la_liga:        { leagueNames: ['La Liga'],         teams: ['Athletic Club','Atlético Madrid','Barcelona','Celta Vigo','Espanyol','Getafe','Girona','Las Palmas','Leganés','Mallorca','Osasuna','Rayo Vallecano','Real Betis','Real Madrid','Real Sociedad','Real Valladolid','Sevilla','Valencia','Villarreal','Alavés'] },
    bundesliga:     { leagueNames: ['Bundesliga'],      teams: ['Augsburg','Bayer Leverkusen','Bayern Munich','Borussia Dortmund','Borussia Mönchengladbach','Eintracht Frankfurt','Freiburg','Heidenheim','Hoffenheim','Holstein Kiel','Mainz 05','RB Leipzig','St. Pauli','Stuttgart','Union Berlin','Werder Bremen','Wolfsburg'] },
    serie_a:        { leagueNames: ['Serie A'],         teams: ['AC Milan','Atalanta','Bologna','Cagliari','Como','Empoli','Fiorentina','Genoa','Hellas Verona','Inter Milan','Juventus','Lazio','Lecce','Monza','Napoli','Parma','Roma','Torino','Udinese','Venezia'] },
    ligue_1:        { leagueNames: ['Ligue 1'],         teams: ['Angers','Auxerre','Brest','Le Havre','Lens','Lille','Lyon','Marseille','Monaco','Montpellier','Nantes','Nice','Paris Saint-Germain','Reims','Rennes','Saint-Étienne','Strasbourg','Toulouse'] },
  };
  const h = homeTeam.toLowerCase();
  const a = awayTeam.toLowerCase();
  for (const { leagueNames, teams } of Object.values(LEAGUE_TEAMS)) {
    const teamSet = new Set(teams.map((t) => t.toLowerCase()));
    if (teamSet.has(h) || teamSet.has(a)) return leagueNames[0];
  }
  return '';
}

function looksLikeFixtureName(s: string): boolean {
  return / at /i.test(s) || / vs\.? /i.test(s) || / @ /i.test(s);
}

function formatKickoff(kickoffAt?: string): string {
  if (!kickoffAt) return '--:--';
  return new Date(kickoffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ---------------------------------------------------------------------------
// normalizeMatch (copied from MatchList)
// ---------------------------------------------------------------------------
function normalizeMatch(raw: unknown): Match | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.matchId ?? r.match_id ?? r.fixtureId ?? r.fixture_id ?? '');
  if (!id || id === 'undefined') return null;

  let competitorHome: Record<string, unknown> | null = null;
  let competitorAway: Record<string, unknown> | null = null;
  const competitorsArr  = Array.isArray(r.competitors)  ? r.competitors  as Record<string, unknown>[] : null;
  const competitionsArr = Array.isArray(r.competitions) ? r.competitions as Record<string, unknown>[] : null;
  const firstComp = competitionsArr?.[0] as Record<string, unknown> | undefined;
  const nestedCompetitors = Array.isArray(firstComp?.competitors) ? firstComp!.competitors as Record<string, unknown>[] : null;

  const resolveCompetitors = (arr: Record<string, unknown>[]) => {
    for (const c of arr) {
      const side    = String(c.homeAway ?? c.type ?? '').toLowerCase();
      const teamObj = (c.team && typeof c.team === 'object') ? c.team as Record<string, unknown> : c;
      if (side === 'home') competitorHome = teamObj;
      else if (side === 'away') competitorAway = teamObj;
    }
    if (!competitorHome && !competitorAway && arr.length >= 2) {
      const t0 = arr[0]; const t1 = arr[1];
      competitorHome = (t0.team && typeof t0.team === 'object') ? t0.team as Record<string, unknown> : t0;
      competitorAway = (t1.team && typeof t1.team === 'object') ? t1.team as Record<string, unknown> : t1;
    }
  };

  if (competitorsArr) resolveCompetitors(competitorsArr);
  if (!competitorHome && !competitorAway && nestedCompetitors) resolveCompetitors(nestedCompetitors);

  const homeObj = competitorHome ?? ((r.home && typeof r.home === 'object') ? r.home as Record<string, unknown> : null);
  const awayObj = competitorAway ?? ((r.away && typeof r.away === 'object') ? r.away as Record<string, unknown> : null);

  let homeTeam = String(r.homeTeam ?? r.home_team ?? r.homeName ?? r.home_name ?? homeObj?.name ?? homeObj?.displayName ?? homeObj?.teamName ?? '').trim();
  let awayTeam = String(r.awayTeam ?? r.away_team ?? r.awayName ?? r.away_name ?? awayObj?.name ?? awayObj?.displayName ?? awayObj?.teamName ?? '').trim();

  if ((!homeTeam || !awayTeam) && typeof r.name === 'string') {
    const atMatch = r.name.match(/^(.+?)\s+at\s+(.+)$/i);
    const vsMatch = r.name.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
    if (atMatch)      { if (!awayTeam) awayTeam = atMatch[1].trim(); if (!homeTeam) homeTeam = atMatch[2].trim(); }
    else if (vsMatch) { if (!homeTeam) homeTeam = vsMatch[1].trim(); if (!awayTeam) awayTeam = vsMatch[2].trim(); }
  }

  if (!homeTeam && !awayTeam) return null;

  let leagueName = '';
  let leagueLogo = '';

  if (firstComp) {
    const compLeague = firstComp.league ?? firstComp.season;
    if (compLeague && typeof compLeague === 'object') {
      const lo = compLeague as Record<string, unknown>;
      leagueName = String(lo.name ?? lo.displayName ?? lo.slug ?? '');
    }
  }

  if (!leagueName) {
    const rawLeague = r.league ?? r.leagueName ?? r.competition ?? r.league_name ?? r.competitionName;
    if (rawLeague && typeof rawLeague === 'object') {
      const lo = rawLeague as Record<string, unknown>;
      leagueName = String(lo.name ?? lo.displayName ?? lo.shortName ?? lo.abbreviation ?? '');
      leagueLogo = String(lo.logo ?? lo.logoUrl ?? '');
      if (Array.isArray(lo.logos) && lo.logos.length > 0) {
        leagueLogo = String((lo.logos[0] as Record<string, unknown>).href ?? (lo.logos[0] as Record<string, unknown>).url ?? leagueLogo);
      }
    } else if (rawLeague) {
      const candidate = String(rawLeague);
      leagueName = looksLikeFixtureName(candidate) ? '' : candidate;
    }
  }

  if (!leagueName && firstComp) {
    const season = firstComp.season as Record<string, unknown> | undefined;
    if (season?.slug) leagueName = String(season.slug);
  }
  if (!leagueLogo) leagueLogo = String(r.leagueLogo ?? r.league_logo ?? r.competitionLogo ?? r.competition_logo ?? '');
  if (!leagueName && homeTeam && awayTeam) leagueName = inferLeagueFromTeams(homeTeam, awayTeam);

  let status = '';
  const rawStatus = (firstComp?.status) ?? r.status ?? r.matchStatus ?? r.match_status ?? r.state;
  if (rawStatus && typeof rawStatus === 'object') {
    const so = rawStatus as Record<string, unknown>;
    const typeObj = so.type as Record<string, unknown> | undefined;
    status = String(typeObj?.name ?? typeObj?.description ?? so.name ?? so.description ?? so.state ?? '');
  } else {
    status = String(rawStatus ?? '');
  }

  let scoreHome: number | undefined;
  let scoreAway: number | undefined;
  const rawScoreHome = r.scoreHome ?? r.score_home ?? r.homeScore ?? r.home_score;
  const rawScoreAway = r.scoreAway ?? r.score_away ?? r.awayScore ?? r.away_score;
  if (rawScoreHome != null) scoreHome = Number(rawScoreHome);
  else if (homeObj?.score != null) scoreHome = Number(homeObj.score);
  if (rawScoreAway != null) scoreAway = Number(rawScoreAway);
  else if (awayObj?.score != null) scoreAway = Number(awayObj.score);

  const scoreCompetitors = competitorsArr ?? nestedCompetitors ?? [];
  if (scoreHome == null || scoreAway == null) {
    for (const c of scoreCompetitors) {
      const side = String(c.homeAway ?? '').toLowerCase();
      const s = c.score != null ? Number(c.score) : undefined;
      if (side === 'home' && s != null && scoreHome == null) scoreHome = s;
      if (side === 'away' && s != null && scoreAway == null) scoreAway = s;
    }
  }

  const kickoffAt = String(r.kickoffAt ?? r.kickoff_at ?? r.startTime ?? r.start_time ?? r.date ?? r.scheduledAt ?? r.datetime ?? firstComp?.date ?? '');

  let minutePlayed: number | undefined;
  if (r.minutePlayed != null) minutePlayed = Number(r.minutePlayed);
  else if (r.minute_played != null) minutePlayed = Number(r.minute_played);
  else if (rawStatus && typeof rawStatus === 'object') {
    const so = rawStatus as Record<string, unknown>;
    const clock = so.displayClock ?? so.clock;
    if (clock) { const mins = parseInt(String(clock), 10); if (!isNaN(mins)) minutePlayed = mins; }
  }

  return {
    id, source: (r.source as Match['source']) ?? 'ESPN',
    homeTeam, awayTeam, league: leagueName, status, kickoffAt,
    scoreHome, scoreAway, homeLogo: '', awayLogo: '', leagueLogo, minutePlayed,
    sport: String(r.sport ?? 'FOOTBALL'),
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
  } as Match;
}

// ---------------------------------------------------------------------------
// Data utils (copied from MatchList)
// ---------------------------------------------------------------------------
function safeUnwrapList(raw: unknown): Match[] {
  if (!raw) return [];
  const normalize = (arr: unknown[]): Match[] => arr.map(normalizeMatch).filter((m): m is Match => m !== null);
  if (Array.isArray(raw)) return normalize(raw);
  const obj = raw as Record<string, unknown>;
  if (!obj.success) return [];
  const data = obj.data;
  if (!data) return [];
  if (Array.isArray(data)) return normalize(data);
  if (typeof data === 'object') {
    const all: unknown[] = [];
    for (const val of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(val)) all.push(...val);
    }
    return normalize(all);
  }
  return [];
}

function unwrapWithAllOdds(raw: unknown): Array<{ match: Match; odds: unknown[] }> {
  if (!raw) return [];
  const obj = raw as Record<string, unknown>;
  if (!obj.success) return [];
  if (!obj.data) return [];
  const items: Array<{ match: Match; odds: unknown[] }> = [];
  const processItem = (item: unknown) => {
    const i = item as Record<string, unknown>;
    const match = normalizeMatch(i.match ?? i);
    if (!match?.id) return;
    const odds: unknown[] = Array.isArray(i.match_result) ? i.match_result : Array.isArray(i.odds) ? i.odds : Array.isArray(i.markets) ? i.markets : [];
    items.push({ match, odds });
  };
  const data = obj.data;
  if (Array.isArray(data)) data.forEach(processItem);
  else if (data && typeof data === 'object') for (const val of Object.values(data as Record<string, unknown>)) if (Array.isArray(val)) val.forEach(processItem);
  return items;
}

function safeUnwrapOddsArray(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  if (!obj.success) return [];
  const data = obj.data;
  if (Array.isArray(data)) return data;
  return [];
}

function extractOddsMap(oddsArray: unknown[], homeTeam: string, awayTeam: string): OddsMap | undefined {
  if (!Array.isArray(oddsArray) || oddsArray.length === 0) return undefined;
  const pool = oddsArray as Array<Record<string, unknown>>;
  const parseOdd = (o: Record<string, unknown>): number =>
    parseFloat(String(o.odd ?? o.value ?? o.odds ?? o.price ?? o.decimal ?? o.americanOdds ?? '0'));
  const norm = (s: string) => s.toLowerCase().trim();
  const normHome = norm(homeTeam);
  const normAway = norm(awayTeam);
  const matchesTeam = (sel: string, teamNorm: string) => { const s = norm(sel); return s === teamNorm || s.includes(teamNorm) || teamNorm.includes(s); };
  let home = 0, draw = 0, away = 0;
  for (const o of pool) {
    const sel = norm(String(o.selection ?? o.outcome ?? o.name ?? o.label ?? o.type ?? ''));
    const val = parseOdd(o);
    if (val <= 1 || val > 200) continue;
    if (sel === 'home')                    { if (home === 0) home = val; }
    else if (sel === 'away')               { if (away === 0) away = val; }
    else if (sel === 'draw' || sel === 'x'){ if (draw === 0) draw = val; }
    else if (matchesTeam(sel, normHome))   { if (home === 0) home = val; }
    else if (matchesTeam(sel, normAway))   { if (away === 0) away = val; }
  }
  if (home === 0 && draw === 0 && away === 0) {
    const vals = pool.map(parseOdd).filter((v) => v > 1 && v < 50);
    if (vals.length >= 2) return vals.length >= 3 ? { home: vals[0], draw: vals[1], away: vals[2] } : { home: vals[0], draw: 0, away: vals[1] };
    return undefined;
  }
  return { home, draw, away };
}

function dedup(matches: Match[]): EnrichedMatch[] {
  const seen = new Set<string>();
  return matches.filter(({ id }) => { if (seen.has(id)) return false; seen.add(id); return true; }).map((m) => ({ ...m }));
}

function mergeOddsById(oddsById: Map<string, unknown[]>, entries: Array<{ match: Match; odds: unknown[] }>): void {
  for (const { match, odds } of entries) {
    if (odds.length === 0) continue;
    const existing = oddsById.get(match.id);
    if (!existing || odds.length > existing.length) oddsById.set(match.id, odds);
  }
}

// ---------------------------------------------------------------------------
// Fetch functions (copied from MatchList)
// ---------------------------------------------------------------------------
async function fetchAllFootballMatches(): Promise<EnrichedMatch[]> {
  const [withOddsRes, liveRes, upcomingRes, todayRes, resultsRes, livescoreLiveRes, livescoreTodayRes, allCupsUpcomingRes, allCupsTodayRes, allCupsLive] = await Promise.allSettled([
    api.publicFootball.withAllOdds(), api.publicFootball.live(), api.publicFootball.upcoming(), api.publicFootball.today(), api.publicFootball.results(50),
    api.publicFootballLivescore.live(), api.publicFootballLivescore.today(), api.publicFootball.allCupsUpcoming(), api.publicFootball.allCupsToday(), api.publicFootball.allCupsLive(),
  ]);
  const oddsById = new Map<string, unknown[]>();
  const withOddsItems     = withOddsRes.status  === 'fulfilled' ? unwrapWithAllOdds(withOddsRes.value)  : [];
  const fromUpcomingItems = upcomingRes.status   === 'fulfilled' ? unwrapWithAllOdds(upcomingRes.value) : [];
  const fromTodayItems    = todayRes.status      === 'fulfilled' ? unwrapWithAllOdds(todayRes.value)    : [];
  mergeOddsById(oddsById, withOddsItems); mergeOddsById(oddsById, fromUpcomingItems); mergeOddsById(oddsById, fromTodayItems);
  if (liveRes.status === 'fulfilled') mergeOddsById(oddsById, unwrapWithAllOdds(liveRes.value));
  const oddsByFingerprint = new Map<string, unknown[]>();
  const makeFingerprint = (home: string, away: string, kickoff: string) => `${home.toLowerCase().trim()}|${away.toLowerCase().trim()}|${kickoff.slice(0, 10)}`;
  for (const [matchId, odds] of oddsById.entries()) {
    const sourceMatch = [...withOddsItems, ...fromUpcomingItems, ...fromTodayItems].find(({ match }) => match.id === matchId)?.match;
    if (sourceMatch?.homeTeam && sourceMatch?.awayTeam && sourceMatch?.kickoffAt) {
      const fp = makeFingerprint(sourceMatch.homeTeam, sourceMatch.awayTeam, sourceMatch.kickoffAt);
      if (!oddsByFingerprint.has(fp)) oddsByFingerprint.set(fp, odds);
    }
  }
  const allMatchesArr: Match[] = [
    ...withOddsItems.map(({ match }) => match),
    ...(liveRes.status === 'fulfilled' ? safeUnwrapList(liveRes.value) : []),
    ...fromUpcomingItems.map(({ match }) => match),
    ...fromTodayItems.map(({ match }) => match),
    ...(resultsRes.status === 'fulfilled' ? safeUnwrapList(resultsRes.value) : []),
    ...(allCupsUpcomingRes.status === 'fulfilled' ? safeUnwrapList(allCupsUpcomingRes.value) : []),
    ...(allCupsTodayRes.status === 'fulfilled' ? safeUnwrapList(allCupsTodayRes.value) : []),
    ...(allCupsLive.status === 'fulfilled' ? safeUnwrapList(allCupsLive.value) : []),
    ...(livescoreLiveRes.status === 'fulfilled' ? safeUnwrapList(livescoreLiveRes.value) : []),
    ...(livescoreTodayRes.status === 'fulfilled' ? safeUnwrapList(livescoreTodayRes.value) : []),
  ];
  const seenIds = new Set<string>(); const seenFps = new Set<string>();
  const dedupedMatches = allMatchesArr.filter((m) => {
    if (!m?.id || seenIds.has(m.id)) return false; seenIds.add(m.id);
    const fp = `${(m.homeTeam ?? '').toLowerCase()}|${(m.awayTeam ?? '').toLowerCase()}|${(m.kickoffAt ?? '').slice(0, 16)}`;
    if (fp !== '||' && seenFps.has(fp)) return false; if (fp !== '||') seenFps.add(fp); return true;
  });
  const enrichedPass1 = dedupedMatches.map((match) => {
    let odds = oddsById.get(match.id) ?? [];
    if (odds.length === 0 && match.homeTeam && match.awayTeam && match.kickoffAt) {
      const fp = makeFingerprint(match.homeTeam, match.awayTeam, match.kickoffAt);
      const fpOdds = oddsByFingerprint.get(fp); if (fpOdds?.length) odds = fpOdds;
    }
    const oddsMap = extractOddsMap(odds, match.homeTeam ?? '', match.awayTeam ?? '');
    return { ...match, oddsMap, _needsOdds: !oddsMap && !FINISHED_STATUSES.has(match.status ?? '') };
  });
  const needsIndividualOdds = enrichedPass1.filter((m) => m._needsOdds).slice(0, 30);
  const individualOddsResults = await Promise.allSettled(needsIndividualOdds.map((m) => api.publicFootball.odds(m.id).then((r) => ({ matchId: m.id, data: r })).catch(() => ({ matchId: m.id, data: null }))));
  const individualOddsMap = new Map<string, unknown[]>();
  individualOddsResults.forEach((result) => { if (result.status === 'fulfilled' && result.value.data) { const arr = safeUnwrapOddsArray(result.value.data); if (arr.length > 0) individualOddsMap.set(result.value.matchId, arr); } });
  return enrichedPass1.map(({ _needsOdds, ...match }) => {
    if (!_needsOdds || match.oddsMap) return match as EnrichedMatch;
    const indOdds = individualOddsMap.get(match.id) ?? [];
    if (indOdds.length === 0) return match as EnrichedMatch;
    return { ...match, oddsMap: extractOddsMap(indOdds, match.homeTeam ?? '', match.awayTeam ?? '') } as EnrichedMatch;
  });
}

async function fetchBasketballMatches(): Promise<EnrichedMatch[]> {
  const [live, upcoming, results] = await Promise.allSettled([api.publicBasketball.live(), api.publicBasketball.upcoming(), api.publicBasketball.results()]);
  const allItems = [...(live.status === 'fulfilled' ? unwrapWithAllOdds(live.value) : []), ...(upcoming.status === 'fulfilled' ? unwrapWithAllOdds(upcoming.value) : []), ...(results.status === 'fulfilled' ? unwrapWithAllOdds(results.value) : [])];
  const seen = new Set<string>();
  return allItems.filter(({ match }) => { if (!match?.id || seen.has(match.id)) return false; seen.add(match.id); return true; }).map(({ match, odds }) => ({ ...match, oddsMap: extractOddsMap(odds, match.homeTeam ?? '', match.awayTeam ?? '') }));
}
async function fetchTennisMatches(): Promise<EnrichedMatch[]> {
  const [live, upcoming, results] = await Promise.allSettled([api.publicTennis.live(), api.publicTennis.upcoming(), api.publicTennis.results()]);
  return dedup([...(live.status === 'fulfilled' ? safeUnwrapList(live.value) : []), ...(upcoming.status === 'fulfilled' ? safeUnwrapList(upcoming.value) : []), ...(results.status === 'fulfilled' ? safeUnwrapList(results.value) : [])]);
}
async function fetchBaseballMatches(): Promise<EnrichedMatch[]> {
  const [live, upcoming, today] = await Promise.allSettled([api.publicBaseball.live(), api.publicBaseball.upcoming(), api.publicBaseball.today()]);
  const allItems = [...(live.status === 'fulfilled' ? unwrapWithAllOdds(live.value) : []), ...(upcoming.status === 'fulfilled' ? unwrapWithAllOdds(upcoming.value) : []), ...(today.status === 'fulfilled' ? unwrapWithAllOdds(today.value) : [])];
  const seen = new Set<string>();
  const deduped = allItems.filter(({ match }) => { if (!match?.id || seen.has(match.id)) return false; seen.add(match.id); return true; });
  const needsOdds = deduped.filter(({ odds }) => odds.length === 0).slice(0, 20);
  const oddsResponses = await Promise.allSettled(needsOdds.map(({ match }) => api.publicBaseball.odds(match.id).catch(() => null)));
  const oddsById = new Map<string, unknown[]>();
  needsOdds.forEach(({ match }, idx) => { const result = oddsResponses[idx]; if (result.status === 'fulfilled' && result.value != null) { const parsed = safeUnwrapOddsArray(result.value); if (parsed.length > 0) oddsById.set(match.id, parsed); } });
  return deduped.map(({ match, odds }) => ({ ...match, oddsMap: extractOddsMap(odds.length > 0 ? odds : (oddsById.get(match.id) ?? []), match.homeTeam ?? '', match.awayTeam ?? '') }));
}
async function fetchNflMatches(): Promise<EnrichedMatch[]> {
  const [live, upcoming, results] = await Promise.allSettled([api.publicNfl.live(), api.publicNfl.upcoming(), api.publicNfl.results()]);
  return dedup([...(live.status === 'fulfilled' ? safeUnwrapList(live.value) : []), ...(upcoming.status === 'fulfilled' ? safeUnwrapList(upcoming.value) : []), ...(results.status === 'fulfilled' ? safeUnwrapList(results.value) : [])]);
}
async function fetchMmaMatches(): Promise<EnrichedMatch[]> {
  const [live, upcoming, results] = await Promise.allSettled([api.publicMma.live(), api.publicMma.upcoming(), api.publicMma.results()]);
  return dedup([...(live.status === 'fulfilled' ? safeUnwrapList(live.value) : []), ...(upcoming.status === 'fulfilled' ? safeUnwrapList(upcoming.value) : []), ...(results.status === 'fulfilled' ? safeUnwrapList(results.value) : [])]);
}

async function fetchAllForSport(sport: SportTab): Promise<EnrichedMatch[]> {
  switch (sport) {
    case 'football':   return fetchAllFootballMatches();
    case 'basketball': return fetchBasketballMatches();
    case 'tennis':     return fetchTennisMatches();
    case 'baseball':   return fetchBaseballMatches();
    case 'nfl':        return fetchNflMatches();
    case 'mma':        return fetchMmaMatches();
    default:           return [];
  }
}

// ---------------------------------------------------------------------------
// useLiveTimer (copied from MatchList)
// ---------------------------------------------------------------------------
function useLiveTimer(match: EnrichedMatch): string {
  const status = match.status ?? '';
  const isLive = LIVE_STATUSES.has(status);
  const getElapsedMins = useCallback((): number => {
    if (match.kickoffAt) { const elapsed = Date.now() - new Date(match.kickoffAt).getTime(); if (elapsed >= 0) return Math.floor(elapsed / 60_000); }
    return match.minutePlayed ?? 0;
  }, [match.kickoffAt, match.minutePlayed]);
  const [elapsed, setElapsed] = useState<number>(getElapsedMins);
  useEffect(() => {
    if (!isLive) return;
    setElapsed(getElapsedMins());
    const id = setInterval(() => setElapsed(getElapsedMins()), 30_000);
    return () => clearInterval(id);
  }, [isLive, getElapsedMins]);
  if (!isLive) return '';
  if (HALFTIME_STATUSES.has(status)) return 'HT';
  if (PENALTY_STATUSES.has(status)) return 'PEN';
  if (EXTRA_TIME_STATUSES.has(status)) return `${Math.min(elapsed, 120)}' ET`;
  return `${match.minutePlayed != null ? match.minutePlayed : Math.min(elapsed, 90)}'`;
}

// ---------------------------------------------------------------------------
// League sort helpers (same as MatchList)
// ---------------------------------------------------------------------------
const TOP_6_LEAGUE_DISPLAY_NAMES = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1'];
const CUPS_LABELS = new Set<string>(['FA Cup','EFL Cup / Carabao Cup','Copa del Rey','DFB Pokal','Coppa Italia','Coupe de France','UEFA Champions League','UEFA Europa League','UEFA Conference League','UEFA Nations League','UEFA Euros','Copa Libertadores','Copa América','CONCACAF Champions Cup','AFC Champions League','CAF Champions League','Africa Cup of Nations','FIFA World Cup',"Women's World Cup",'FIFA Club World Cup']);

function leagueSortKey(league: string): string {
  if (!league) return '99_zzz_unknown';
  for (let i = 0; i < TOP_6_LEAGUE_DISPLAY_NAMES.length; i++) {
    if (league === TOP_6_LEAGUE_DISPLAY_NAMES[i]) return `00_${String(i).padStart(2, '0')}_${league}`;
  }
  if (CUPS_LABELS.has(league)) return `01_${league.toLowerCase()}`;
  return `02_${league.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// SkeletonRow — matches MatchList skeleton exactly
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <div className="lm-cmr" style={{ cursor: 'default', pointerEvents: 'none' }}>
      <div className="lm-cmr-left">
        <div className="lm-skeleton" style={{ width: 40, height: 13, borderRadius: 4 }} />
        <div className="lm-skeleton" style={{ width: 24, height: 10, borderRadius: 3, marginTop: 5 }} />
      </div>
      <div className="lm-cmr-teams">
        <div className="lm-skeleton" style={{ width: '72%', height: 13, borderRadius: 4, marginBottom: 5 }} />
        <div className="lm-skeleton" style={{ width: '58%', height: 13, borderRadius: 4 }} />
      </div>
      <div className="lm-cmr-odds">
        {[0, 1, 2].map((i) => (
          <div key={i} className="lm-cmr-btn empty lm-skeleton" style={{ width: 52 }} />
        ))}
      </div>
      <div style={{ width: 28 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveCompactMatchRow — mirrors CompactMatchRow from MatchList 1:1
// ---------------------------------------------------------------------------
function LiveCompactMatchRow({
  match, hasDraw = true, matchIndex, onClick,
}: {
  match: EnrichedMatch; hasDraw?: boolean; matchIndex: number; onClick?: () => void;
}) {
  const { betSlip, addToBetSlip, showToast } = useAppStore() as {
    betSlip: BetSlipEntry[];
    addToBetSlip: (e: BetSlipEntry) => void;
    showToast: (m: string, t: string) => void;
  };

  const timerStr = useLiveTimer(match);
  const odds = match.oddsMap;
  // All matches on this page are live — odds are always locked (same as MatchList live behaviour)
  const isSel = (sel: string) =>
    (betSlip as BetSlipEntry[]).some((s) => s.matchId === match.id && s.market === '1X2' && s.selection === sel);

  const oddsSlots = hasDraw
    ? [{ key: '1', val: odds?.home ?? 0 }, { key: 'X', val: odds?.draw ?? 0 }, { key: '2', val: odds?.away ?? 0 }]
    : [{ key: '1', val: odds?.home ?? 0 }, { key: '2', val: odds?.away ?? 0 }];

  void isSel; void addToBetSlip; void showToast; void oddsSlots;

  return (
    <div
      className="lm-cmr live no-pointer"
      onClick={onClick}
      role={onClick ? 'button' : 'presentation'}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick(); }}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Left: time + index */}
      <div className="lm-cmr-left">
        <span className="lm-cmr-live">
          <FiberManualRecordIcon sx={{ fontSize: 8 }} />
          {timerStr || 'LIVE'}
        </span>
        <span className="lm-cmr-id">#{matchIndex}</span>
      </div>

      {/* Center: teams + scores */}
      <div className="lm-cmr-teams">
        <div className="lm-cmr-team">
          <span className="lm-cmr-score">{match.scoreHome ?? 0}</span>
          <span className="lm-cmr-name">{match.homeTeam}</span>
        </div>
        <div className="lm-cmr-team">
          <span className="lm-cmr-score">{match.scoreAway ?? 0}</span>
          <span className="lm-cmr-name">{match.awayTeam}</span>
        </div>
        {match.kickoffAt && (
          <div className="lm-cmr-countdown">
            <ScheduleIcon sx={{ fontSize: 10, opacity: 0.4 }} />
            {formatKickoff(match.kickoffAt)}
          </div>
        )}
      </div>

      {/* Right: always locked */}
      <div className="lm-cmr-odds">
        <div className="lm-cmr-odds-locked">
          <LockIcon sx={{ fontSize: 13, color: 'rgba(59, 130, 246,0.6)' }} />
          <span className="lm-cmr-locked-label">Live · Locked</span>
        </div>
      </div>

      {/* Spacer to align with stats button column */}
      <div style={{ width: 28, flexShrink: 0 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LiveMatchesPage
// ---------------------------------------------------------------------------
export default function LiveMatchesPage() {
  const navigate = useNavigate();
  const [activeSport, setActiveSport] = useState<SportTab>('football');
  const [liveMatches, setLiveMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [teamFilter, setTeamFilter]   = useState('');
  const [sportCounts, setSportCounts] = useState<Partial<Record<SportTab, number>>>({});
  const sportGenRefs = useRef<Record<SportTab, number>>({ football: 0, basketball: 0, tennis: 0, baseball: 0, nfl: 0, mma: 0 });

  const fetchLive = useCallback(async (sport: SportTab, silent = false) => {
    const gen = ++sportGenRefs.current[sport];
    const alive = () => sportGenRefs.current[sport] === gen;

    if (!silent) { setLoading(true); setLiveMatches([]); setError(null); }
    else setRefreshing(true);

    try {
      const all  = await fetchAllForSport(sport);
      if (!alive()) return;
      const live = all.filter((m) => LIVE_STATUSES.has(m.status ?? ''));
      setLiveMatches(live);
      setLastUpdated(new Date());
      setSportCounts((prev) => ({ ...prev, [sport]: live.length }));
    } catch (err) {
      if (alive() && !silent) setError((err as Error).message ?? 'Failed to load live matches');
    } finally {
      if (alive()) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  const handleSportChange = (sport: SportTab) => {
    setActiveSport(sport);
    setTeamFilter('');
    (Object.keys(sportGenRefs.current) as SportTab[]).forEach((s) => { if (s !== sport) sportGenRefs.current[s]++; });
    fetchLive(sport, false);
  };

  useEffect(() => {
    fetchLive(activeSport, false);
    return () => { (Object.keys(sportGenRefs.current) as SportTab[]).forEach((s) => sportGenRefs.current[s]++); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') fetchLive(activeSport, true); };
    const interval = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [activeSport, fetchLive]);

  const filtered = useMemo(() => {
    if (!teamFilter.trim()) return liveMatches;
    const lower = teamFilter.toLowerCase();
    return liveMatches.filter((m) => (m.homeTeam ?? '').toLowerCase().includes(lower) || (m.awayTeam ?? '').toLowerCase().includes(lower));
  }, [liveMatches, teamFilter]);

  // Sort by league priority (same as MatchList renderSection)
  const sortedMatches = useMemo(() =>
    [...filtered].sort((a, b) => leagueSortKey(a.league || '').localeCompare(leagueSortKey(b.league || '')))
  , [filtered]);

  const showDraw = !TWO_WAY_ODDS_SPORTS.has(activeSport);

  const sportEmoji: Record<SportTab, string> = {
    football: '⚽', basketball: '🏀', tennis: '🎾', baseball: '⚾', nfl: '🏈', mma: '🥊',
  };

  return (
    <div className="lm-root px-4 mt-4">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="lm-page-header">
        <div className="lm-page-header-left">
          <LiveTvIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
          <span className="lm-page-title">Live Now</span>
          {!loading && filtered.length > 0 && (
            <span className="lm-live-pill">
              <FiberManualRecordIcon sx={{ fontSize: 7 }} />
              {filtered.length}
            </span>
          )}
        </div>
        <div className="lm-page-header-right">
          {lastUpdated && (
            <span className="lm-last-updated">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchLive(activeSport, true)}
            disabled={refreshing}
            className={`lm-refresh-btn${refreshing ? ' spinning' : ''}`}
            aria-label="Refresh"
          >
            <RefreshIcon sx={{ fontSize: 14 }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Sport tabs — rounded pill style matching Header's SportNav ── */}
      <div className="lm-sportnav-wrap">
        <div className="lm-sportnav no-scrollbar">
          {SPORT_TABS.map((tab) => {
            const count = sportCounts[tab.key];
            const isActive = activeSport === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleSportChange(tab.key)}
                className={`lm-sport-pill${isActive ? ' active' : ''}`}
              >
                {tab.icon}
                {tab.label}
                {count != null && count > 0 && (
                  <span className={`lm-sport-count${isActive ? ' active' : ''}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────── */}
      <div className="lm-search-wrap">
        <SearchIcon sx={{ fontSize: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)' }} />
        <input
          type="text"
          placeholder={`Search ${SPORT_TABS.find((t) => t.key === activeSport)?.label ?? ''} teams…`}
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="lm-search-input"
        />
      </div>

      {/* ── Loading skeletons ───────────────────────────────────────── */}
      {loading && (
        <div className="lm-cmsec">
          <div className="lm-cmsec-hdr">
            <div className="lm-skeleton" style={{ width: 90, height: 14, borderRadius: 4 }} />
          </div>
          <div className="lm-cmsec-col-hdr">
            <div style={{ flex: 1 }} />
            {['1', 'X', '2'].map((h) => <div key={h} className="lm-cmsec-col-lbl">{h}</div>)}
            <div style={{ width: 28 }} />
          </div>
          {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────── */}
      {!loading && error && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 13, color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>{error}</p>
          <button
            onClick={() => fetchLive(activeSport, false)}
            style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'system-ui, sans-serif' }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{sportEmoji[activeSport]}</div>
          <p style={{ fontSize: 13, color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>
            {teamFilter
              ? `No live ${SPORT_TABS.find((t) => t.key === activeSport)?.label} matches for "${teamFilter}"`
              : `No live ${SPORT_TABS.find((t) => t.key === activeSport)?.label} matches right now`}
          </p>
          <p style={{ fontSize: 11, color: '#374151', marginTop: 6, fontFamily: 'system-ui, sans-serif' }}>
            Refreshes every 30 seconds
          </p>
        </div>
      )}

      {/* ── Live matches section — matches MatchList's renderSection ── */}
      {!loading && !error && sortedMatches.length > 0 && (
        <div className="lm-cmsec live-section">
          <div className="lm-cmsec-hdr">
            <span className="lm-cmsec-title">
              <FiberManualRecordIcon sx={{ fontSize: 10, color: '#3b82f6' }} />
              Live Now
              <span className="lm-cmsec-cnt">({filtered.length})</span>
            </span>
            <span className="lm-odds-locked-notice">
              <LockIcon sx={{ fontSize: 11 }} /> Odds locked during live play
            </span>
          </div>
          <div className="lm-cmsec-col-hdr">
            <div style={{ flex: 1 }} />
            {showDraw
              ? ['1', 'X', '2'].map((h) => <div key={h} className="lm-cmsec-col-lbl">{h}</div>)
              : ['1', '2'].map((h) => <div key={h} className="lm-cmsec-col-lbl">{h}</div>)
            }
            <div style={{ width: 28 }} />
          </div>
          {sortedMatches.map((m, idx) => (
            <LiveCompactMatchRow
              key={m.id}
              match={m}
              hasDraw={showDraw}
              matchIndex={idx + 1}
              onClick={() => navigate(`/match/${m.id}`)}
            />
          ))}
        </div>
      )}

      {/* ── Styles — recolored to Header/MatchList blue theme, no page bg ── */}
      <style>{`
        .lm-root {
          --bg-card:        #0d1f3c;
          --border:         rgba(59, 130, 246,0.15);
          --border-acc:     rgba(59, 130, 246,0.3);
          --accent:         #3b82f6;
          --accent-cta:     #1d4ed8;
          --accent-dim:     rgba(59, 130, 246,0.12);
          --accent-border:  rgba(59, 130, 246,0.25);
          --text-main:      #f1f5f9;
          --text-muted:     #6b7280;
          --text-faint:     #374151;
        }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }

        /* ── Skeleton ──────────────────────────────────────────────── */
        .lm-skeleton {
          background: linear-gradient(90deg, #0d1f3c 25%, #0c4a6e 50%, #0d1f3c 75%);
          background-size: 200% 100%;
          animation: lmSkelShimmer 1.4s ease-in-out infinite;
        }
        @keyframes lmSkelShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* ── Page header ───────────────────────────────────────────── */
        .lm-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          gap: 8px;
        }
        .lm-page-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .lm-page-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }
        .lm-page-title {
          font-size: 15px;
          font-weight: 900;
          color: var(--text-main);
          font-family: system-ui, sans-serif;
          letter-spacing: 0.01em;
        }
        .lm-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 99px;
          background: rgba(59, 130, 246,0.12);
          border: 1px solid rgba(59, 130, 246,0.3);
          font-size: 11px;
          font-weight: 800;
          color: var(--accent);
          font-family: system-ui, sans-serif;
        }
        .lm-last-updated {
          font-size: 11px;
          color: var(--text-faint);
          font-family: system-ui, sans-serif;
        }
        .lm-refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 7px;
          border: 1.5px solid var(--border);
          background: var(--bg-card);
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          font-family: system-ui, sans-serif;
          transition: border-color 0.15s, color 0.15s;
        }
        .lm-refresh-btn:hover { border-color: var(--accent-border); color: var(--accent); }
        .lm-refresh-btn:disabled { opacity: 0.5; cursor: default; }
        .lm-refresh-btn.spinning svg { animation: lmSpin 0.8s linear infinite; }
        @keyframes lmSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        /* ── Sport tabs — rounded pills, same visual language as Header SportNav ── */
        .lm-sportnav-wrap {
          margin-bottom: 14px;
        }
        .lm-sportnav {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          padding: 2px 2px 6px;
        }
        .lm-sport-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          padding: 7px 15px;
          border-radius: 999px;
          border: 1.5px solid rgba(59, 130, 246,0.2);
          background: #0d1f3c;
          color: #9ca3af;
          font-size: 12.5px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
          font-family: system-ui, sans-serif;
          transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.08s;
          -webkit-tap-highlight-color: transparent;
        }
        .lm-sport-pill:hover { border-color: rgba(59, 130, 246,0.5); color: #e5e7eb; }
        .lm-sport-pill:active { transform: scale(0.97); }
        .lm-sport-pill.active { background: #1d4ed8; border-color: #1d4ed8; color: #fff; font-weight: 800; }
        .lm-sport-pill.active:hover { background: #1d4ed8; border-color: #1d4ed8; }
        .lm-sport-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: rgba(59, 130, 246,0.15);
          color: var(--accent);
          font-size: 10.5px;
          font-weight: 800;
          line-height: 1;
        }
        .lm-sport-count.active {
          background: rgba(255,255,255,0.2);
          color: #fff;
        }

        /* ── Search ─────────────────────────────────────────────────── */
        .lm-search-wrap {
          position: relative;
          margin-bottom: 16px;
        }
        .lm-search-input {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 12px 8px 32px;
          border-radius: 8px;
          border: 1.5px solid var(--border);
          background: var(--bg-card);
          color: var(--text-main);
          font-size: 13px;
          font-family: system-ui, sans-serif;
          outline: none;
          transition: border-color 0.15s;
        }
        .lm-search-input::placeholder { color: var(--text-muted); }
        .lm-search-input:focus { border-color: var(--accent-border); }

        /* ── Section container — identical structure to MatchList .cmsec ───── */
        .lm-cmsec {
          margin-bottom: 14px;
          border-radius: 12px;
          overflow: hidden;
          border: 1.5px solid var(--border);
          background: var(--bg-card);
          box-shadow: 0 2px 16px rgba(0,0,0,0.4);
        }
        .lm-cmsec.live-section {
          border-color: rgba(59, 130, 246,0.35);
          box-shadow: 0 2px 20px rgba(59, 130, 246,0.1);
        }
        .lm-cmsec-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 12px 9px;
          background: rgba(59, 130, 246,0.06);
          border-bottom: 1.5px solid rgba(59, 130, 246,0.12);
        }
        .lm-cmsec-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 800;
          color: var(--text-main);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-family: system-ui, sans-serif;
        }
        .lm-cmsec-cnt {
          font-size: 9px;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0;
        }
        .lm-odds-locked-notice {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: rgba(59, 130, 246,0.75);
          font-weight: 700;
          font-family: system-ui, sans-serif;
        }
        .lm-cmsec-col-hdr {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          background: rgba(255,255,255,0.015);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          gap: 3px;
        }
        .lm-cmsec-col-lbl {
          width: 52px;
          text-align: center;
          font-size: 9px;
          font-weight: 800;
          color: var(--accent);
          letter-spacing: 0.07em;
          flex-shrink: 0;
        }

        /* ── Match row — identical structure to MatchList .cmr ─────────────── */
        .lm-cmr {
          display: flex;
          align-items: center;
          padding: 9px 8px 9px 10px;
          gap: 6px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.12s ease;
          min-height: 58px;
          width: 100%;
          box-sizing: border-box;
        }
        .lm-cmr:last-child { border-bottom: none; }
        .lm-cmr.live {
          background: rgba(59, 130, 246,0.04);
          border-left: 3px solid var(--accent);
          padding-left: 7px;
        }
        .lm-cmr.no-pointer { cursor: default !important; }

        /* Left column */
        .lm-cmr-left {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          width: 48px;
          min-width: 48px;
          flex-shrink: 0;
        }
        .lm-cmr-live {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          font-weight: 900;
          color: var(--accent);
          font-family: system-ui, sans-serif;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .lm-cmr-id {
          font-size: 9px;
          color: rgba(59, 130, 246,0.4);
          font-family: system-ui, sans-serif;
          font-weight: 600;
        }

        /* Teams column */
        .lm-cmr-teams {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          overflow: hidden;
        }
        .lm-cmr-team {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          width: 100%;
        }
        .lm-cmr-score {
          font-size: 13px;
          font-weight: 900;
          color: var(--accent);
          min-width: 14px;
          flex-shrink: 0;
          font-family: system-ui, sans-serif;
        }
        .lm-cmr-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: system-ui, sans-serif;
          line-height: 1.3;
          flex: 1;
          min-width: 0;
        }
        .lm-cmr-countdown {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 8px;
          color: var(--text-faint);
          margin-top: 1px;
          font-family: system-ui, sans-serif;
          white-space: nowrap;
        }

        /* Odds column — always locked on this page */
        .lm-cmr-odds {
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }
        .lm-cmr-odds-locked {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          width: 162px;
          height: 44px;
          border-radius: 8px;
          border: 1.5px solid rgba(59, 130, 246,0.2);
          background: rgba(59, 130, 246,0.05);
          flex-shrink: 0;
        }
        .lm-cmr-locked-label {
          font-size: 8px;
          font-weight: 800;
          color: rgba(59, 130, 246,0.6);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-family: system-ui, sans-serif;
        }

        /* Odds btn (skeleton use only) */
        .lm-cmr-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 44px;
          border-radius: 7px;
          border: 1.5px solid rgba(59, 130, 246,0.2);
          background: rgba(59, 130, 246,0.07);
          flex-shrink: 0;
        }
        .lm-cmr-btn.empty {
          opacity: 0.22;
          border-color: rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
        }

        /* ── Responsive ─────────────────────────────────────────────── */
        @media (max-width: 380px) {
          .lm-cmr { padding: 8px 6px 8px 8px; gap: 4px; }
          .lm-cmr.live { padding-left: 5px; }
          .lm-cmr-left { width: 44px; min-width: 44px; }
          .lm-cmr-name { font-size: 11px; }
          .lm-cmr-odds-locked { width: 134px; }
          .lm-cmsec-col-lbl { width: 44px; font-size: 8px; }
        }
      `}</style>
    </div>
  );
}