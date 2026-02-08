'use client';

import { Menu } from 'lucide-react';
import { SidebarProvider, useSidebar } from './sidebar/SidebarContext';
import { useDashboardHeader } from './DashboardHeaderContext';
import { SidebarContent } from './sidebar/Sidebar';
import { DashboardHeaderProvider } from './DashboardHeaderContext';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface DashboardShellProps {
  organizations: Organization[];
  currentOrg: Organization | null;
  user: User | null;
  children: React.ReactNode;
}

function MobileHeader() {
  const { setIsMobileOpen } = useSidebar();
  const { headerContent } = useDashboardHeader();
  return (
    <header className="lg:hidden flex items-center h-14 gap-3 px-4 border-b border-zinc-800 shrink-0 bg-zinc-950">
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      {headerContent && (
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {headerContent}
        </div>
      )}
    </header>
  );
}

export function DashboardShell({
  organizations,
  currentOrg,
  user,
  children,
}: DashboardShellProps) {
  return (
    <SidebarProvider>
      <DashboardHeaderProvider>
        <div className="flex h-screen bg-zinc-950 text-zinc-100">
        <SidebarContent
          organizations={organizations}
          currentOrg={currentOrg}
          user={user}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <MobileHeader />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        </div>
      </DashboardHeaderProvider>
    </SidebarProvider>
  );
}
