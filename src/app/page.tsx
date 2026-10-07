import Link from "next/link";
import { Truck, Wrench, Package, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-3xl w-full text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-soft text-primary text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            DEMONSTRAÇÃO
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary tracking-tight">
              Fleet Management
            </h1>
            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto">
              Sistema integrado de gestão de frota, manutenção e almoxarifado.
              Controle veículos, ordens de serviço, peças e estoque em uma única plataforma.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground text-lg font-semibold hover:bg-primary-light transition-colors shadow-sm"
          >
            Acessar sistema
            <ArrowRight className="h-5 w-5" />
          </Link>

          <div className="grid grid-cols-3 gap-6 text-sm text-text-secondary">
            <div className="flex flex-col items-center gap-1">
              <Truck className="h-6 w-6 text-primary" />
              <span>Frota</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Wrench className="h-6 w-6 text-primary" />
              <span>Manutenção</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Package className="h-6 w-6 text-primary" />
              <span>Almoxarifado</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 text-center text-sm text-text-secondary">
        Fleet Management &copy; 2026 — Sistema demonstrativo para apresentação comercial.
      </footer>
    </main>
  );
}