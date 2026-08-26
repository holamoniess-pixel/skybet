import { describe, expect, it } from "vitest";
import { getSportsDataConnectionStatus } from "./sportsDataAdapter";

describe("sports data adapter contract", () => {
  it("reports an explicit unconfigured state without attempting a provider call", () => {
    expect(getSportsDataConnectionStatus()).toEqual({
      state: "unconfigured",
      provider: null,
      refreshStrategy: "provider-sse-or-server-polling",
      message: "Live sports data will appear after an approved provider is configured securely.",
    });
  });
});
