'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SidebarContextValue {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  closeMobileSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setIsMobileOpen(false), []);

  return (
    <SidebarContext.Provider
      value={{ isMobileOpen, setIsMobileOpen, closeMobileSidebar }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    return {
      isMobileOpen: false,
      setIsMobileOpen: () => {},
      closeMobileSidebar: () => {},
    };
  }
  return ctx;
}
