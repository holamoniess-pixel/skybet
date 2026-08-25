import type { SkybetEvent } from "./skybet";

export type MockGamesFeed = {
  source: "simulated";
  refreshedAt: string;
  refreshAfterSeconds: number;
  events: SkybetEvent[];
};

/**
 * Simulates a provider-normalized match response for preview purposes only.
 * It is deterministic except for the response timestamp and never represents
 * licensed data, an odds service, or a production provider connection.
 */
export function getMockGamesFeed(now = new Date()): MockGamesFeed {
  return {
    source: "simulated",
    refreshedAt: now.toISOString(),
    refreshAfterSeconds: 30,
    events: [
      {
        id: "mock-live-aurora",
        sport: "Football",
        competition: "Northern Floodlights · Simulated",
        teams: ["Aurora United", "Summit Rovers"],
        startsAt: "72’",
        status: "Second half · simulated feed",
        isLive: true,
        score: "2 – 1",
        markets: [
          { label: "Aurora United", value: "1.86" },
          { label: "Draw", value: "3.22" },
          { label: "Summit Rovers", value: "4.44" },
        ],
      },
      {
        id: "mock-upcoming-orbit",
        sport: "Football",
        competition: "Continental Night Series · Simulated",
        teams: ["Orbit FC", "Valley Athletic"],
        startsAt: "20:00",
        status: "Starts today · simulated feed",
        isLive: false,
        markets: [
          { label: "Orbit FC", value: "2.04" },
          { label: "Draw", value: "3.10" },
          { label: "Valley Athletic", value: "3.76" },
        ],
      },
      {
        id: "mock-upcoming-court",
        sport: "Tennis",
        competition: "Harbour Court · Simulated",
        teams: ["N. Dlamini", "K. Renaud"],
        startsAt: "21:15",
        status: "Best of three · simulated feed",
        isLive: false,
        markets: [
          { label: "N. Dlamini", value: "1.63" },
          { label: "K. Renaud", value: "2.18" },
        ],
      },
    ],
  };
}
