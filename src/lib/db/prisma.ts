/*
 * Cliente Prisma singleton (Next.js). Em desenvolvimento evita multiplas
 * instancias durante hot reload; em producao usa uma unica instancia.
 * Nunca instanciar PrismaClient diretamente em rotas/servers para evitar
 * esgotamento de conexoes.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma || new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
