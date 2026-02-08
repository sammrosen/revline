'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export type TabId = 
  | 'overview' 
  | 'platform'
  | 'organizations'
  | 'forms'
  | 'workflows' 
  | 'mailerlite' 
  | 'stripe' 
  | 'calendly' 
  | 'manychat' 
  | 'abc-ignite' 
  | 'resend'
  | 'testing';

export interface DocTabItem {
  id: TabId;
  label: string;
  color?: string;
}

export const DOC_TABS: DocTabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'platform', label: 'Platform', color: 'text-amber-400' },
  { id: 'organizations', label: 'Organizations', color: 'text-emerald-400' },
  { id: 'forms', label: 'Forms & Sites', color: 'text-rose-400' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'mailerlite', label: 'MailerLite', color: 'text-green-400' },
  { id: 'stripe', label: 'Stripe', color: 'text-purple-400' },
  { id: 'calendly', label: 'Calendly', color: 'text-cyan-400' },
  { id: 'manychat', label: 'ManyChat', color: 'text-blue-400' },
  { id: 'abc-ignite', label: 'ABC Ignite', color: 'text-orange-400' },
  { id: 'resend', label: 'Resend', color: 'text-pink-400' },
  { id: 'testing', label: 'Testing' },
];

interface DocTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function DocTabs({ activeTab, onTabChange }: DocTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeColor = DOC_TABS.find((t) => t.id === activeTab)?.color;

  // Scroll active tab into view when it changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeButton = container.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  // Fade indicators for scroll overflow
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  return (
    <>
      {/* Compact: Dropdown (mobile + tablet) */}
      <div className="lg:hidden mb-6">
        <select
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value as TabId)}
          className={`w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-500 ${activeColor || 'text-white'}`}
        >
          {DOC_TABS.map((tab) => (
            <option key={tab.id} value={tab.id} className="text-white">
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* Wide: Horizontal scrollable tabs */}
      <div className="hidden lg:block mb-8 border-b border-zinc-800 relative">
        {/* Left fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
        )}
        {/* Right fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />
        )}
        <div
          ref={scrollRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide"
        >
          {DOC_TABS.map((tab) => (
            <button
              key={tab.id}
              data-active={activeTab === tab.id}
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
