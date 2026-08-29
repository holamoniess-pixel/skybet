import { describe, expect, it, vi } from "vitest";
import { createFirstPartyAuthHandlers } from "./firstPartyAuth";

function makeResponse() {
  const response = {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) { response.statusCode = code; return response; },
    json(value: unknown) { response.payload = value; return response; },
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  return response;
}

describe("first-party referral signup notifications", () => {
  it("notifies the referrer and owner after an attributed signup", async () => {
    const recordReferralNotifications = vi.fn().mockResolvedValue({ referrerUserId: 42, adminCount: 2 });
    const notifyOwner = vi.fn().mockResolvedValue(undefined);
    const createSession = vi.fn().mockResolvedValue(undefined);
    const handlers = createFirstPartyAuthHandlers({
      findEmail: vi.fn().mockResolvedValue(undefined),
      findPhone: vi.fn().mockResolvedValue(undefined),
      createCustomer: vi.fn().mockResolvedValue({ id: 9, openId: "customer:9", name: "New Customer", email: "new@example.com", role: "user" }),
      createSession,
      recordReferralNotifications,
      notifyOwner,
    });
    const response = makeResponse();
    const request = { body: { name: "New Customer", email: "new@example.com", phone: "0241234567", password: "secure-password", confirmPassword: "secure-password", referralCode: "skyref42" }, cookies: {}, headers: {} };

    await handlers.signup(request as never, response as never);
    await Promise.resolve();

    expect(response.statusCode).toBe(201);
    expect(recordReferralNotifications).toHaveBeenCalledWith({ referredUserId: 9, referredName: "New Customer", referralCode: "SKYREF42" });
    expect(notifyOwner).toHaveBeenCalledWith({ title: "New referral signup", content: "New Customer joined using a referral link. The referrer has been notified in SKYBET." });
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch referral notifications for an ordinary signup", async () => {
    const recordReferralNotifications = vi.fn();
    const notifyOwner = vi.fn();
    const handlers = createFirstPartyAuthHandlers({
      findEmail: vi.fn().mockResolvedValue(undefined),
      findPhone: vi.fn().mockResolvedValue(undefined),
      createCustomer: vi.fn().mockResolvedValue({ id: 10, openId: "customer:10", name: "Direct Customer", email: "direct@example.com", role: "user" }),
      createSession: vi.fn().mockResolvedValue(undefined),
      recordReferralNotifications,
      notifyOwner,
    });
    const response = makeResponse();
    const request = { body: { name: "Direct Customer", email: "direct@example.com", phone: "0241234567", password: "secure-password", confirmPassword: "secure-password" }, cookies: {}, headers: {} };

    await handlers.signup(request as never, response as never);

    expect(response.statusCode).toBe(201);
    expect(recordReferralNotifications).not.toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
  });
});
