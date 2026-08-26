import { z } from "zod";

const ESPN_SITE_API = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const CACHE_TTL_MS = 120_000;
const MIN_REQUEST_GAP_MS = 1_000;
const CIRCUIT_BREAKER_FAILURES = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 300_000;

export const ESPN_PREVIEW_LEAGUES = ["eng.1"] as const;
export type EspnPreviewLeague = (typeof ESPN_PREVIEW_LEAGUES)[number];

export type EspnPreviewEvent = {
  id: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string | null;
  awayScore: string | null;
  status: string;
  isLive: boolean;
  startsAt: string;
};

export type EspnScoreboardPreview = {
  source: "espn-unofficial-preview";
  attribution: "Data sourced from ESPN";
  league: EspnPreviewLeague;
  fetchedAt: string;
  refreshAfterSeconds: number;
  stale: boolean;
  events: EspnPreviewEvent[];
  message: string;
};

const ScoreboardSchema = z.object({
  leagues: z.array(z.object({ name: z.string().optional() }).passthrough()).optional(),
  events: z.array(z.object({
    id: z.string(),
    date: z.string(),
    name: z.string().optional(),
    competitions: z.array(z.object({
      competitors: z.array(z.object({
        homeAway: z.enum(["home", "away"]),
        score: z.string().optional(),
        team: z.object({ displayName: z.string().optional(), shortDisplayName: z.string().optional() }).passthrough(),
      }).passthrough()),
      status: z.object({
        type: z.object({ state: z.string().optional(), shortDetail: z.string().optional(), detail: z.string().optional(), description: z.string().optional() }).passthrough(),
      }).passthrough(),
    }).passthrough()).min(1),
  }).passthrough()),
}).passthrough();

type Fetcher = typeof fetch;

type CacheState = {
  value: EspnScoreboardPreview | null;
  expiresAt: number;
  lastRequestAt: number;
  failures: number;
  circuitOpenUntil: number;
};

function emptyCache(): CacheState {
  return { value: null, expiresAt: 0, lastRequestAt: 0, failures: 0, circuitOpenUntil: 0 };
}

function ensureLeague(league: string): EspnPreviewLeague {
  if (!ESPN_PREVIEW_LEAGUES.includes(league as EspnPreviewLeague)) {
    throw new Error("Unsupported ESPN preview league.");
  }
  return league as EspnPreviewLeague;
}

function teamName(team: { displayName?: string; shortDisplayName?: string }) {
  const name = team.displayName ?? team.shortDisplayName;
  if (!name) throw new Error("ESPN event is missing a team name.");
  return name;
}

function normalizeScoreboard(payload: unknown, league: EspnPreviewLeague, fetchedAt: Date): EspnScoreboardPreview {
  const parsed = ScoreboardSchema.safeParse(payload);
  if (!parsed.success) throw new Error("ESPN scoreboard response shape is unavailable.");
  const competitionName = parsed.data.leagues?.[0]?.name ?? "English Premier League";
  const events = parsed.data.events.flatMap(event => {
    try {
      const competition = event.competitions[0];
      const home = competition.competitors.find(item => item.homeAway === "home");
      const away = competition.competitors.find(item => item.homeAway === "away");
      if (!home || !away) throw new Error("ESPN event is missing home or away team.");
      const state = competition.status.type.state ?? "pre";
      return [{
        id: event.id,
        competition: competitionName,
        homeTeam: teamName(home.team),
        awayTeam: teamName(away.team),
        homeScore: home.score ?? null,
        awayScore: away.score ?? null,
        status: competition.status.type.shortDetail ?? competition.status.type.detail ?? competition.status.type.description ?? (state === "pre" ? "Scheduled" : "Status unavailable"),
        isLive: state === "in",
        startsAt: event.date,
      }];
    } catch {
      return [];
    }
  });
  return {
    source: "espn-unofficial-preview",
    attribution: "Data sourced from ESPN",
    league,
    fetchedAt: fetchedAt.toISOString(),
    refreshAfterSeconds: CACHE_TTL_MS / 1000,
    stale: false,
    events,
    message: "Best-effort scores and fixtures preview. Not official betting odds and not an ESPN partnership.",
  };
}

export function createEspnPreviewClient(fetcher: Fetcher = fetch, now: () => Date = () => new Date()) {
  const cacheByLeague = new Map<EspnPreviewLeague, CacheState>();

  async function scoreboard(leagueInput: string = "eng.1"): Promise<EspnScoreboardPreview> {
    const league = ensureLeague(leagueInput);
    const clock = now().getTime();
    const cache = cacheByLeague.get(league) ?? emptyCache();
    cacheByLeague.set(league, cache);
    if (cache.value && cache.expiresAt > clock) return cache.value;
    if (cache.circuitOpenUntil > clock && cache.value) return { ...cache.value, stale: true, message: "Scoreboard source is temporarily unavailable. Showing the last verified update." };
    if (cache.lastRequestAt && clock - cache.lastRequestAt < MIN_REQUEST_GAP_MS && cache.value) return cache.value;

    cache.lastRequestAt = clock;
    try {
      const response = await fetcher(`${ESPN_SITE_API}/${league}/scoreboard`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`ESPN scoreboard request failed with HTTP ${response.status}.`);
      const value = normalizeScoreboard(await response.json(), league, now());
      cache.value = value;
      cache.expiresAt = now().getTime() + CACHE_TTL_MS;
      cache.failures = 0;
      cache.circuitOpenUntil = 0;
      return value;
    } catch (error) {
      cache.failures += 1;
      if (cache.failures >= CIRCUIT_BREAKER_FAILURES) cache.circuitOpenUntil = now().getTime() + CIRCUIT_BREAKER_COOLDOWN_MS;
      if (cache.value) return { ...cache.value, stale: true, message: "Scoreboard refresh failed. Showing the last verified update." };
      throw error;
    }
  }

  return { scoreboard };
}

export const espnPreviewClient = createEspnPreviewClient();
