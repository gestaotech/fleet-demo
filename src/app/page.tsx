import Link from "next/link";
import Image from "next/image";
import { Truck, Wrench, Package, ClipboardList, BarChart2, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const modules = [
    {
      title: "Frota",
      description: "Controle dos veículos e situação operacional.",
      icon: Truck,
    },
    {
      title: "Manutenção",
      description: "Acompanhamento das ordens de serviço e serviços realizados.",
      icon: Wrench,
    },
    {
      title: "Almoxarifado",
      description: "Controle de peças e materiais utilizados na manutenção.",
      icon: Package,
    },
    {
      title: "Estoque",
      description: "Acompanhamento das quantidades disponíveis e níveis mínimos.",
      icon: Package,
    },
    {
      title: "Solicitações",
      description: "Controle das solicitações de peças feitas pela manutenção.",
      icon: ClipboardList,
    },
    {
      title: "Relatórios",
      description: "Acompanhamento das informações operacionais.",
      icon: BarChart2,
    },
  ];

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Hero with logo as background */}
      <section className="relative flex-1 flex items-center justify-center px-6 py-20 overflow-hidden">
        {/* Logo background */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-10">
          <Image
            src="/logo.jpeg"
            alt=""
            width={400}
            height={200}
            className="object-contain"
            priority
          />
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
              Gestão de Frota
            </p>
            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto">
              Controle sua frota, manutenção, estoque e peças em um único sistema.
            </p>
          </div>

          <Link
            href="/acesso"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand-primary text-white text-lg font-semibold hover:bg-brand-primary-hover transition-colors shadow-sm"
          >
            Acessar sistema
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Modules section */}
      <section className="py-16 px-6 bg-surface-muted">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center mb-12">
            Módulos do Sistema
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <article
                  key={mod.title}
                  className="bg-surface p-6 rounded-xl border border-border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-brand-primary-light text-brand-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">{mod.title}</h3>
                  </div>
                  <p className="text-text-secondary text-sm">{mod.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 text-center text-sm text-text-secondary">
        Tarcísio Araújo Transporte &copy; 2026 — Sistema de Gestão de Frota, Manutenção e Almoxarifado.
      </footer>
    </main>
  );
}