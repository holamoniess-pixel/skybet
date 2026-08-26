import { ENV } from "./_core/env";

export type AquaPayGatewayReadiness = {
  provider: "Aqùapay";
  status: "unconfigured" | "awaiting_contract";
  configuredSecrets: {
    apiUrl: boolean;
    apiKey: boolean;
    webhookSecret: boolean;
  };
};

export function getAquaPayGatewayReadiness(): AquaPayGatewayReadiness {
  const configuredSecrets = {
    apiUrl: Boolean(ENV.aquaPayApiUrl),
    apiKey: Boolean(ENV.aquaPayApiKey),
    webhookSecret: Boolean(ENV.aquaPayWebhookSecret),
  };
  return {
    provider: "Aqùapay",
    status: configuredSecrets.apiUrl && configuredSecrets.apiKey && configuredSecrets.webhookSecret ? "awaiting_contract" : "unconfigured",
    configuredSecrets,
  };
}

export function assertAquaPayReadyForImplementation() {
  const readiness = getAquaPayGatewayReadiness();
  if (readiness.status === "unconfigured") {
    throw new Error("Aqùapay is not configured. Add the API URL, API key, and webhook secret through server-only project secrets.");
  }
  throw new Error("Aqùapay credentials are present, but an official API contract and signed-webhook specification must be verified before requests can be initiated.");
}
