import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { bootstrapLocalAdminCredential, getLocalAdminCredentialByEmail, recordLocalAdminSignIn } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ADMIN_SESSION_COOKIE, createLocalAdminSessionToken } from "./localAdminSession";

const scrypt = promisify(scryptCallback);
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
type AdminLoginInput = { email?: unknown; password?: unknown };
type StoredAdmin = { credential: { passwordHash: string }; user: { id: number; openId: string; name: string | null } };

export function normalizeAdminEmail(value: string) { return value.trim().toLowerCase(); }
export async function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
export async function verifyAdminPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
function secureEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
export function localAdminOpenId(email: string) {
  return `local:${createHash("sha256").update(email).digest("base64url")}`;
}
type AdminLoginDependencies = {
  findCredential?: (email: string) => Promise<StoredAdmin | undefined>;
  bootstrap?: (input: { email: string; passwordHash: string; openId: string }) => Promise<StoredAdmin | undefined>;
  recordSignIn?: (userId: number) => Promise<void>;
  createSession?: (openId: string, name: string) => Promise<string>;
};

export function createAdminLoginHandler(dependencies: AdminLoginDependencies = {}) {
  const findCredential = dependencies.findCredential ?? getLocalAdminCredentialByEmail;
  const bootstrap = dependencies.bootstrap ?? bootstrapLocalAdminCredential;
  const recordSignIn = dependencies.recordSignIn ?? recordLocalAdminSignIn;
  const createSession = dependencies.createSession ?? ((openId) => createLocalAdminSessionToken(openId, ADMIN_SESSION_MS));
  return async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as AdminLoginInput;
    const email = typeof body.email === "string" ? normalizeAdminEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return res.status(400).json({ error: "Enter your administrator email and password." });

    const configuredEmail = process.env.SKYBET_INITIAL_ADMIN_EMAIL;
    const configuredPassword = process.env.SKYBET_INITIAL_ADMIN_PASSWORD;
    const matchesConfiguredAdmin = Boolean(configuredEmail && configuredPassword && secureEqual(email, normalizeAdminEmail(configuredEmail)) && secureEqual(password, configuredPassword));
    let stored = await findCredential(email);
    if (!stored) {
      if (!matchesConfiguredAdmin) return res.status(401).json({ error: "Invalid administrator email or password." });
      stored = await bootstrap({ email, passwordHash: await hashAdminPassword(password), openId: localAdminOpenId(email) });
      if (!stored) return res.status(503).json({ error: "Administrator sign-in is temporarily unavailable." });
    } else if (!(await verifyAdminPassword(password, stored.credential.passwordHash))) {
      return res.status(401).json({ error: "Invalid administrator email or password." });
    }

    await recordSignIn(stored.user.id);
    const sessionToken = await createSession(stored.user.openId, stored.user.name || "SKYBET administrator");
    res.cookie(ADMIN_SESSION_COOKIE, sessionToken, { ...getSessionCookieOptions(req), maxAge: ADMIN_SESSION_MS });
    return res.status(200).json({ ok: true, redirectTo: "/admin" });
  };
}
