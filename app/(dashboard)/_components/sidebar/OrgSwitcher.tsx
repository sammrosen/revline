'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Building2 } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrgSwitcherProps {
  organizations: Organization[];
  currentOrg: Organization | null;
  onOrgChange?: (orgId: string) => void;
}

export function OrgSwitcher({ organizations, currentOrg, onOrgChange }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOrgSelect = (orgId: string) => {
    setIsOpen(false);
    if (onOrgChange && orgId !== currentOrg?.id) {
      onOrgChange(orgId);
    }
  };

  // Single org - no switcher needed
  if (organizations.length <= 1) {
    return (
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {currentOrg?.name || 'No Organization'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-zinc-800/50 rounded-lg transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-white truncate">
            {currentOrg?.name || 'Select Organization'}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleOrgSelect(org.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Building2 className="w-3 h-3 text-white" />
              </div>
              <span className="flex-1 text-sm text-white truncate">{org.name}</span>
              {org.id === currentOrg?.id && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
