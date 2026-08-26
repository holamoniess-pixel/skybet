export type SportsDataConnectionStatus = {
  state: "preview-configured";
  provider: "ESPN unofficial site API";
  refreshStrategy: "server-cache-on-demand";
  message: string;
};

/**
 * SKYBET serves this best-effort ESPN preview only through its backend. It is
 * deliberately separate from odds, bet pricing, balances, and settlement.
 */
export function getSportsDataConnectionStatus(): SportsDataConnectionStatus {
  return {
    state: "preview-configured",
    provider: "ESPN unofficial site API",
    refreshStrategy: "server-cache-on-demand",
    message: "Best-effort scores and fixtures preview sourced from ESPN. Not official betting odds, not an ESPN partnership, and not used for wagers or settlement.",
  };
}
