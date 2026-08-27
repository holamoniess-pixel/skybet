import { jwtVerify, SignJWT } from "jose";
import type { Request } from "express";
import type { User } from "../drizzle/schema";
import { getUserByOpenId } from "./db";

export const ADMIN_SESSION_COOKIE = "skybet-admin-session";

function sessionSecret() {
  const secret = process.env.JWT_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
}

export function getLocalAdminSessionToken(req: Request) {
  const parsedToken = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (typeof parsedToken === "string") return parsedToken;
  const rawCookieHeader = req.headers?.cookie;
  if (!rawCookieHeader) return null;
  const pair = rawCookieHeader.split(";").map(segment => segment.trim()).find(segment => segment.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(ADMIN_SESSION_COOKIE.length + 1));
  } catch {
    return null;
  }
}

export async function createLocalAdminSessionToken(openId: string, expiresInMs: number) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Local administrator sessions are unavailable");
  return new SignJWT({ openId, scope: "skybet-local-admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + expiresInMs) / 1000))
    .sign(secret);
}

export async function verifyLocalAdminSessionToken(token: string | null) {
  const secret = sessionSecret();
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return typeof payload.openId === "string" && payload.scope === "skybet-local-admin" ? payload.openId : null;
  } catch {
    return null;
  }
}

export async function authenticateLocalAdminRequest(req: Request): Promise<User | null> {
  const openId = await verifyLocalAdminSessionToken(getLocalAdminSessionToken(req));
  if (!openId) return null;
  const user = await getUserByOpenId(openId);
  return user?.role === "admin" ? user : null;
}
