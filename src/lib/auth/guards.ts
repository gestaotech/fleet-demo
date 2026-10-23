import "server-only";
import { prisma } from "@/lib/db/prisma";
import { verifySessionToken } from "@/lib/auth/session";
import { DEFAULT_ROLE_MODULES, ModuleKey } from "@/config/permissions";
import { hashToken } from "@/lib/security/network";

export type SessionContext = {
  sessionId: string;
  userId: string;
  companyId: string | null;
  membershipId: string | null;
  role: import("@prisma/client").Role | null;
  isPlatformAdmin: boolean;
  permissions: ModuleKey[];
};

function union(a: ModuleKey[], b: ModuleKey[]) {
  const set = new Set<ModuleKey>([...a, ...b]);
  return [...set];
}

export async function getSessionContext(
  token: string | null,
): Promise<SessionContext | null> {
  if (!token) return null;
  const verified = await verifySessionToken(token);
  if (!verified) return null;

  const session = await prisma.session.findUnique({
    where: { id: verified.sid },
    include: {
      user: true,
      company: true,
    },
  });

  if (!session || session.revokedAt) return null;
  // O identificador do usuario assinado no JWT deve corresponder a sessao persistida.
  if (verified.userId !== session.userId) return null;
  // A sessao so e valida se o hash do JWT recebido corresponder ao hash armazenado.
  if (session.tokenHash !== hashToken(token)) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.user.active) return null;

  let companyId: string | null = session.companyId;
  let membershipId: string | null = null;
  let role: import("@prisma/client").Role | null = null;
  let permissions: ModuleKey[] = [];

  if (companyId && !session.company?.active) {
    // Empresas suspensas nao podem ser usadas, mesmo que a associacao siga ativa.
    companyId = null;
  }

  if (companyId) {
    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: session.userId, companyId } },
      include: { permissions: true },
    });
    if (membership && membership.active) {
      membershipId = membership.id;
      role = membership.role;
      const base = DEFAULT_ROLE_MODULES[membership.role];
      const extra = membership.permissions.map((p) => p.module);
      permissions = union(base, extra);
    } else {
      companyId = null;
    }
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    sessionId: session.id,
    userId: session.userId,
    companyId,
    membershipId,
    role,
    isPlatformAdmin: session.user.isPlatformAdmin,
    permissions,
  };
}

export function hasModule(ctx: SessionContext, module: ModuleKey) {
  if (ctx.isPlatformAdmin) return true;
  if (ctx.role === "OWNER" || ctx.role === "ADMIN") {
    // ADMIN/OWNER mantem acesso por padrao, mas a verificacao explicita
    // tambem considera a lista efetiva para auditoria e regras futuras.
  }
  return ctx.permissions.includes(module);
}

export function requireCompany(ctx: SessionContext | null): SessionContext {
  if (!ctx) throw new AuthError("Nao autenticado", 401);
  if (!ctx.companyId) throw new AuthError("Nenhuma empresa selecionada", 403);
  return ctx;
}

export function requireModule(
  ctx: SessionContext | null,
  module: ModuleKey,
): SessionContext {
  const c = requireCompany(ctx);
  if (!hasModule(c, module)) throw new AuthError("Sem permissao", 403);
  return c;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
