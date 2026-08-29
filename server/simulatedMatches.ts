import { SIMULATION_CLUBS } from "../shared/simulationClubs";
import type { SkybetEvent } from "../shared/skybet";

const REFRESH_AFTER_SECONDS = 30;
const MATCH_DURATION_MS = 105 * 60 * 1000;
const SLOT_COUNT = 24;

export type SimulatedMatch = SkybetEvent & {
  simulation: true;
  scheduledAt: string;
  predictedOutcome: string;
  predictionConfidence: number;
};

export type SimulatedMatchFeed = {
  source: "skybet-generated";
  attribution: "SKYBET-generated market data";
  generatedAt: string;
  refreshAfterSeconds: number;
  clubCount: number;
  events: SimulatedMatch[];
  message: string;
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function randomBetween(seed: number, min: number, max: number) {
  const fraction = (seed % 10_000) / 10_000;
  return min + fraction * (max - min);
}

function formatLiveStatus(startedAt: Date, now: Date) {
  const elapsedMinutes = Math.max(1, Math.min(105, Math.floor((now.getTime() - startedAt.getTime()) / 60_000)));
  return elapsedMinutes >= 105 ? "Full time" : `${elapsedMinutes}’ · ${elapsedMinutes < 45 ? "First half" : elapsedMinutes === 45 ? "Half time" : "Second half"}`;
}

function makeMatch(index: number, dayStart: Date, now: Date): SimulatedMatch {
  const daySeed = dayStart.toISOString().slice(0, 10);
  const seed = hash(`${daySeed}:${index}`);
  const homeIndex = (seed + index * 17) % SIMULATION_CLUBS.length;
  const awayIndex = (seed + index * 43 + 97) % SIMULATION_CLUBS.length;
  const homeTeam = SIMULATION_CLUBS[homeIndex];
  const awayTeam = SIMULATION_CLUBS[awayIndex === homeIndex ? (awayIndex + 1) % SIMULATION_CLUBS.length : awayIndex];
  const slotMinutes = index < 3 ? -55 + index * 18 : 105 + (index - 3) * 68;
  const scheduledAt = new Date(dayStart.getTime() + slotMinutes * 60_000);
  const endAt = new Date(scheduledAt.getTime() + MATCH_DURATION_MS);
  const isLive = now >= scheduledAt && now < endAt;
  const isFinished = now >= endAt;
  const homeOdds = Number(randomBetween(seed ^ 0x1234, 1.55, 3.75).toFixed(2));
  const awayOdds = Number(randomBetween(seed ^ 0x5678, 1.65, 4.65).toFixed(2));
  const drawOdds = Number(randomBetween(seed ^ 0x9abc, 2.75, 4.2).toFixed(2));
  const prediction = homeOdds <= awayOdds ? homeTeam : awayTeam;
  const confidence = Number(randomBetween(seed ^ 0xdef0, 51, 72).toFixed(1));
  const scoreHome = isLive || isFinished ? String((seed + index) % 3) : null;
  const scoreAway = isLive || isFinished ? String((seed >>> 4) % 3) : null;
  const status = isLive ? formatLiveStatus(scheduledAt, now) : isFinished ? "Full time" : "Scheduled";

  return {
    id: `sim-${daySeed}-${index + 1}`,
    sport: "Football",
    competition: index % 3 === 0 ? "Simulation Premier" : index % 3 === 1 ? "Simulation Championship" : "Simulation Cup",
    teams: [homeTeam, awayTeam],
    startsAt: isLive || isFinished ? status : scheduledAt.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
    status,
    isLive,
    score: scoreHome !== null && scoreAway !== null ? `${scoreHome} – ${scoreAway}` : undefined,
    markets: [
      { label: homeTeam, value: homeOdds.toFixed(2) },
      { label: "Draw", value: drawOdds.toFixed(2) },
      { label: awayTeam, value: awayOdds.toFixed(2) },
      { label: "Over 2.5 goals", value: randomBetween(seed ^ 0x1111, 1.7, 2.25).toFixed(2) },
      { label: "Under 2.5 goals", value: randomBetween(seed ^ 0x2222, 1.65, 2.15).toFixed(2) },
      { label: "Both teams to score", value: randomBetween(seed ^ 0x3333, 1.55, 2.05).toFixed(2) },
    ],
    simulation: true,
    predictedOutcome: prediction,
    predictionConfidence: confidence,
  };
}

export function getSimulatedMatchFeed(now = new Date()): SimulatedMatchFeed {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const events = Array.from({ length: SLOT_COUNT }, (_, index) => makeMatch(index, dayStart, now));
  return {
    source: "skybet-generated",
    attribution: "SKYBET-generated market data",
    generatedAt: now.toISOString(),
    refreshAfterSeconds: REFRESH_AFTER_SECONDS,
    clubCount: SIMULATION_CLUBS.length,
    events,
    message: "SKYBET-generated markets: pairings, schedules, forecasts, scores, and odds are managed by the SKYBET market engine.",
  };
}

export type MatchFeed = Omit<SimulatedMatchFeed, "source" | "attribution" | "events" | "message"> & {
  source: "backend";
  attribution: "Backend match data";
  events: Array<Omit<SimulatedMatch, "simulation">>;
  message: string;
};

export function getMatchFeed(now = new Date()): MatchFeed {
  const feed = getSimulatedMatchFeed(now);
  return {
    source: "backend",
    attribution: "Backend match data",
    generatedAt: feed.generatedAt,
    refreshAfterSeconds: feed.refreshAfterSeconds,
    clubCount: feed.clubCount,
    events: feed.events.map(({ simulation: _simulation, ...event }) => ({ ...event, competition: event.competition.replace(/^Simulation /, "SKYBET ") })),
    message: "Match updates, fixtures, scores, forecasts, and odds are supplied by the backend.",
  };
}
