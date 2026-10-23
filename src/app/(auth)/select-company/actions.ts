import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { getAuth } from "@/lib/auth/queries";
import { verifySessionToken } from "@/lib/auth/session";
import { audit } from "@/lib/audit/service";
import { redirect } from "next/navigation";

const COOKIE_NAME = "fleet_session";

/*
 * Seleciona a empresa ativa na sessao. O companyId vem da lista de vinculos
 * do usuario (getUserCompanies), nunca de um valor arbitrario enviado sem
 * validacao. Apenas empresas ativas com membership ativo sao permitidas.
 */
export async function selectCompanyAction(formData: FormData) {
  const ctx = await getAuth();
  if (!ctx) redirect("/login");

  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) throw new Error("Empresa nao informada");

  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: ctx.userId, companyId } },
    include: { company: true },
  });

  if (!membership || !membership.active || !membership.company.active) {
    throw new Error("Acesso nao autorizado a esta empresa");
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
  if (!token) redirect("/login");
  const verified = await verifySessionToken(token);
  if (!verified || verified.userId !== ctx.userId) redirect("/login");

  await prisma.session.update({
    where: { id: verified.sid },
    data: { companyId },
  });

  await audit({
    action: "COMPANY_SWITCHED",
    entity: "company",
    entityId: companyId,
    actorUserId: ctx.userId,
    companyId,
    result: "SUCCESS",
  });

  redirect("/dashboard");
}
