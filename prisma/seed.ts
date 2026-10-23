/*
 * Seed de DESENVOLVIMENTO/TESTE.
 *
 * Cria uma empresa e um usuario administrador para permitir o primeiro acesso.
 * Nao representa dados reais de cliente: nomes e e-mail vem de variaveis de
 * ambiente e o proprio script exige ALLOW_SEED=true.
 *
 * Protecoes:
 *  - recusa execucao com NODE_ENV=production;
 *  - recusa execucao sem ALLOW_SEED=true;
 *  - nunca sobrescreve a senha de um usuario existente (a menos que
 *    SEED_RESET_PASSWORD=true seja usado conscientemente).
 */
import "dotenv/config";
import { PrismaClient, Role, ModuleKey } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

function exigirAmbienteSeguro() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Seed bloqueado: NODE_ENV=production. Use apenas em desenvolvimento/teste.",
    );
  }
  if (process.env.ALLOW_SEED !== "true") {
    throw new Error(
      "Seed bloqueado: defina ALLOW_SEED=true para confirmar que este banco e de desenvolvimento/teste.",
    );
  }
}

async function main() {
  exigirAmbienteSeguro();

  const companyName = process.env.SEED_COMPANY_NAME ?? "Empresa Demonstracao";
  const companySlug = process.env.SEED_COMPANY_SLUG ?? "empresa-demonstracao";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@exemplo.local")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "Defina SEED_ADMIN_PASSWORD com pelo menos 12 caracteres (nunca use senha padrao em producao).",
    );
  }

  const company = await prisma.company.upsert({
    where: { slug: companySlug },
    update: { name: companyName },
    create: { name: companyName, slug: companySlug },
  });

  const existente = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { memberships: { where: { companyId: company.id } } },
  });

  let userId: string;

  if (existente) {
    userId = existente.id;
    if (process.env.SEED_RESET_PASSWORD === "true") {
      await prisma.user.update({
        where: { id: existente.id },
        data: { passwordHash: await hash(adminPassword), active: true },
      });
      console.warn("[seed] Senha do usuario existente foi redefinida.");
    } else {
      console.log("[seed] Usuario ja existe; senha preservada.");
    }
  } else {
    const criado = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: await hash(adminPassword),
      },
    });
    userId = criado.id;
  }

  const membership = await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId, companyId: company.id } },
    update: { role: Role.OWNER, active: true },
    create: {
      userId,
      companyId: company.id,
      role: Role.OWNER,
      active: true,
    },
  });

  const modulos = Object.values(ModuleKey);
  await prisma.membershipPermission.createMany({
    data: modulos.map((module) => ({ membershipId: membership.id, module })),
    skipDuplicates: true,
  });

  console.log("[seed] Empresa:", company.name, `(${company.slug})`);
  console.log("[seed] Usuario administrador:", adminEmail);
  console.log("[seed] Perfil: OWNER | Modulos:", modulos.join(", "));
  console.log(
    "[seed] A senha NAO e exibida. Use a informada em SEED_ADMIN_PASSWORD.",
  );
}

main()
  .catch((erro) => {
    console.error("[seed] Falhou:", erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
