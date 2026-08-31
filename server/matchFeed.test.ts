import { describe, expect, it } from "vitest";
import { getAdminMatchFeed, getMatchFeed } from "./simulatedMatches";

describe("backend match feed", () => {
  it("returns customer-safe match data without internal simulation metadata", () => {
    const feed = getMatchFeed(new Date("2026-08-29T12:00:00.000Z"));

    expect(feed.source).toBe("backend");
    expect(feed.attribution).toBe("Backend match data");
    expect(feed.message).not.toMatch(/simulation|generated|market engine/i);
    expect(feed.events.length).toBeGreaterThan(0);
    expect(feed.events[0]).not.toHaveProperty("simulation");
    expect(feed.events[0].competition).not.toMatch(/simulation/i);
  });

  it("never exposes scores or completed results in the public customer feed", () => {
    const feed = getMatchFeed(new Date("2026-08-29T12:00:00.000Z"));

    expect(feed.events.length).toBeGreaterThan(0);
    for (const event of feed.events) {
      expect(event).not.toHaveProperty("score");
      expect(event.status).not.toBe("Full time");
      expect(event).not.toHaveProperty("predictedOutcome");
      expect(event).not.toHaveProperty("predictionConfidence");
      for (const market of event.markets) {
        expect(Number(market.value)).toBeGreaterThanOrEqual(1.02);
        expect(Number(market.value)).toBeLessThanOrEqual(4);
      }
    }
  });

  it("keeps full result metadata available only on the admin feed", () => {
    const feed = getAdminMatchFeed(new Date("2026-08-29T12:00:00.000Z"));
    expect(feed.source).toBe("admin");
    expect(feed.events.some(event => event.status === "Full time")).toBe(true);
    expect(feed.events.every(event => event.predictedOutcome.length > 0)).toBe(true);
  });
});
