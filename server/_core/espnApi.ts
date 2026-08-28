/**
 * ESPN API Service - Completely FREE
 * No authentication required · No rate limits published
 * Data source: Reverse-engineered from espn.com
 * 
 * Base URLs:
 * - site.api.espn.com (v2/v3) - Main scoreboard, teams, standings
 * - sports.core.api.espn.com (v2/v3) - Athletes, stats, odds, detailed data
 * - cdn.espn.com - Real-time game data
 * - fantasy.espn.com (v3) - Fantasy leagues
 * - now.core.api.espn.com (v1) - Real-time news
 */

export interface ESPNEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
    };
    shortDetail?: string;
  };
  competitions: ESPNCompetition[];
}

export interface ESPNCompetition {
  id: string;
  competitors: ESPNCompetitor[];
  odds?: ESPNOdds[];
  playByPlay?: ESPNPlay[];
}

export interface ESPNCompetitor {
  homeAway: "home" | "away";
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    logos?: Array<{ href: string }>;
  };
  score?: string;
  winner?: boolean;
  statistics?: ESPNStat[];
}

export interface ESPNOdds {
  provider: {
    id: string;
    name: string;
  };
  spread?: number;
  overUnder?: number;
  awayTeamOdds?: { moneyLine: number };
  homeTeamOdds?: { moneyLine: number };
}

export interface ESPNStat {
  name: string;
  abbreviation?: string;
  displayValue: string;
  value?: number;
}

export interface ESPNPlay {
  id: string;
  description: string;
  timestamp?: string;
  type?: { text: string };
}

export interface ESPNTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  location?: string;
  logos?: Array<{ href: string }>;
}

export interface ESPNAthlete {
  id: string;
  displayName: string;
  position?: { abbreviation: string };
  team?: { $ref?: string };
  headshot?: { href: string };
  statistics?: ESPNStat[];
}

export interface ESPNStandingsEntry {
  team: { displayName: string; abbreviation: string };
  stats: ESPNStat[];
}

// ==================== CACHE CONFIGURATION ====================
const CACHE_TTL = {
  SCOREBOARD: 30 * 1000,
  STANDINGS: 5 * 60 * 1000,
  TEAMS: 24 * 60 * 60 * 1000,
  ATHLETES: 24 * 60 * 60 * 1000,
  ODDS: 60 * 1000,
  NEWS: 10 * 60 * 1000,
};

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCacheKey(...parts: string[]): string {
  return `espn:${parts.join(":")}`;
}

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttl: number): T {
  cache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
  return data;
}

// ==================== HELPER FUNCTIONS ====================

async function fetchEspn<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    throw error;
  }
}

// ==================== SCOREBOARD ENDPOINTS ====================

export async function getScoreboard(
  sport: string,
  league: string,
  options?: { dates?: string; week?: number; limit?: number }
): Promise<ESPNEvent[]> {
  const cacheKey = getCacheKey("scoreboard", sport, league, JSON.stringify(options || {}));
  const cached = getFromCache<ESPNEvent[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams();
  if (options?.dates) params.append("dates", options.dates);
  if (options?.week) params.append("week", options.week.toString());
  if (options?.limit) params.append("limit", options.limit.toString());

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard${
    params.size > 0 ? `?${params}` : ""
  }`;

  const data = await fetchEspn<{ events: ESPNEvent[] }>(url);
  return setCache(cacheKey, data.events, CACHE_TTL.SCOREBOARD);
}

export async function getNflScoreboard() {
  return getScoreboard("football", "nfl");
}

export async function getNbaScoreboard() {
  return getScoreboard("basketball", "nba");
}

export async function getMlbScoreboard() {
  return getScoreboard("baseball", "mlb");
}

export async function getNhlScoreboard() {
  return getScoreboard("hockey", "nhl");
}

export async function getSoccerScoreboard(league: string = "eng.1") {
  const cacheKey = getCacheKey("scoreboard", "soccer", league);
  const cached = getFromCache<ESPNEvent[]>(cacheKey);
  if (cached) return cached;

  const url = `https://cdn.espn.com/core/soccer/scoreboard?xhr=1&league=${league}`;
  const data = await fetchEspn<{ gamepackageJSON: string }>(url);

  let events: ESPNEvent[] = [];
  try {
    const parsed = JSON.parse(data.gamepackageJSON);
    events = parsed.events || [];
  } catch (e) {
    console.error("Failed to parse soccer scoreboard", e);
  }

  return setCache(cacheKey, events, CACHE_TTL.SCOREBOARD);
}

// ==================== TEAM ENDPOINTS ====================

export async function getTeams(sport: string, league: string): Promise<ESPNTeam[]> {
  const cacheKey = getCacheKey("teams", sport, league);
  const cached = getFromCache<ESPNTeam[]>(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams`;
  const data = await fetchEspn<{ sports: Array<{ leagues: Array<{ teams: Array<{ team: ESPNTeam }> }> }> }>(url);

  const teams = data.sports?.[0]?.leagues?.[0]?.teams?.map((t) => t.team) || [];
  return setCache(cacheKey, teams, CACHE_TTL.TEAMS);
}

export async function getTeamDetail(sport: string, league: string, teamId: string) {
  const cacheKey = getCacheKey("team", sport, league, teamId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.TEAMS);
}

export async function getTeamRoster(sport: string, league: string, teamId: string): Promise<ESPNAthlete[]> {
  const cacheKey = getCacheKey("roster", sport, league, teamId);
  const cached = getFromCache<ESPNAthlete[]>(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/roster`;
  const data = await fetchEspn<{ athletes: ESPNAthlete[] }>(url);
  return setCache(cacheKey, data.athletes || [], CACHE_TTL.TEAMS);
}

export async function getTeamSchedule(sport: string, league: string, teamId: string) {
  const cacheKey = getCacheKey("schedule", sport, league, teamId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.TEAMS);
}

export async function getTeamInjuries(sport: string, league: string, teamId: string) {
  const cacheKey = getCacheKey("injuries", sport, league, teamId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/injuries`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.TEAMS);
}

// ==================== STANDINGS ENDPOINTS ====================

export async function getStandings(sport: string, league: string) {
  const cacheKey = getCacheKey("standings", sport, league);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/v2/sports/${sport}/${league}/standings`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.STANDINGS);
}

// ==================== ATHLETE ENDPOINTS ====================

export async function getAthlete(sport: string, league: string, athleteId: string): Promise<ESPNAthlete> {
  const cacheKey = getCacheKey("athlete", sport, league, athleteId);
  const cached = getFromCache<ESPNAthlete>(cacheKey);
  if (cached) return cached;

  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/athletes/${athleteId}`;
  const data = await fetchEspn<ESPNAthlete>(url);
  return setCache(cacheKey, data, CACHE_TTL.ATHLETES);
}

export async function getAthleteGameLog(sport: string, league: string, athleteId: string) {
  const cacheKey = getCacheKey("gamelog", sport, league, athleteId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/athletes/${athleteId}/gamelog`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.ATHLETES);
}

export async function getAthleteStats(sport: string, league: string, athleteId: string) {
  const cacheKey = getCacheKey("stats", sport, league, athleteId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/athletes/${athleteId}`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.ATHLETES);
}

export async function getAthleteNews(sport: string, league: string, athleteId: string) {
  const cacheKey = getCacheKey("news", sport, league, athleteId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/athletes/${athleteId}/news`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.NEWS);
}

// ==================== ODDS & BETTING ====================

export async function getGameOdds(sport: string, league: string, eventId: string, competitionId: string) {
  const cacheKey = getCacheKey("odds", sport, league, eventId, competitionId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/events/${eventId}/competitions/${competitionId}/odds`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.ODDS);
}

export async function getGamePredictor(sport: string, league: string, eventId: string, competitionId: string) {
  const cacheKey = getCacheKey("predictor", sport, league, eventId, competitionId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/events/${eventId}/competitions/${competitionId}/predictor`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.ODDS);
}

// ==================== DETAILED GAME SUMMARY ====================

export async function getGameSummary(sport: string, league: string, eventId: string) {
  const cacheKey = getCacheKey("summary", sport, league, eventId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.SCOREBOARD);
}

export async function getPlayByPlay(sport: string, league: string, eventId: string, competitionId: string) {
  const cacheKey = getCacheKey("playbyplay", sport, league, eventId, competitionId);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/events/${eventId}/competitions/${competitionId}/plays`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.SCOREBOARD);
}

// ==================== SPECIALIZED DATA ====================

export async function getSportNews(sport?: string, limit: number = 25) {
  const cacheKey = getCacheKey("news-feed", sport || "all");
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  let url = `https://now.core.api.espn.com/v1/sports/news?limit=${limit}`;
  if (sport) url += `&sport=${sport}`;

  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.NEWS);
}

export async function getQbr(year: number, type: number = 2, group: number = 1, split: number = 0) {
  const cacheKey = getCacheKey("qbr", year.toString());
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/types/${type}/groups/${group}/qbr/${split}`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.STANDINGS);
}

export async function getPowerIndex(sport: string, league: string, year: number) {
  const cacheKey = getCacheKey("powerindex", sport, league, year.toString());
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/seasons/${year}/powerindex`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.STANDINGS);
}

export async function getLeaders(sport: string, league: string) {
  const cacheKey = getCacheKey("leaders", sport, league);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/leaders`;
  const data = await fetchEspn(url);
  return setCache(cacheKey, data, CACHE_TTL.STANDINGS);
}

// ==================== SEARCH ====================

export async function searchEspn(query: string, sport?: string, limit: number = 10) {
  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
  });
  if (sport) params.append("sport", sport);

  const url = `https://site.web.api.espn.com/apis/search/v2?${params}`;
  return await fetchEspn(url);
}

// ==================== IMAGES & CDN ====================

export function getAthleteHeadshotUrl(sport: string, playerId: string): string {
  return `https://a.espncdn.com/i/headshots/${sport}/players/full/${playerId}.png`;
}

export function getTeamLogoUrl(sport: string, teamAbbr: string, size: number = 500): string {
  return `https://a.espncdn.com/i/teamlogos/${sport}/${size}/${teamAbbr.toLowerCase()}.png`;
}

// ==================== CLEANUP ====================

export function clearExpiredCache(): void {
  const now = Date.now();
  cache.forEach((entry, key) => {
    if (now > (entry as CacheEntry<unknown>).expires) {
      cache.delete(key);
    }
  });
}

export function clearAllCache(): void {
  cache.clear();
}
