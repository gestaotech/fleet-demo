"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Role = "ACESSO" | "MANUTENCAO" | "ALMOXARIFADO" | "GESTOR" | null;

interface RoleContextType {
  currentRole: Role;
  setRole: (role: Role) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<Role>(null);

  const setRole = (role: Role) => setCurrentRole(role);
  const clearRole = () => setCurrentRole(null);

  return (
    <RoleContext.Provider value={{ currentRole, setRole, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}