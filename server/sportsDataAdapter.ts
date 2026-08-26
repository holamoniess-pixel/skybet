export type SportsDataConnectionStatus = {
  state: "unconfigured";
  provider: null;
  refreshStrategy: "provider-sse-or-server-polling";
  message: string;
};

/**
 * Deliberately does not contact a provider. It establishes a stable public
 * contract for the future server-side adapter while no approved credentials
 * or licensed provider connection have been supplied to this project.
 */
export function getSportsDataConnectionStatus(): SportsDataConnectionStatus {
  return {
    state: "unconfigured",
    provider: null,
    refreshStrategy: "provider-sse-or-server-polling",
    message: "Live sports data will appear after an approved provider is configured securely. Licensed source data is normalized server-side with guarded model fallbacks; browser collection remains disabled until source permission is recorded.",
  };
}
