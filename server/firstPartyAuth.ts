import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { createCustomerSession, createCustomerWithCredentials, deleteCustomerSession, getCustomerCredentialByEmail, getCustomerCredentialByPhone, getCustomerSessionUser } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "../shared/const";
import { sdk } from "./_core/sdk";
import { validateGhanaMobileMoneyNumber } from "../shared/payments";

const scrypt = promisify(scryptCallback);
export const CUSTOMER_SESSION_COOKIE = "skybet-session";
const CUSTOMER_SESSION_MS = 12 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

type Credentials = { email?: unknown; phone?: unknown; password?: unknown; confirmPassword?: unknown; name?: unknown };

export function normalizeCustomerEmail(value: string) { return value.trim().toLowerCase(); }

export function normalizeCustomerPhone(value: string) {
  const result = validateGhanaMobileMoneyNumber(value);
  return result.ok ? result.number : null;
}

export async function hashCustomerPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyCustomerPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function hashSessionToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function getCustomerSessionToken(req: Request) {
  const parsedToken = req.cookies?.[CUSTOMER_SESSION_COOKIE];
  if (typeof parsedToken === "string") return parsedToken;

  const rawCookieHeader = req.headers?.cookie;
  if (!rawCookieHeader) return null;
  const cookiePair = rawCookieHeader.split(";").map(segment => segment.trim()).find(segment => segment.startsWith(`${CUSTOMER_SESSION_COOKIE}=`));
  if (!cookiePair) return null;
  const encodedToken = cookiePair.slice(CUSTOMER_SESSION_COOKIE.length + 1);
  try {
    return decodeURIComponent(encodedToken);
  } catch {
    return null;
  }
}
function publicUser(user: { id: number; openId: string; name: string | null; email: string | null; role: "user" | "admin" }) {
  return { id: user.id, openId: user.openId, name: user.name, email: user.email, role: user.role };
}
function clearSession(res: Response, req: Request) { res.clearCookie(CUSTOMER_SESSION_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 }); }

async function issueCustomerSession(user: { id: number; openId: string; name: string | null; email: string | null; role: "user" | "admin" }, req: Request, res: Response, createSession: typeof createCustomerSession) {
  const token = randomBytes(32).toString("base64url");
  await createSession({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + CUSTOMER_SESSION_MS) });
  res.cookie(CUSTOMER_SESSION_COOKIE, token, { ...getSessionCookieOptions(req), maxAge: CUSTOMER_SESSION_MS, httpOnly: true });
  return publicUser(user);
}

export async function authenticateCustomerRequest(req: Request) {
  const token = getCustomerSessionToken(req);
  if (typeof token !== "string" || token.length < 32) return null;
  const user = await getCustomerSessionUser(hashSessionToken(token));
  return user ?? null;
}

export function createFirstPartyAuthHandlers(deps: {
  findEmail?: typeof getCustomerCredentialByEmail;
  findPhone?: typeof getCustomerCredentialByPhone;
  createCustomer?: typeof createCustomerWithCredentials;
  createSession?: typeof createCustomerSession;
} = {}) {
  const findEmail = deps.findEmail ?? getCustomerCredentialByEmail;
  const findPhone = deps.findPhone ?? getCustomerCredentialByPhone;
  const createCustomer = deps.createCustomer ?? createCustomerWithCredentials;
  const createSession = deps.createSession ?? createCustomerSession;
  return {
    signup: async (req: Request, res: Response) => {
      const body = (req.body ?? {}) as Credentials;
      const email = typeof body.email === "string" ? normalizeCustomerEmail(body.email) : "";
      const phone = typeof body.phone === "string" ? normalizeCustomerPhone(body.phone) : null;
      const password = typeof body.password === "string" ? body.password : "";
      const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : undefined;
      if (!email || !email.includes("@")) return res.status(400).json({ error: "Enter a valid email address." });
      if (!phone) return res.status(400).json({ error: "Enter a valid Ghana Mobile Money number." });
      if (password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      if (password !== confirmPassword) return res.status(400).json({ error: "Passwords do not match." });
      if (await findEmail(email) || await findPhone(phone)) return res.status(409).json({ error: "An account with those details already exists." });
      try {
        const user = await createCustomer({ email, phone, passwordHash: await hashCustomerPassword(password), name });
        if (!user) return res.status(503).json({ error: "Account creation is temporarily unavailable." });
        const sessionUser = await issueCustomerSession(user, req, res, createSession);
        return res.status(201).json({ ok: true, user: sessionUser });
      } catch {
        return res.status(409).json({ error: "An account with those details already exists." });
      }
    },
    login: async (req: Request, res: Response) => {
      const body = (req.body ?? {}) as Credentials;
      const email = typeof body.email === "string" ? normalizeCustomerEmail(body.email) : "";
      const password = typeof body.password === "string" ? body.password : "";
      const record = email ? await findEmail(email) : undefined;
      if (!record || !(await verifyCustomerPassword(password, record.credential.passwordHash))) return res.status(401).json({ error: "Invalid email or password." });
      const user = await issueCustomerSession(record.user, req, res, createSession);
      return res.status(200).json({ ok: true, user });
    },
    logout: async (req: Request, res: Response) => {
      const token = getCustomerSessionToken(req);
      if (typeof token === "string") await deleteCustomerSession(hashSessionToken(token));
      clearSession(res, req);
      res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
      return res.status(200).json({ ok: true });
    },
    me: async (req: Request, res: Response) => {
      const customer = await authenticateCustomerRequest(req);
      if (customer) return res.status(200).json({ user: publicUser(customer) });
      try {
        const legacyUser = await sdk.authenticateRequest(req);
        return res.status(200).json({ user: publicUser(legacyUser) });
      } catch {
        return res.status(200).json({ user: null });
      }
    },
  };
}
