export type SkybetMode = "live" | "upcoming";

export type SkybetEvent = {
  id: string;
  sport: string;
  competition: string;
  teams: [string, string];
  startsAt: string;
  status: string;
  isLive: boolean;
  previewCode?: string;
  score?: string;
  markets: Array<{ label: string; value: string }>;
};

export const MINIMUM_ODDS = 1.02;

export function normalizeOdds(value: string | number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < MINIMUM_ODDS) return MINIMUM_ODDS.toFixed(2);
  return numeric.toFixed(2);
}

export const SKYBET_SPORTS = [
  "All",
  "Football",
  "Basketball",
  "Tennis",
  "Virtuals",
] as const;

export const SKYBET_EVENTS: SkybetEvent[] = [
  {
    id: "live-skyline",
    previewCode: "SKY-LIVE-01",
    sport: "Football",
    competition: "Skyline Premier · Live",
    teams: ["Harbour City", "Northvale FC"],
    startsAt: "68’",
    status: "Second half",
    isLive: true,
    score: "1 – 1",
    markets: [
      { label: "Harbour City", value: "2.18" },
      { label: "Draw", value: "2.84" },
      { label: "Northvale FC", value: "3.42" },
      { label: "Over 2.5 goals", value: "1.96" },
      { label: "Under 2.5 goals", value: "1.82" },
      { label: "Both teams to score", value: "1.71" },
    ],
  },
  {
    id: "live-coastline",
    previewCode: "SKY-HOOPS-02",
    sport: "Basketball",
    competition: "Coastline League · Live",
    teams: ["Cedar Waves", "Metro Comets"],
    startsAt: "Q3 · 04:21",
    status: "In play",
    isLive: true,
    score: "54 – 51",
    markets: [
      { label: "Cedar Waves", value: "1.68" },
      { label: "Draw", value: "18.00" },
      { label: "Metro Comets", value: "2.08" },
      { label: "Over 164.5 points", value: "1.88" },
      { label: "Under 164.5 points", value: "1.88" },
      { label: "Cedar Waves -3.5", value: "1.91" },
    ],
  },
  {
    id: "upcoming-capital",
    previewCode: "SKY-CUP-03",
    sport: "Football",
    competition: "Capital Cup · Today",
    teams: ["Riverside Athletic", "Eastbridge United"],
    startsAt: "18:30",
    status: "Starting today",
    isLive: false,
    markets: [
      { label: "Riverside Athletic", value: "1.92" },
      { label: "Draw", value: "3.16" },
      { label: "Eastbridge United", value: "4.04" },
      { label: "Over 2.5 goals", value: "1.88" },
      { label: "Under 2.5 goals", value: "1.90" },
      { label: "Both teams to score", value: "1.79" },
    ],
  },
  {
    id: "upcoming-tennis",
    previewCode: "SKY-COURT-04",
    sport: "Tennis",
    competition: "Grand Court Series · Today",
    teams: ["A. Mensah", "L. Moretti"],
    startsAt: "20:10",
    status: "Best of three sets",
    isLive: false,
    markets: [
      { label: "A. Mensah", value: "1.74" },
      { label: "L. Moretti", value: "2.06" },
      { label: "Over 22.5 games", value: "1.84" },
      { label: "Under 22.5 games", value: "1.92" },
    ],
  },
  {
    id: "upcoming-virtual",
    previewCode: "SKY-SPRINT-05",
    sport: "Virtuals",
    competition: "Skyline Sprint · Next round",
    teams: ["Blue Lane", "Emerald Lane"],
    startsAt: "Next round",
    status: "Upcoming round",
    isLive: false,
    markets: [
      { label: "Blue Lane", value: "2.32" },
      { label: "Draw", value: "3.70" },
      { label: "Emerald Lane", value: "2.88" },
      { label: "Over 2.5 goals", value: "1.86" },
      { label: "Under 2.5 goals", value: "1.91" },
      { label: "Both score", value: "1.74" },
    ],
  },
];

export function filterSkybetEvents(
  events: SkybetEvent[],
  mode: SkybetMode,
  sport: string
): SkybetEvent[] {
  return events.filter(
    event =>
      (mode === "live" ? event.isLive : !event.isLive && event.status !== "Full time" && event.status !== "Completed" && event.status !== "Cancelled") &&
      (sport === "All" || event.sport === sport)
  );
}

export function formatSelection(event: SkybetEvent, marketLabel: string): string {
  return `${event.teams[0]} vs ${event.teams[1]} · ${marketLabel}`;
}

export function findSkybetEventByPreviewCode(events: SkybetEvent[], code: string): SkybetEvent | undefined {
  const normalizedCode = code.trim().toLowerCase();
  return events.find(event => event.previewCode?.toLowerCase() === normalizedCode || event.id.toLowerCase() === normalizedCode);
}
