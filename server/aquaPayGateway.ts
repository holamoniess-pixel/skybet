import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

export type AquaPayGatewayReadiness = {
  provider: "Aqùapay";
  status: "disabled" | "unconfigured" | "ready";
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
    status: !ENV.aquaPayEnabled ? "disabled" : configuredSecrets.apiUrl && configuredSecrets.apiKey && configuredSecrets.webhookSecret ? "ready" : "unconfigured",
    configuredSecrets,
  };
}

export function assertAquaPayReadyForImplementation() {
  const readiness = getAquaPayGatewayReadiness();
  if (readiness.status === "disabled") {
    throw new Error("Aqùapay is disabled. Set AQUAPAY_ENABLED=true after configuring the server-only payment secrets.");
  }
  if (readiness.status === "unconfigured") {
    throw new Error("Aqùapay is not configured. Add the API URL, API key, and webhook secret through server-only project secrets.");
  }
  return readiness;
}

export type AquaPayPaymentInput = { amount: number; currency: "GHS"; reference: string; customerPhone: string; network: "MTN" | "VODAFONE" | "AIRTELTIGO"; callbackUrl?: string };

export async function initiateAquaPayPayment(input: AquaPayPaymentInput) {
  assertAquaPayReadyForImplementation();
  const base = ENV.aquaPayApiUrl.replace(/\/+$/, "");
  const path = ENV.aquaPayPaymentPath.startsWith("/") ? ENV.aquaPayPaymentPath : `/${ENV.aquaPayPaymentPath}`;
  const header = ENV.aquaPayApiKeyHeader || "Authorization";
  const value = header.toLowerCase() === "authorization" ? `Bearer ${ENV.aquaPayApiKey}` : ENV.aquaPayApiKey;
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": input.reference, [header]: value },
    body: JSON.stringify({ amount: Math.round(input.amount * 100), currency: input.currency, method: "mobile_money", network: input.network, customer: { phone: input.customerPhone }, reference: input.reference }),
  });
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { /* provider may return an empty body */ }
  if (!response.ok) {
    const providerMessage = typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : undefined;
    console.error("[Aqùapay] Payment initiation rejected", { status: response.status, message: providerMessage, responseKeys: Object.keys(data) });
    throw new Error(`Aqùapay payment initiation failed (${response.status}).`);
  }
  const checkoutUrl = [data.checkout_url, data.payment_url, data.redirect_url, data.url].find(value => typeof value === "string") as string | undefined;
  if (!checkoutUrl) throw new Error("Aqùapay did not return a hosted checkout URL.");
  return { providerReference: String(data.provider_reference ?? data.transaction_id ?? data.id ?? input.reference), checkoutUrl, raw: data };
}

export function verifyAquaPayWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  if (!ENV.aquaPayWebhookSecret || !signature) return false;
  const expected = createHmac("sha256", ENV.aquaPayWebhookSecret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/i, "").trim();
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
