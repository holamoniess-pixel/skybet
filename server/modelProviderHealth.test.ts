import { describe, expect, it } from "vitest";
import { checkConfiguredModelProviders } from "./modelProviderHealth";

describe("configured model providers", () => {
  it("accepts the configured NVIDIA and OpenRouter credentials on their lightweight model-list endpoints", async () => {
    const results = await checkConfiguredModelProviders();
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.ok, `${result.provider} responded with ${result.status}`).toBe(true);
      expect(result.modelCount).toBeGreaterThan(0);
    }
  }, 20_000);
});
