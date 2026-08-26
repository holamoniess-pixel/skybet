import { describe, expect, it } from "vitest";
import { getSentryOptions } from "./sentry";

describe("Sentry configuration", () => {
  it("does not initialize without a DSN", () => {
    expect(getSentryOptions(undefined)).toBeNull();
  });

  it("scrubs sensitive request data when configured", () => {
    const options = getSentryOptions("https://example.invalid/123");
    expect(options).toMatchObject({
      dsn: "https://example.invalid/123",
      sendDefaultPii: false,
      maxBreadcrumbs: 50,
      tracesSampleRate: 0.1,
    });
    expect(options?.beforeSendTransaction).toBeTypeOf("function");
    expect(options?.beforeSend).toBeTypeOf("function");
  });
});
