'use client';

import { useState, useRef, useEffect } from 'react';
import { HealthCheckButton } from './health-check-button';
import { TestSuiteButton } from './test-suite-modal';
import { TestNotificationButton } from './test-notification-button';
import { WorkspaceDangerZoneButton } from './workspace-danger-zone-button';

interface WorkspaceActionsDropdownProps {
  workspaceId: string;
  workspaceName: string;
  currentStatus: 'ACTIVE' | 'PAUSED';
}

export function WorkspaceActionsDropdown({
  workspaceId,
  workspaceName,
  currentStatus,
}: WorkspaceActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-sm font-medium transition-all text-white shadow-sm active:scale-95"
      >
        Actions
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-[60] overflow-hidden">
          <div className="p-2 space-y-1">
            <HealthCheckButton workspaceId={workspaceId} isDropdownItem />
            <TestSuiteButton workspaceId={workspaceId} isDropdownItem />
            <TestNotificationButton workspaceId={workspaceId} isDropdownItem />
            <div className="h-px bg-zinc-800 my-1" />
            <WorkspaceDangerZoneButton 
              workspaceId={workspaceId} 
              workspaceName={workspaceName}
              currentStatus={currentStatus}
              isDropdownItem 
            />
          </div>
        </div>
      )}
    </div>
  );
}
