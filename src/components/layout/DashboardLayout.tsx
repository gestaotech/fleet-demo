"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRole } from "@/context/RoleContext";
import { ROLE_LABELS, defaultPathFor, roleCanAccess, type Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  // Roles allowed to view this page. When omitted the page is open to any
  // authenticated (simulated) profile.
  allow?: readonly Role[];
}

function AccessDenied() {
  const { currentRole } = useRole();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger)]/10 text-[var(--danger)]">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Acesso não permitido</h1>
        <p className="text-text-secondary text-sm">
          O perfil{" "}
          <span className="font-medium text-text-primary">
            {currentRole ? ROLE_LABELS[currentRole] : ""}
          </span>{" "}
          não tem permissão para acessar esta área.
        </p>
        <Button asChild>
          <Link href={defaultPathFor(currentRole)}>Ir para minha área</Link>
        </Button>
      </div>
    </div>
  );
}

export function DashboardLayout({ children, title, breadcrumbs = [], allow }: DashboardLayoutProps) {
  const { currentRole } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!currentRole) router.replace("/acesso");
  }, [currentRole, router]);

  if (!currentRole) return null;

  if (allow && !roleCanAccess(currentRole, allow)) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Header title={title} breadcrumbs={breadcrumbs} />
        <main className="p-4 lg:p-6">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
