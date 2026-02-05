'use client';

import { useState } from 'react';
import { 
  Layers, 
  FileText, 
  Building2, 
  Users, 
  Settings,
  BookOpen,
  Rocket,
  Menu,
  X,
} from 'lucide-react';
import { OrgSwitcher } from './OrgSwitcher';
import { NavSection } from './NavSection';
import { NavItem } from './NavItem';
import { UserMenu } from './UserMenu';
import { WorkspaceNav } from './WorkspaceNav';

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

interface SidebarProps {
  organizations: Organization[];
  currentOrg: Organization | null;
  user: User | null;
}

export function Sidebar({ organizations, currentOrg, user }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Org Switcher */}
      <div className="p-2 border-b border-zinc-800">
        <OrgSwitcher 
          organizations={organizations} 
          currentOrg={currentOrg}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Main Navigation */}
        <NavSection>
          <NavItem href="/workspaces" icon={Layers} label="Dashboard" />
          <NavItem href="/templates" icon={FileText} label="Templates" />
        </NavSection>

        {/* Workspace Context Navigation - shows when viewing a workspace */}
        <WorkspaceNav />

        {/* Settings */}
        <NavSection title="Settings">
          <NavItem href="/settings/organization" icon={Building2} label="Organization" />
          <NavItem href="/settings/members" icon={Users} label="Members" />
          <NavItem href="/settings" icon={Settings} label="Account" exact />
        </NavSection>

        {/* Resources */}
        <NavSection title="Resources">
          <NavItem href="/docs" icon={BookOpen} label="Documentation" />
          <NavItem href="/onboarding" icon={Rocket} label="Onboarding" />
        </NavSection>
      </nav>

      {/* User Menu */}
      <div className="p-2 border-t border-zinc-800">
        <UserMenu user={user} />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800
          transform transition-transform duration-200 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-1 rounded text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-zinc-950 border-r border-zinc-800">
        {sidebarContent}
      </aside>
    </>
  );
}
