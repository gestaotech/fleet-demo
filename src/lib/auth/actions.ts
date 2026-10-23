import "server-only";
import { prisma } from "@/lib/db/prisma";
import { verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { loginSchema } from "@/lib/validations/auth";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { audit } from "@/lib/audit/service";
import { getClientIp, getUserAgent, hashIp, hashToken } from "@/lib/security/network";

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

function argon2Options() {
  return {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  };
}

/*
 * Login com sessao no servidor.
 * - Nunca revela se o e-mail existe ou nao (mensagem generica).
 * - Aplica bloqueio por tentativas em User.failedLoginCount/lockedUntil.
 * - Gera token opaco, armazena SHA-256 em Session.tokenHash.
 * - Registra LOGIN_SUCCESS/LOGIN_FAILED na auditoria com IP/hash e UA.
 * - companyId da sessao e opcional nesta fase (pode ser escolhido depois).
 */
export async function loginAction(
  input: unknown,
  headers: Headers,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    await audit({
      action: "LOGIN_FAILED",
      entity: "auth",
      result: "DENIED",
      metadata: { motivo: "validacao" },
      headers,
    });
    return { ok: false, error: "Credenciais invalidas." };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.active) {
    await audit({
      action: "LOGIN_FAILED",
      entity: "auth",
      result: "DENIED",
      metadata: { motivo: "usuario_invalido_ou_inativo" },
      headers,
    });
    return { ok: false, error: "Credenciais invalidas." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await audit({
      action: "LOGIN_FAILED",
      entity: "auth",
      actorUserId: user.id,
      result: "DENIED",
      metadata: { motivo: "conta_bloqueada_temporariamente" },
      headers,
    });
    return { ok: false, error: "Credenciais invalidas." };
  }

  const valido = await verify(user.passwordHash, password, argon2Options()).catch(
    () => false,
  );

  if (!valido) {
    // Uma janela de bloqueio expirada inicia uma nova contagem, sem bloqueio imediato.\n    const bloqueioExpirado = Boolean(user.lockedUntil && user.lockedUntil <= new Date());\n    const tentativas = bloqueioExpirado ? 1 : user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: tentativas,
        lockedUntil:
          tentativas >= MAX_TENTATIVAS
            ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000)
            : null,
      },
    });
    await audit({
      action: "LOGIN_FAILED",
      entity: "auth",
      actorUserId: user.id,
      result: "DENIED",
      metadata: { motivo: "senha_invalida" },
      headers,
    });
    return { ok: false, error: "Credenciais invalidas." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const ttlHoras = Number(process.env.SESSION_TTL_HOURS ?? "8");
  const expiresAt = new Date(Date.now() + ttlHoras * 3600 * 1000);
  const rawToken = randomBytes(32).toString("base64url");
  const ip = getClientIp(headers);
  const ua = getUserAgent(headers);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      userAgent: ua,
      ipHash: hashIp(ip),
      expiresAt,
    },
  });

  const jwt = await createSessionToken(session.id, user.id);
  await setSessionCookie(jwt);

  await audit({
    action: "LOGIN",
    entity: "auth",
    actorUserId: user.id,
    result: "SUCCESS",
    metadata: {},
    headers,
  });

  return { ok: true };
}

export async function logoutAction(headers: Headers) {
  const { getSessionCookie } = await import("@/lib/auth/session");
  const token = await getSessionCookie();
  if (!token) return { ok: true };

  const { verifySessionToken } = await import("@/lib/auth/session");
  const verified = await verifySessionToken(token);
  if (verified) {
    await prisma.session
      .update({
        where: { id: verified.sid },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
    await audit({
      action: "LOGOUT",
      entity: "auth",
      actorUserId: verified.userId,
      result: "SUCCESS",
      metadata: {},
      headers,
    });
  }
  const { clearSessionCookie } = await import("@/lib/auth/session");
  await clearSessionCookie();
  return { ok: true };
}
