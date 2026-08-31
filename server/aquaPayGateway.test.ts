import { describe, expect, it } from "vitest";
import { getAquaPayGatewayReadiness } from "./aquaPayGateway";

describe("Aqùapay Mobile Money gateway boundary", () => {
  it("reports a non-secret unconfigured state when project credentials have not been supplied", () => {
    const readiness = getAquaPayGatewayReadiness();
    expect(readiness.provider).toBe("Aqùapay");
    expect(readiness.status).toBe("disabled");
    expect(readiness).not.toHaveProperty("apiKey");
    expect(readiness).not.toHaveProperty("webhookSecret");
  });
});
