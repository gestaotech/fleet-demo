export type { Role, ModuleKey, AuditAction, AuditResult } from "@prisma/client";
export { Role as RoleEnum, ModuleKey as ModuleKeyEnum } from "@prisma/client";

import { ModuleKey } from "@prisma/client";

/*
 * Definicao central de permissoes por perfil e modulos.
 *
 * A autorizacao e SEMPRE verificada no servidor (guards + repositorios com
 * companyId da sessao). Ocultar botao nao e autorizacao.
 *
 * Regras:
 *  - OWNER e ADMIN podem gerenciar usuarios e permissoes;
 *  - permissoes explicitas em MembershipPermission somam-se ao perfil;
 *  - nesta fase nao existe negacao explicita: a associacao so pode conceder modulos adicionais;
 *  - verificacao e feita por companyId da sessao, nunca por companyId do cliente.
 */
export const DEFAULT_ROLE_MODULES: Record<import("@prisma/client").Role, ModuleKey[]> = {
  OWNER: [
    ModuleKey.VEHICLES,
    ModuleKey.MAINTENANCE,
    ModuleKey.FUEL,
    ModuleKey.WAREHOUSE,
    ModuleKey.REPORTS,
    ModuleKey.USERS,
    ModuleKey.AUDIT,
  ],
  ADMIN: [
    ModuleKey.VEHICLES,
    ModuleKey.MAINTENANCE,
    ModuleKey.FUEL,
    ModuleKey.WAREHOUSE,
    ModuleKey.REPORTS,
    ModuleKey.USERS,
    ModuleKey.AUDIT,
  ],
  MEMBER: [
    ModuleKey.VEHICLES,
    ModuleKey.MAINTENANCE,
    ModuleKey.FUEL,
    ModuleKey.WAREHOUSE,
    ModuleKey.REPORTS,
  ],
  VIEWER: [ModuleKey.REPORTS],
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  VEHICLES: "Veículos",
  MAINTENANCE: "Manutenção",
  FUEL: "Combustível",
  WAREHOUSE: "Almoxarifado",
  REPORTS: "Relatórios",
  USERS: "Usuários",
  AUDIT: "Auditoria",
};
