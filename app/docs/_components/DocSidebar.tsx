'use client';

import { X } from 'lucide-react';
import { DOC_TABS, type TabId } from './DocTabs';

interface DocSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function DocSidebar({ activeTab, onTabChange, isMobileOpen, onMobileClose }: DocSidebarProps) {
  const handleNavClick = (tabId: TabId) => {
    onTabChange(tabId);
    onMobileClose();
  };

  const navContent = (
    <nav className="flex flex-col p-4 gap-0.5">
      {DOC_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => handleNavClick(tab.id)}
          className={`
            text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${activeTab === tab.id
              ? `${tab.color ?? 'text-white'} bg-zinc-800`
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800
          transform transition-transform duration-200 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-2 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-300">Sections</span>
          <button
            type="button"
            onClick={onMobileClose}
            className="p-1 rounded text-zinc-400 hover:text-white"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-zinc-950 border-r border-zinc-800 shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300">RevLine Docs</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Reference guide</p>
        </div>
        {navContent}
      </aside>
    </>
  );
}
