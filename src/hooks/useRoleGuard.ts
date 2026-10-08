"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";

type AllowedRoles = ("MANUTENCAO" | "ALMOXARIFADO" | "GESTOR" | "ACESSO")[];

export function useRoleGuard(allowed: AllowedRoles, redirectTo = "/acesso") {
  const { currentRole } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!currentRole) {
      router.replace(redirectTo);
      return;
    }
    if (!allowed.includes(currentRole)) {
      const defaultPath: Record<string, string> = {
        MANUTENCAO: "/manutencao",
        ALMOXARIFADO: "/almoxarifado",
        GESTOR: "/gestor",
        ACESSO: "/acesso",
      };
      router.replace(defaultPath[currentRole] || redirectTo);
    }
  }, [currentRole, allowed, router, redirectTo]);

  return { currentRole, allowed };
}