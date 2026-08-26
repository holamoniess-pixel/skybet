import { describe, expect, it } from "vitest";

const railwayToken = process.env.RAILWAY_TOKEN;

describe("external deployment secret health", () => {
  it("reaches the Railway deployment health endpoint with the project token", async () => {
    expect(railwayToken, "RAILWAY_TOKEN must be configured").toBeTruthy();
    const response = await fetch("https://skybet-production.up.railway.app/health", {
      headers: { Authorization: `Bearer ${railwayToken}` },
    });
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { ok?: boolean; service?: string };
    expect(payload).toEqual({ ok: true, service: "skybet-api" });
  }, 15_000);
});

// Never print response headers, request headers, or environment values from this test.
// The assertions intentionally expose only status and non-sensitive health payload data.
export {};
