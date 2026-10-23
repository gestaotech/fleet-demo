import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getSessionContext } from "@/lib/auth/guards";
import { getSessionCookie } from "@/lib/auth/session";
import { ModuleKey } from "@prisma/client";

export async function getAuth() {
  const token = await getSessionCookie();
  return getSessionContext(token);
}

export async function getCurrentUser() {
  const ctx = await getAuth();
  if (!ctx) return null;
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  });
  return user;
}

export async function getUserCompanies() {
  const ctx = await getAuth();
  if (!ctx) return [];
  const memberships = await prisma.companyMembership.findMany({
    where: { userId: ctx.userId, active: true },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships
    .filter((m) => m.company.active)
    .map((m) => ({
      membershipId: m.id,
      companyId: m.companyId,
      role: m.role,
      name: m.company.name,
      slug: m.company.slug,
    }));
}

export function canAccessModule(ctx: Awaited<ReturnType<typeof getAuth>>, module: ModuleKey) {
  if (!ctx) return false;
  if (ctx.isPlatformAdmin) return true;
  return ctx.permissions.includes(module);
}
