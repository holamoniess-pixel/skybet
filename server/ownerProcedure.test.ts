import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function adminContext(email: string): TrpcContext {
  return {
    user: { id: 42, openId: "admin:secondary", name: "Secondary", email, loginMethod: "password", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("owner-only administrator management", () => {
  it("rejects a subordinate administrator before any management query runs", async () => {
    vi.stubEnv("SKYBET_INITIAL_ADMIN_EMAIL", "owner@skybet.example");
    const caller = appRouter.createCaller(adminContext("secondary@skybet.example"));

    await expect(caller.adminManagement.listAdministrators()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
