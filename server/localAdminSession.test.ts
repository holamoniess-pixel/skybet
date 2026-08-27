import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE, createLocalAdminSessionToken, getLocalAdminSessionToken, verifyLocalAdminSessionToken } from "./localAdminSession";

describe("local administrator sessions", () => {
  it("creates and verifies a local administrator token without a Manus app identifier", async () => {
    const token = await createLocalAdminSessionToken("local:administrator", 60_000);
    await expect(verifyLocalAdminSessionToken(token)).resolves.toBe("local:administrator");
  });

  it("reads the isolated administrator cookie from a raw proxied request header", () => {
    expect(getLocalAdminSessionToken({ headers: { cookie: `theme=dark; ${ADMIN_SESSION_COOKIE}=session-value` } } as any)).toBe("session-value");
  });
});
