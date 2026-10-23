import "server-only";
import { prisma } from "@/lib/db/prisma";
import { AuditAction, AuditResult, Prisma } from "@prisma/client";
import { getClientIp, getUserAgent, hashIp } from "@/lib/security/network";

export type AuditInput = {
  companyId?: string | null;
  actorUserId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  result: AuditResult;
  metadata?: Record<string, unknown>;
  headers?: Headers;
};

/*
 * Escrita append-only na trilha de auditoria.
 *
 * - Nunca registrar senha, token, segredo ou hash completo de token.
 * - metadata deve ser filtrada pelo chamador (dados minimizados).
 * - A imutabilidade e garantida pelo gatilho do banco (migration 0002).
 * - Falhas na auditoria NAO devem quebrar a operacao principal; sao logadas
 *   em modo desenvolvimento e silenciadas em producao para nao vazar contexto.
 */
export async function audit(
  input: AuditInput,
  tx: Prisma.TransactionClient = prisma,
) {
  try {
    const ip = input.headers ? getClientIp(input.headers) : null;
    const ua = input.headers ? getUserAgent(input.headers) : null;
    await tx.auditLog.create({
      data: {
        companyId: input.companyId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        result: input.result,
        metadata: (input.metadata ?? null) as any,
        ipHash: hashIp(ip),
        userAgent: ua,
      },
    });
  } catch (erro) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[audit] Falha ao registrar auditoria:", erro);
    }
  }
}
