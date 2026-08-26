import { describe, expect, it, vi } from "vitest";
import { createEspnPreviewClient } from "./espnPreview";

const scoreboardPayload = {
  leagues: [{ name: "English Premier League" }],
  events: [{
    id: "espn-1",
    date: "2026-08-27T18:00:00Z",
    competitions: [{
      competitors: [
        { homeAway: "home", score: "2", team: { displayName: "Northside FC" } },
        { homeAway: "away", score: "1", team: { displayName: "Riverside United" } },
      ],
      status: { type: { state: "in", shortDetail: "72'" } },
    }],
  }],
};

describe("ESPN preview scoreboard", () => {
  it("normalizes server-fetched scores without creating odds or exposing the ESPN host to the client", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(scoreboardPayload), { status: 200 }));
    const client = createEspnPreviewClient(fetcher as typeof fetch, () => new Date("2026-08-27T18:01:00Z"));

    const result = await client.scoreboard();

    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"), expect.any(Object));
    expect(result).toMatchObject({ source: "espn-unofficial-preview", attribution: "Data sourced from ESPN", stale: false, refreshAfterSeconds: 120 });
    expect(result.events[0]).toEqual(expect.objectContaining({ homeTeam: "Northside FC", awayTeam: "Riverside United", homeScore: "2", awayScore: "1", isLive: true }));
    expect(result.events[0]).not.toHaveProperty("odds");
    expect(result.events[0]).not.toHaveProperty("markets");
  });

  it("serves the last verified snapshot with a stale marker after a refresh failure", async () => {
    let current = new Date("2026-08-27T18:01:00Z");
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(scoreboardPayload), { status: 200 }))
      .mockRejectedValueOnce(new Error("network unavailable"));
    const client = createEspnPreviewClient(fetcher as typeof fetch, () => current);

    await client.scoreboard();
    current = new Date("2026-08-27T18:04:00Z");
    const stale = await client.scoreboard();

    expect(stale.stale).toBe(true);
    expect(stale.events).toHaveLength(1);
    expect(stale.message).toContain("last verified update");
  });

  it("rejects leagues that are not explicitly registered for the preview", async () => {
    const client = createEspnPreviewClient(vi.fn() as typeof fetch);
    await expect(client.scoreboard("unknown.league")).rejects.toThrow("Unsupported ESPN preview league");
  });
});
