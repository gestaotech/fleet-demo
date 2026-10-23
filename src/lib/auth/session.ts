import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "fleet_session";
const ISSUER = "gestaotech-fleet";
const AUDIENCE = "fleet-app";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET nao configurado. Defina em .env/.env.local. Gere com: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("SESSION_SECRET muito curto para producao.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionJwtPayload = {
  sid: string;
  sub: string;
};

export async function createSessionToken(sessionId: string, userId: string) {
  const ttlHoras = Number(process.env.SESSION_TTL_HOURS ?? "8");
  const ttlSegundos = Math.max(1, ttlHoras) * 3600;
  const secret = getSecret();

  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSegundos}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const sid = typeof payload.sid === "string" ? payload.sid : null;
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sid || !sub) return null;
  return { sid, userId: sub };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  const ttlHoras = Number(process.env.SESSION_TTL_HOURS ?? "8");
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(1, ttlHoras) * 3600,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionCookie() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export { COOKIE_NAME };
