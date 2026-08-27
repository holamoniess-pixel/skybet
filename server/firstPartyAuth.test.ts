import { describe, expect, it, vi } from "vitest";
import { createFirstPartyAuthHandlers, getCustomerSessionToken, hashCustomerPassword, normalizeCustomerPhone, verifyCustomerPassword } from "./firstPartyAuth";

function responseDouble() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), cookie: vi.fn(), clearCookie: vi.fn() } as any;
}
function requestDouble(body: unknown) { return { body, protocol: "http", headers: {}, cookies: {} } as any; }

describe("first-party customer authentication", () => {
  it("hashes passwords with scrypt and verifies the matching password only", async () => {
    const hash = await hashCustomerPassword("secure-password");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyCustomerPassword("secure-password", hash)).toBe(true);
    expect(await verifyCustomerPassword("wrong-password", hash)).toBe(false);
    expect(hash).not.toContain("secure-password");
  });

  it("normalizes accepted Ghana phone formats", () => {
    expect(normalizeCustomerPhone("024 123 4567")).toBe("233241234567");
    expect(normalizeCustomerPhone("+233241234567")).toBe("233241234567");
    expect(normalizeCustomerPhone("12345")).toBeNull();
  });

  it("reads the customer session from a raw Cookie header when proxy middleware does not populate req.cookies", () => {
    const token = "a".repeat(43);
    expect(getCustomerSessionToken({ headers: { cookie: `theme=light; skybet-session=${token}; locale=en` } } as any)).toBe(token);
    expect(getCustomerSessionToken({ headers: { cookie: "theme=light" } } as any)).toBeNull();
  });

  it("rejects mismatched sign-up passwords before persistence", async () => {
    const createCustomer = vi.fn();
    const handler = createFirstPartyAuthHandlers({ findEmail: vi.fn().mockResolvedValue(undefined), findPhone: vi.fn().mockResolvedValue(undefined), createCustomer: createCustomer as any });
    const res = responseDouble();
    await handler.signup({ body: { email: "customer@example.com", phone: "0241234567", password: "secure-password", confirmPassword: "different-password" } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Passwords do not match." });
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it("issues a session after successful sign-up without returning a password", async () => {
    const createCustomer = vi.fn().mockResolvedValue({ id: 7, openId: "customer:7", name: "Ava", email: "ava@example.com", role: "user" });
    const createSession = vi.fn().mockResolvedValue(undefined);
    const handler = createFirstPartyAuthHandlers({ findEmail: vi.fn().mockResolvedValue(undefined), findPhone: vi.fn().mockResolvedValue(undefined), createCustomer: createCustomer as any, createSession: createSession as any });
    const res = responseDouble();
    await handler.signup(requestDouble({ email: "AVA@example.com", phone: "0241234567", password: "secure-password", confirmPassword: "secure-password", name: "Ava" }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ email: "ava@example.com", phone: "233241234567", passwordHash: expect.stringContaining("scrypt$") }));
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(res.cookie).toHaveBeenCalledWith("skybet-session", expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(res.json).toHaveBeenCalledWith({ ok: true, user: { id: 7, openId: "customer:7", name: "Ava", email: "ava@example.com", role: "user" } });
  });

  it("issues a session after a valid email/password login", async () => {
    const passwordHash = await hashCustomerPassword("secure-password");
    const createSession = vi.fn().mockResolvedValue(undefined);
    const handler = createFirstPartyAuthHandlers({ findEmail: vi.fn().mockResolvedValue({ credential: { passwordHash }, user: { id: 8, openId: "customer:8", name: "Kai", email: "kai@example.com", role: "user" } } as any), createSession: createSession as any });
    const res = responseDouble();
    await handler.login(requestDouble({ email: "KAI@example.com", password: "secure-password" }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 8 }));
  });

  it("uses generic login failure feedback for an unknown account", async () => {
    const handler = createFirstPartyAuthHandlers({ findEmail: vi.fn().mockResolvedValue(undefined) });
    const res = responseDouble();
    await handler.login({ body: { email: "unknown@example.com", password: "wrong-password" } } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password." });
  });

  it("prefers a valid local administrator session over an existing customer session", async () => {
    const customer = vi.fn().mockResolvedValue({ id: 4, openId: "customer:4", name: "Customer", email: "customer@example.com", role: "user" });
    const admin = vi.fn().mockResolvedValue({ id: 1, openId: "local-admin:1", name: "Owner", email: "owner@example.com", role: "admin" });
    const handler = createFirstPartyAuthHandlers({ authenticateCustomer: customer, authenticateAdmin: admin });
    const res = responseDouble();

    await handler.me(requestDouble({}), res);

    expect(admin).toHaveBeenCalled();
    expect(customer).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ user: { id: 1, openId: "local-admin:1", name: "Owner", email: "owner@example.com", role: "admin" } });
  });
});
