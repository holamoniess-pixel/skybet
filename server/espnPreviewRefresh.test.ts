import { describe, expect, it, vi } from "vitest";
import { createEspnPreviewRefreshHandler } from "./espnPreviewRefresh";

function responseRecorder() {
  const result = { statusCode: 0, body: null as unknown };
  const response = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  };
  return { result, response };
}

function requestWith(authorization?: string) {
  return { get: vi.fn((name: string) => name === "authorization" ? authorization : undefined) };
}

describe("ESPN scheduled preview refresh", () => {
  it("stays disabled until the Railway cron secret is configured", async () => {
    const refresh = vi.fn();
    const handler = createEspnPreviewRefreshHandler({ getCronSecret: () => undefined, refresh });
    const { result, response } = responseRecorder();

    await handler(requestWith() as never, response as never, vi.fn());

    expect(result).toEqual({ statusCode: 503, body: { ok: false, error: "scheduled-refresh-disabled" } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects callers that do not present the server-only cron token", async () => {
    const refresh = vi.fn();
    const handler = createEspnPreviewRefreshHandler({ getCronSecret: () => "test-secret", refresh });
    const { result, response } = responseRecorder();

    await handler(requestWith("Bearer wrong") as never, response as never, vi.fn());

    expect(result).toEqual({ statusCode: 403, body: { ok: false, error: "cron-only" } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns only a safe refresh summary to an authenticated scheduler", async () => {
    const refresh = vi.fn().mockResolvedValue({ source: "espn-unofficial-preview", stale: false, fetchedAt: "2026-08-27T00:00:00.000Z", events: [{ id: "event-1" }] });
    const handler = createEspnPreviewRefreshHandler({ getCronSecret: () => "test-secret", refresh });
    const { result, response } = responseRecorder();

    await handler(requestWith("Bearer test-secret") as never, response as never, vi.fn());

    expect(result).toEqual({ statusCode: 200, body: { ok: true, source: "espn-unofficial-preview", stale: false, fetchedAt: "2026-08-27T00:00:00.000Z", eventCount: 1 } });
    expect(JSON.stringify(result.body)).not.toContain("score");
  });

  it("fails closed without exposing upstream details when ESPN refresh fails", async () => {
    const handler = createEspnPreviewRefreshHandler({ getCronSecret: () => "test-secret", refresh: vi.fn().mockRejectedValue(new Error("upstream details")) });
    const { result, response } = responseRecorder();

    await handler(requestWith("Bearer test-secret") as never, response as never, vi.fn());

    expect(result).toEqual({ statusCode: 502, body: { ok: false, error: "scoreboard-refresh-failed" } });
  });
});
