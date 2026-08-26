import { describe, expect, it, vi } from "vitest";
import { normalizeLicensedSportsSnapshot, SPORTS_NORMALIZATION_FALLBACKS } from "./modelFallback";

const snapshot = { source: "licensed-feed" as const, providerName: "Approved feed", fetchedAt: "2026-08-26T04:00:00.000Z", events: [{ id: "fixture-1", home: "A", away: "B", odds: { home: "1.75" } }] };
const validNormalization = { events: [{ sourceEventId: "fixture-1", homeTeam: "A", awayTeam: "B", competition: "League", startTime: "2026-08-27T16:00:00.000Z", markets: [] }] };

describe("sports normalization fallback boundary", () => {
  it("configures two NVIDIA models before two OpenRouter fallbacks", () => {
    expect(SPORTS_NORMALIZATION_FALLBACKS.map(plan => `${plan.provider}:${plan.model}`)).toEqual([
      "nvidia:meta/llama-3.1-8b-instruct",
      "nvidia:meta/llama-3.3-70b-instruct",
      "openrouter:nvidia/nemotron-3.5-lightning:free",
      "openrouter:liquid/lfm-2.5-2.6b:free",
    ]);
  });

  it("falls through providers after an unavailable response and rejected schema", async () => {
    const invalidModelOutput = { ...validNormalization, events: [{ ...validNormalization.events[0], odds: "1.75" }] };
    const transport = vi.fn()
      .mockResolvedValueOnce(new Response("failure", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(invalidModelOutput) } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validNormalization) } }] }), { status: 200 }));

    const result = await normalizeLicensedSportsSnapshot(snapshot, transport as typeof fetch);
    expect(result.provider).toBe("openrouter");
    expect(result.model).toBe("nvidia/nemotron-3.5-lightning:free");
    expect(result.canonicalEvents).toEqual(snapshot.events);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it("refuses browser-collected or malformed licensed data before model access", async () => {
    const transport = vi.fn();
    await expect(normalizeLicensedSportsSnapshot({ ...snapshot, source: "permissioned-browser" as never }, transport as typeof fetch)).rejects.toThrow("Only licensed provider snapshots");
    await expect(normalizeLicensedSportsSnapshot({ ...snapshot, events: [{ home: "A" }] }, transport as typeof fetch)).rejects.toThrow("stable string id");
    expect(transport).not.toHaveBeenCalled();
  });
});
