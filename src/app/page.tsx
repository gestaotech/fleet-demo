import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/queries";

export default async function HomePage() {
  const ctx = await getAuth();
  if (!ctx) redirect("/login");
  if (!ctx.companyId) redirect("/select-company");
  redirect("/dashboard");
}
