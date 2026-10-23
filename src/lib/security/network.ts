import "server-only";
import { createHash } from "node:crypto";

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT ?? (process.env.NODE_ENV === "production" ? "" : process.env.SESSION_SECRET ?? "dev");
  if (!salt) {
    throw new Error("IP_HASH_SALT deve ser configurado em producao.");
  }
  return createHash("sha256")
    .update(ip.trim().toLowerCase())
    .update(salt)
    .digest("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getClientIp(headers: Headers): string | null {
  // So confiar em cabecalhos encaminhados quando o proxy confiavel foi configurado.
  if (process.env.TRUSTED_PROXY_HEADERS !== "true") return null;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export function getUserAgent(headers: Headers): string | null {
  const ua = headers.get("user-agent");
  if (!ua) return null;
  return ua.slice(0, 512);
}
