'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  ChevronDown,
  Workflow,
  Plug,
  Users,
  Activity,
  FlaskConical,
  Settings,
  Loader2,
  Check,
  ChevronsUpDown,
  MoreHorizontal,
} from 'lucide-react';
import { HealthCheckButton } from '@/app/(dashboard)/workspaces/[id]/health-check-button';
import { TestSuiteButton } from '@/app/(dashboard)/workspaces/[id]/test-suite-modal';
import { TestNotificationButton } from '@/app/(dashboard)/workspaces/[id]/test-notification-button';
import { WorkspaceDangerZoneButton } from '@/app/(dashboard)/workspaces/[id]/workspace-danger-zone-button';

interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'PAUSED';
  counts: {
    workflows: number;
    integrations: number;
    leads: number;
    events: number;
  };
}

interface WorkspaceListItem {
  id: string;
  name: string;
  slug: string;
}

type TabId = 'workflows' | 'integrations' | 'leads' | 'events' | 'testing' | 'settings';

const tabs: { id: TabId; label: string; icon: typeof Workflow; countKey?: keyof WorkspaceSummary['counts'] }[] = [
  { id: 'workflows', label: 'Workflows', icon: Workflow, countKey: 'workflows' },
  { id: 'integrations', label: 'Integrations', icon: Plug, countKey: 'integrations' },
  { id: 'leads', label: 'Leads', icon: Users, countKey: 'leads' },
  { id: 'events', label: 'Events', icon: Activity, countKey: 'events' },
  { id: 'testing', label: 'Testing', icon: FlaskConical },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function TabNavItem({ 
  tabId, 
  icon: Icon, 
  label, 
  count,
  activeTab,
  workspaceId,
  isOnWorkspacePage,
}: { 
  tabId: TabId;
  icon: typeof Workflow;
  label: string;
  count?: number;
  activeTab: TabId;
  workspaceId: string;
  isOnWorkspacePage: boolean;
}) {
  const router = useRouter();
  const isActive = isOnWorkspacePage && activeTab === tabId;

  const handleClick = () => {
    if (isOnWorkspacePage) {
      // Already on workspace page, just update hash
      window.location.hash = tabId;
    } else {
      // Navigate to workspace with hash
      router.push(`/workspaces/${workspaceId}#${tabId}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left
        ${isActive 
          ? 'bg-zinc-800 text-white' 
          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
        }
      `}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-zinc-500">{count}</span>
      )}
    </button>
  );
}

function ActionsNavItem({ 
  workspaceId, 
  workspaceName, 
  currentStatus 
}: { 
  workspaceId: string; 
  workspaceName: string; 
  currentStatus: 'ACTIVE' | 'PAUSED';
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left
          ${isOpen 
            ? 'bg-zinc-800 text-white' 
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }
        `}
      >
        <MoreHorizontal className="w-4 h-4 shrink-0" />
        <span className="flex-1">Actions</span>
        <ChevronDown 
          className={`w-3 h-3 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="pl-4 space-y-0.5">
          <HealthCheckButton workspaceId={workspaceId} isDropdownItem />
          <TestSuiteButton workspaceId={workspaceId} isDropdownItem />
          <TestNotificationButton workspaceId={workspaceId} isDropdownItem />
          <WorkspaceDangerZoneButton 
            workspaceId={workspaceId} 
            workspaceName={workspaceName}
            currentStatus={currentStatus}
            isDropdownItem 
          />
        </div>
      )}
    </div>
  );
}

export function WorkspaceNav() {
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<TabId>('workflows');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Workspace list for dropdown
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  
  // Selected workspace data
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isFetching, setIsFetching] = useState(false);
  const isLoadingData = isPending || isFetching;

  // Extract workspace ID from URL if on workspace page
  const workspaceMatch = pathname.match(/^\/workspaces\/([^/]+)$/);
  const urlWorkspaceId = workspaceMatch?.[1];
  const isOnWorkspacePage = !!urlWorkspaceId;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch workspace list on mount and sync URL workspace
  useEffect(() => {
    let cancelled = false;
    
    fetch('/api/v1/workspaces')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (!cancelled) {
          // Handle both array response and { workspaces: [] } response
          const list = Array.isArray(data) ? data : (data.workspaces || []);
          setWorkspaces(list);
          
          // If we have a URL workspace, select it
          if (urlWorkspaceId && list.some((w: WorkspaceListItem) => w.id === urlWorkspaceId)) {
            setSelectedWorkspaceId(urlWorkspaceId);
          } 
          // Otherwise restore from localStorage or use first workspace
          else {
            const stored = localStorage.getItem('selectedWorkspaceId');
            if (stored && list.some((w: WorkspaceListItem) => w.id === stored)) {
              setSelectedWorkspaceId(stored);
            } else if (list.length > 0) {
              setSelectedWorkspaceId(list[0].id);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingList(false);
      });

    return () => { cancelled = true; };
  }, [urlWorkspaceId]);

  // Derive effective workspace ID - URL takes precedence when on workspace page
  const effectiveWorkspaceId = isOnWorkspacePage && urlWorkspaceId 
    ? urlWorkspaceId 
    : selectedWorkspaceId;

  // Fetch workspace data when effective selection changes
  useEffect(() => {
    if (!effectiveWorkspaceId) {
      return;
    }

    // Save to localStorage (only if not from URL to avoid overwriting user preference)
    if (!isOnWorkspacePage) {
      localStorage.setItem('selectedWorkspaceId', effectiveWorkspaceId);
    }

    let cancelled = false;
    
    startTransition(() => {
      setIsFetching(true);
    });

    fetch(`/api/v1/workspaces/${effectiveWorkspaceId}/summary`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled) {
          setWorkspaceData(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => { cancelled = true; };
  }, [effectiveWorkspaceId, isOnWorkspacePage]);

  // Sync with hash on workspace pages
  useEffect(() => {
    if (!isOnWorkspacePage) return;

    const syncHash = () => {
      const hash = window.location.hash.slice(1) as TabId;
      if (hash && tabs.some(t => t.id === hash)) {
        setActiveTab(hash);
      }
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [isOnWorkspacePage]);

  // Handle workspace selection from dropdown
  const handleSelectWorkspace = (workspace: WorkspaceListItem) => {
    setSelectedWorkspaceId(workspace.id);
    setIsDropdownOpen(false);
    // Navigate to the workspace
    router.push(`/workspaces/${workspace.id}#workflows`);
  };

  // Loading state for workspace list
  if (isLoadingList) {
    return (
      <div className="px-3 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading workspaces...</span>
        </div>
      </div>
    );
  }

  // No workspaces available
  if (workspaces.length === 0) {
    return null;
  }

  const displayedWorkspace = workspaces.find(w => w.id === effectiveWorkspaceId);

  return (
    <div className="space-y-1 border-t border-zinc-800 pt-4">
      {/* Section Header */}
      <div className="px-3 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Workspace
        </span>
      </div>

      {/* Workspace Selector Dropdown */}
      <div className="px-2" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
        >
          <span className="flex-1 text-left text-sm font-medium text-white truncate">
            {displayedWorkspace?.name || 'Select workspace'}
          </span>
          <ChevronsUpDown className="w-4 h-4 text-zinc-500 shrink-0" />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute left-2 right-2 mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleSelectWorkspace(workspace)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
              >
                <span className="flex-1 text-sm text-white truncate">{workspace.name}</span>
                {workspace.id === effectiveWorkspaceId && (
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Tabs */}
      {effectiveWorkspaceId && workspaceData && (
        <>
          {/* Expand/Collapse Toggle */}
          <div className="px-3 pt-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              <ChevronDown 
                className={`w-3 h-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`} 
              />
              <span className="font-mono">{workspaceData.slug}</span>
            </button>
          </div>

          {/* Tab Navigation */}
          {isExpanded && (
            <div className="space-y-0.5 px-2 pt-1">
              {tabs.map((tab) => (
                <TabNavItem
                  key={tab.id}
                  tabId={tab.id}
                  icon={tab.icon}
                  label={tab.label}
                  count={tab.countKey ? workspaceData.counts[tab.countKey] : undefined}
                  activeTab={activeTab}
                  workspaceId={effectiveWorkspaceId}
                  isOnWorkspacePage={isOnWorkspacePage && urlWorkspaceId === effectiveWorkspaceId}
                />
              ))}
              {/* Actions Dropdown */}
              <ActionsNavItem
                workspaceId={workspaceData.id}
                workspaceName={workspaceData.name}
                currentStatus={workspaceData.status}
              />
            </div>
          )}
        </>
      )}

      {/* Loading workspace data */}
      {effectiveWorkspaceId && isLoadingData && !workspaceData && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
