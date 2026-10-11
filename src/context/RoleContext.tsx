"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Role } from "@/lib/permissions";

// Keeps the selected (simulated) profile while navigating the demo.
// This is NOT authentication and, like the in-memory data, it resets on reload.
interface RoleContextType {
  currentRole: Role | null;
  setRole: (role: Role) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const setRole = useCallback((role: Role) => setCurrentRole(role), []);
  const clearRole = useCallback(() => setCurrentRole(null), []);

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
