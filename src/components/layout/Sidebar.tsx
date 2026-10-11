"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import Image from "next/image";
import { useRole } from "@/context/RoleContext";
import { navigationForRole, type NavIcon } from "@/lib/permissions";
import {
  LayoutDashboard,
  Truck,
  Wrench,
  Package,
  ClipboardList,
  ArrowUpDown,
  BarChart2,
} from "lucide-react";

const NAV_ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  truck: Truck,
  wrench: Wrench,
  package: Package,
  clipboard: ClipboardList,
  movement: ArrowUpDown,
  chart: BarChart2,
};

function NavLink({ href, title, icon: Icon, isActive }: { href: string; title: string; icon: React.ComponentType<{ className?: string }>; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-[var(--brand-primary-light)] text-[var(--brand-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className={cn("h-4 w-4", isActive && "text-[var(--brand-primary)]")} />
      <span>{title}</span>
    </Link>
  );
}

function Group({ label, items, pathname }: { label: string; items: { title: string; href: string; icon: NavIcon }[]; pathname: string }) {
  return (
    <div className="space-y-1">
      <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          title={item.title}
          icon={NAV_ICONS[item.icon]}
          isActive={pathname === item.href}
        />
      ))}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole } = useRole();

  const groups = navigationForRole(currentRole);

  return (
    <>
      {/* Mobile trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-4">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="px-4 space-y-4">
            {groups.map((g) => (
              <Group key={g.label} {...g} pathname={pathname} />
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 flex-col border-r bg-card h-screen fixed top-0 left-0 z-40">
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="flex items-center gap-2 px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <Image src="/logo.jpeg" alt="Logo" width={120} height={40} className="h-8 w-auto object-contain" />
              <span className="text-xl font-bold text-[var(--brand-primary)]">Tarcísio Araújo Transporte</span>
              <span className="text-xs px-2 py-0.5 bg-[var(--brand-primary-light)] text-[var(--brand-primary)] rounded-full">DEMO</span>
            </div>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
            {groups.map((g) => (
              <Group key={g.label} {...g} pathname={pathname} />
            ))}
          </nav>

          <div className="p-4 border-t text-center text-xs text-muted-foreground">
            Sistema Demonstrativo
          </div>
        </div>
      </aside>
    </>
  );
}