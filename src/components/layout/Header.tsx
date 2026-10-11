"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, RefreshCw, ShieldCheck } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { ROLE_LABELS, defaultPathFor } from "@/lib/permissions";

function initialsFor(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Header({ title, breadcrumbs = [] }: { title: string; breadcrumbs?: { label: string; href?: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentRole, clearRole } = useRole();

  const roleLabel = currentRole ? ROLE_LABELS[currentRole] : "";
  const homeHref = defaultPathFor(currentRole);

  const switchProfile = () => {
    clearRole();
    router.push("/acesso");
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-[var(--surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/60 border-[var(--border)]">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6 lg:pl-64">
        {/* Breadcrumb */}
        <nav className="flex-1 hidden md:flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={homeHref} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Início</BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((bc) => (
                <React.Fragment key={bc.label}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {bc.href ? (
                      <BreadcrumbLink href={bc.href} className={cn("text-[var(--text-secondary)] hover:text-[var(--text-primary)]", pathname === bc.href && "font-medium text-[var(--text-primary)]")}>
                        {bc.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-[var(--text-primary)] font-medium">{bc.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </nav>

        {/* Page title with active profile badge */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
          {roleLabel && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--brand-primary-light)] text-[var(--brand-primary)]">
              {roleLabel}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-full border border-[var(--border)] text-[var(--text-secondary)]">
            DEMO
          </span>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger)] text-[10px] font-medium text-white">3</span>
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-[var(--brand-primary)] text-white">
                    {initialsFor(roleLabel || "Demo")}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{roleLabel || "Sem perfil"}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Acesso simulado — demonstração</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="border-[var(--border)]" />
              <DropdownMenuItem onClick={switchProfile} className="text-[var(--text-primary)]">
                <RefreshCw className="mr-2 h-4 w-4" /> Trocar ambiente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={switchProfile} className="text-[var(--text-primary)]">
                <ShieldCheck className="mr-2 h-4 w-4" /> Encerrar sessão demo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
