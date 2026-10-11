// Centralized access control for the demonstration profiles.
// This is a SIMULATION: it does not authenticate users, it only drives the
// role-based experience (navigation and available actions) of the demo.

export type Role = "GESTOR" | "MANUTENCAO" | "ALMOXARIFADO";

export const ROLES: readonly Role[] = ["GESTOR", "MANUTENCAO", "ALMOXARIFADO"];

export const ROLE_LABELS: Record<Role, string> = {
  GESTOR: "Gestor",
  MANUTENCAO: "Manutenção",
  ALMOXARIFADO: "Almoxarifado",
};

// Initial area each profile is redirected to.
export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  GESTOR: "/gestor",
  MANUTENCAO: "/manutencao",
  ALMOXARIFADO: "/almoxarifado",
};

// Actions that mutate the operation. The Gestor profile is read-only.
export type Action =
  | "fleet:manage"
  | "workorder:manage"
  | "request:create"
  | "request:process"
  | "stock:entry"
  | "stock:adjust";

export const ACTION_LABELS: Record<Action, string> = {
  "fleet:manage": "Cadastrar veículos",
  "workorder:manage": "Gerenciar ordens de serviço",
  "request:create": "Solicitar peças",
  "request:process": "Processar/recusar solicitações",
  "stock:entry": "Registrar entrada de estoque",
  "stock:adjust": "Ajustar estoque",
};

const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  GESTOR: [],
  MANUTENCAO: ["fleet:manage", "workorder:manage", "request:create"],
  ALMOXARIFADO: ["request:process", "stock:entry", "stock:adjust"],
};

export function isRole(value: unknown): value is Role {
  return value === "GESTOR" || value === "MANUTENCAO" || value === "ALMOXARIFADO";
}

export function can(role: Role | null | undefined, action: Action): boolean {
  return isRole(role) && ROLE_PERMISSIONS[role].includes(action);
}

export function defaultPathFor(role: Role | null | undefined): string {
  return isRole(role) ? ROLE_DEFAULT_PATH[role] : "/acesso";
}

// Roles allowed to open each functional area (page level).
export const ROUTE_ROLES = {
  dashboard: ["GESTOR", "MANUTENCAO", "ALMOXARIFADO"],
  frota: ["GESTOR", "MANUTENCAO"],
  manutencao: ["GESTOR", "MANUTENCAO"],
  almoxarifado: ["GESTOR", "ALMOXARIFADO"],
  relatorios: ["GESTOR"],
  gestor: ["GESTOR"],
} as const satisfies Record<string, readonly Role[]>;

export function roleCanAccess(
  role: Role | null | undefined,
  allowed: readonly Role[]
): boolean {
  return isRole(role) && allowed.includes(role);
}

// Sidebar navigation per profile. Icon is a string key resolved by the Sidebar.
export type NavIcon =
  | "dashboard"
  | "truck"
  | "wrench"
  | "package"
  | "clipboard"
  | "movement"
  | "chart";

export interface NavItem {
  title: string;
  href: string;
  icon: NavIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ROLE_NAVIGATION: Record<Role, NavGroup[]> = {
  GESTOR: [
    {
      label: "GESTÃO",
      items: [
        { title: "Painel do gestor", href: "/gestor", icon: "dashboard" },
        { title: "Frota", href: "/frota", icon: "truck" },
        { title: "Manutenção", href: "/manutencao", icon: "wrench" },
        { title: "Almoxarifado", href: "/almoxarifado", icon: "package" },
      ],
    },
    {
      label: "ANÁLISES",
      items: [
        { title: "Solicitações", href: "/almoxarifado/solicitacoes", icon: "clipboard" },
        { title: "Movimentações", href: "/almoxarifado/movimentacoes", icon: "movement" },
        { title: "Relatório de manutenção", href: "/relatorios/manutencao", icon: "chart" },
        { title: "Relatório de estoque", href: "/relatorios/estoque", icon: "chart" },
      ],
    },
  ],
  MANUTENCAO: [
    {
      label: "OPERAÇÃO",
      items: [
        { title: "Ordens de serviço", href: "/manutencao", icon: "wrench" },
        { title: "Frota", href: "/frota", icon: "truck" },
        { title: "Minhas solicitações", href: "/manutencao/solicitacoes", icon: "clipboard" },
      ],
    },
  ],
  ALMOXARIFADO: [
    {
      label: "ALMOXARIFADO",
      items: [
        { title: "Estoque", href: "/almoxarifado", icon: "package" },
        { title: "Solicitações", href: "/almoxarifado/solicitacoes", icon: "clipboard" },
        { title: "Movimentações", href: "/almoxarifado/movimentacoes", icon: "movement" },
      ],
    },
  ],
};

export function navigationForRole(role: Role | null | undefined): NavGroup[] {
  return isRole(role) ? ROLE_NAVIGATION[role] : [];
}
