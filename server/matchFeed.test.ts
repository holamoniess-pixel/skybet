import { describe, expect, it } from "vitest";
import { getMatchFeed } from "./simulatedMatches";

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
});
