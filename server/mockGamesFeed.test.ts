import { describe, expect, it } from "vitest";
import { getMockGamesFeed } from "../shared/mockGamesFeed";

describe("preview games feed", () => {
  it("returns a preview feed with a refresh policy", () => {
    const feed = getMockGamesFeed(new Date("2026-08-25T12:00:00.000Z"));

    expect(feed.source).toBe("preview");
    expect(feed.refreshAfterSeconds).toBe(30);
    expect(feed.refreshedAt).toBe("2026-08-25T12:00:00.000Z");
    expect(feed.events).toHaveLength(3);
  });

  it("contains both live and upcoming preview events", () => {
    const feed = getMockGamesFeed();

    expect(feed.events.some(event => event.isLive)).toBe(true);
    expect(feed.events.some(event => !event.isLive)).toBe(true);
  });
});
