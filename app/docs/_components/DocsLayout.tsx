'use client';

import { useState } from 'react';
import { DocSidebar } from './DocSidebar';
import { DocHeader } from './DocHeader';
import type { TabId } from './DocTabs';

interface DocsLayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
}

export function DocsLayout({ activeTab, onTabChange, children }: DocsLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <DocSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <DocHeader onMenuOpen={() => setIsMobileOpen(true)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
