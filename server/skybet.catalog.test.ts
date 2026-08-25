import { describe, expect, it } from "vitest";
import {
  filterSkybetEvents,
  formatSelection,
  SKYBET_EVENTS,
} from "../shared/skybet";

describe("Skybet catalogue helpers", () => {
  it("shows only live football events when that filter is active", () => {
    const events = filterSkybetEvents(SKYBET_EVENTS, "live", "Football");

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("live-skyline");
  });

  it("shows the upcoming catalogue when live mode is disabled", () => {
    const events = filterSkybetEvents(SKYBET_EVENTS, "upcoming", "All");

    expect(events).toHaveLength(3);
    expect(events.every(event => !event.isLive)).toBe(true);
  });

  it("formats a selected market into a readable slip label", () => {
    const event = SKYBET_EVENTS.find(item => item.id === "upcoming-capital");

    expect(event).toBeDefined();
    expect(formatSelection(event!, "Draw")).toContain("Riverside Athletic vs Eastbridge United");
  });
});
