import { getAuth, getUserCompanies } from "@/lib/auth/queries";
import { redirect } from "next/navigation";
import { selectCompanyAction } from "./actions";

export default async function SelectCompanyPage() {
  const ctx = await getAuth();
  if (!ctx) redirect("/login");
  const companies = await getUserCompanies();
  if (companies.length === 0) {
    return (
      <main style={{ maxWidth: 520, margin: "40px auto", padding: 24 }}>
        <h1>Selecionar empresa</h1>
        <p>Este usuario nao possui vinculo ativo com nenhuma empresa.</p>
      </main>
    );
  }
  if (companies.length === 1 && !ctx.companyId) {
    const c = companies[0]!;
    // Nao forca redirecionamento automatico sem acao explicita para evitar
    // surpresas; o usuario confirma a empresa escolhida.
    void c;
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 24 }}>
      <h1>Selecionar empresa</h1>
      <form action={selectCompanyAction}>
        <ul>
          {companies.map((c) => (
            <li key={c.companyId}>
              <label>
                <input type="radio" name="companyId" value={c.companyId} required />
                {c.name} ({c.role})
              </label>
            </li>
          ))}
        </ul>
        <button type="submit">Continuar</button>
      </form>
    </main>
  );
}
