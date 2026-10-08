"use client";

import { Toaster } from "sonner";
import { RoleProvider } from "@/context/RoleContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      {children}
      <Toaster position="top-right" />
    </RoleProvider>
  );
}