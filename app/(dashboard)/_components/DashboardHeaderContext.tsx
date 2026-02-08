'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type DashboardHeaderContextValue = {
  headerContent: ReactNode;
  setHeaderContent: (content: ReactNode) => void;
};

const DashboardHeaderContext = createContext<DashboardHeaderContextValue | null>(null);

export function DashboardHeaderProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode>(null);
  return (
    <DashboardHeaderContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </DashboardHeaderContext.Provider>
  );
}

export function useDashboardHeader() {
  const ctx = useContext(DashboardHeaderContext);
  return ctx ?? { headerContent: null, setHeaderContent: () => {} };
}
