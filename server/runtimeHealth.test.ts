import { describe, expect, it } from "vitest";
import { createRuntimeHealthPayload, isLegacyOAuthConfigured } from "./runtimeHealth";

describe("runtime health boundary", () => {
  it("returns a non-sensitive payload for deployment probes", () => {
    expect(createRuntimeHealthPayload()).toEqual({ ok: true, service: "skybet-api" });
  });

  it("enables legacy OAuth only with a non-blank configured URL", () => {
    expect(isLegacyOAuthConfigured("")).toBe(false);
    expect(isLegacyOAuthConfigured("   ")).toBe(false);
    expect(isLegacyOAuthConfigured("https://auth.example.test")).toBe(true);
  });
});
