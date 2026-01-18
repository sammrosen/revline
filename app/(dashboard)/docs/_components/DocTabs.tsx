'use client';

import { useState } from 'react';

export type TabId = 
  | 'overview' 
  | 'workflows' 
  | 'mailerlite' 
  | 'stripe' 
  | 'calendly' 
  | 'manychat' 
  | 'abc-ignite' 
  | 'testing';

interface Tab {
  id: TabId;
  label: string;
  color?: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'mailerlite', label: 'MailerLite', color: 'text-green-400' },
  { id: 'stripe', label: 'Stripe', color: 'text-purple-400' },
  { id: 'calendly', label: 'Calendly', color: 'text-cyan-400' },
  { id: 'manychat', label: 'ManyChat', color: 'text-blue-400' },
  { id: 'abc-ignite', label: 'ABC Ignite', color: 'text-orange-400' },
  { id: 'testing', label: 'Testing' },
];

interface DocTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function DocTabs({ activeTab, onTabChange }: DocTabsProps) {
  return (
    <>
      {/* Mobile: Dropdown */}
      <div className="sm:hidden mb-6">
        <select
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value as TabId)}
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
        >
          {TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: Horizontal tabs */}
      <div className="hidden sm:block mb-8 border-b border-zinc-800">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? `${tab.color || 'text-white'} border-current`
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function useDocTabs(initial: TabId = 'overview') {
  const [activeTab, setActiveTab] = useState<TabId>(initial);
  return { activeTab, setActiveTab };
}
