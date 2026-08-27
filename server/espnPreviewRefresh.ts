import type { RequestHandler } from "express";
import { espnPreviewClient, type EspnScoreboardPreview } from "./espnPreview";

type RefreshDependencies = {
  getCronSecret?: () => string | undefined;
  refresh?: () => Promise<EspnScoreboardPreview>;
};

/**
 * This route is intentionally inert unless a server-only Railway variable is
 * configured. It is safe for a provider cron to retry: a refresh only updates
 * the ephemeral ESPN cache and never mutates balances, selections, or results.
 */
export function createEspnPreviewRefreshHandler({
  getCronSecret = () => process.env.SKYBET_ESPN_CRON_SECRET,
  refresh = () => espnPreviewClient.scoreboard(),
}: RefreshDependencies = {}): RequestHandler {
  return async (req, res) => {
    const expectedSecret = getCronSecret();
    if (!expectedSecret) {
      return res.status(503).json({ ok: false, error: "scheduled-refresh-disabled" });
    }
    if (req.get("authorization") !== `Bearer ${expectedSecret}`) {
      return res.status(403).json({ ok: false, error: "cron-only" });
    }
    try {
      const snapshot = await refresh();
      return res.status(200).json({
        ok: true,
        source: snapshot.source,
        stale: snapshot.stale,
        fetchedAt: snapshot.fetchedAt,
        eventCount: snapshot.events.length,
      });
    } catch {
      return res.status(502).json({ ok: false, error: "scoreboard-refresh-failed" });
    }
  };
}
