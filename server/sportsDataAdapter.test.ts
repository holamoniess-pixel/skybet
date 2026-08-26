import { describe, expect, it } from "vitest";
import { getSportsDataConnectionStatus } from "./sportsDataAdapter";

describe("sports data adapter contract", () => {
  it("reports the approved ESPN preview boundary without representing it as odds data", () => {
    expect(getSportsDataConnectionStatus()).toEqual({
      state: "preview-configured",
      provider: "ESPN unofficial site API",
      refreshStrategy: "server-cache-on-demand",
      message: "Best-effort scores and fixtures preview sourced from ESPN. Not official betting odds, not an ESPN partnership, and not used for wagers or settlement.",
    });
  });
});
