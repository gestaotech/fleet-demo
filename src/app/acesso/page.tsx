"use client";

import Link from "next/link";
import Image from "next/image";
import { Wrench, Package, LayoutDashboard, User, ArrowRight } from "lucide-react";
import { useRole } from "@/context/RoleContext";

const profiles = [
  {
    key: "MANUTENCAO" as const,
    title: "Manutenção",
    description: "Controle de veículos, ordens de serviço e solicitações de peças.",
    icon: Wrench,
    href: "/manutencao",
  },
  {
    key: "ALMOXARIFADO" as const,
    title: "Almoxarifado",
    description: "Controle de peças, estoque, solicitações e movimentações.",
    icon: Package,
    href: "/almoxarifado",
  },
  {
    key: "GESTOR" as const,
    title: "Gestor",
    description: "Acompanhe a operação, indicadores, manutenção e estoque.",
    icon: LayoutDashboard,
    href: "/gestor",
  },
  {
    key: "ACESSO" as const,
    title: "Acesso",
    description: "Acesso inicial ao sistema e seleção do ambiente operacional.",
    icon: User,
    href: "/acesso",
  },
];

export default function AcessoPage() {
  const { setRole } = useRole();

  const handleSelect = (role: typeof profiles[0]["key"]) => {
    setRole(role);
    // navigation will happen via Link
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <section className="relative flex-1 flex items-center justify-center px-6 py-20 overflow-hidden">
        <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-10">
          <Image src="/logo.jpeg" alt="" width={400} height={200} className="object-contain" priority />
        </div>

        <div className="max-w-4xl w-full text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary-light text-brand-primary text-sm font-medium">
            DEMONSTRAÇÃO
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary tracking-tight">
              Tarcísio Araújo Transporte
            </h1>
            <p className="text-xl md:text-2xl text-brand-primary font-semibold">
              Acesso ao sistema
            </p>
            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto">
              Selecione o ambiente que deseja acessar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            {profiles.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.key}
                  href={p.href}
                  onClick={() => handleSelect(p.key)}
                  className="bg-surface p-6 rounded-xl border border-border hover:shadow-lg hover:border-brand-primary transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 rounded-lg bg-brand-primary-light text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">{p.title}</h3>
                  </div>
                  <p className="text-text-secondary text-sm mb-4">{p.description}</p>
                  <div className="inline-flex items-center gap-1 text-brand-primary font-medium text-sm group-hover:gap-2 transition-all">
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 px-6 text-center text-sm text-text-secondary">
        Tarcísio Araújo Transporte &copy; 2026 — Sistema de Gestão de Frota, Manutenção e Almoxarifado.
      </footer>
    </main>
  );
}