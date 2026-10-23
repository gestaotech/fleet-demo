import { requireCompany } from "@/lib/auth/guards";
import { getAuth, getCurrentUser } from "@/lib/auth/queries";
import { redirect } from "next/navigation";
import { logoutFormAction } from "./actions";

export default async function DashboardPage() {
  const ctx = await getAuth();
  if (!ctx) redirect("/login");
  const c = requireCompany(ctx);
  const user = await getCurrentUser();

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <header>
        <h1>Painel</h1>
        <p>
          Usuario: {user?.name} ({user?.email}) | Empresa: {c.companyId} | Perfil:{" "}
          {c.role}
        </p>
      </header>
      <section>
        <h2>Permissoes efetivas</h2>
        <p>{c.permissions.join(", ") || "(nenhuma)"}</p>
      </section>
      <section>
        <h2>Fase 1 - Fundacao</h2>
        <ul>
          <li>Autenticacao por sessao no servidor com cookie httpOnly</li>
          <li>Autorizacao por modulo e perfil, companyId da sessao</li>
          <li>Isolamento multiempresa e trilha de auditoria append-only</li>
          <li>Modelos Prisma versionados com migracoes</li>
        </ul>
        <p>
          Os modulos operacionais da demo vanilla serao reintroduzidos nas fases
          seguintes, reaproveitando as regras em js/core.
        </p>
      </section>
      <form action={logoutFormAction}>
        <button type="submit">Sair</button>
      </form>
    </main>
  );
}
