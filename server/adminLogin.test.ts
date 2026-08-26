import { describe, expect, it } from "vitest";
import { createAdminLoginHandler, hashAdminPassword, localAdminOpenId, verifyAdminPassword } from "./adminLogin";

async function invokeAdminLogin(body: Record<string, unknown>, deps = {}) {
  let statusCode = 200;
  let responseBody: unknown;
  let cookie: { name: string; value: string } | undefined;
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(payload: unknown) { responseBody = payload; return this; },
    cookie(name: string, value: string) { cookie = { name, value }; return this; },
  };
  await createAdminLoginHandler(deps)({ body, protocol: "http", headers: {} } as any, response as any);
  return { statusCode, responseBody, cookie };
}

describe("administrator credential endpoint", () => {
  it("accepts the securely configured administrator credentials without returning secret material", async () => {
    const configuredEmail = process.env.SKYBET_INITIAL_ADMIN_EMAIL;
    const configuredPassword = process.env.SKYBET_INITIAL_ADMIN_PASSWORD;
    expect(configuredEmail).toBeTruthy();
    expect(configuredPassword).toBeTruthy();

    const response = await invokeAdminLogin({ email: configuredEmail, password: configuredPassword }, {
      findCredential: async () => undefined,
      bootstrap: async () => ({ credential: { passwordHash: "unused-in-bootstrap" }, user: { id: 1, openId: "local-admin:test", name: "SKYBET administrator" } }),
      recordSignIn: async () => undefined,
      createSession: async () => "test-session",
    });
    expect(response.statusCode).toBe(200);
    expect(response.responseBody).toEqual({ ok: true, redirectTo: "/admin" });
    expect(response.cookie?.name).toBe("app_session_id");
    expect(JSON.stringify(response.responseBody)).not.toContain(configuredPassword!);
  });

  it("rejects an invalid administrator password", async () => {
    const response = await invokeAdminLogin({ email: process.env.SKYBET_INITIAL_ADMIN_EMAIL, password: "not-the-configured-password" }, { findCredential: async () => undefined });
    expect(response.statusCode).toBe(401);
  });

  it("stores only a derived password value for later administrator sign-in", async () => {
    const password = process.env.SKYBET_INITIAL_ADMIN_PASSWORD!;
    const hash = await hashAdminPassword(password);
    expect(hash).not.toContain(password);
    await expect(verifyAdminPassword(password, hash)).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("creates a deterministic local administrator identifier that fits the user schema", () => {
    expect(localAdminOpenId("administrator@example.com")).toHaveLength(49);
  });
});
