'use client';

import { useEffect } from 'react';
import { useDashboardHeader } from './DashboardHeaderContext';

interface SetDashboardHeaderProps {
  /** Workspace (or page) name shown in the mobile header bar */
  name: string;
  /** Optional slug/tag shown next to the name */
  slug?: string;
}

/** Sets the dashboard mobile header slot to show name + slug. Clears on unmount. */
export function SetDashboardHeader({ name, slug }: SetDashboardHeaderProps) {
  const { setHeaderContent } = useDashboardHeader();

  useEffect(() => {
    setHeaderContent(
      <>
        <h1 className="text-lg font-bold tracking-tight text-white truncate">
          {name}
        </h1>
        {slug != null && (
          <span className="text-zinc-500 font-mono text-xs bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-800/50 shrink-0">
            {slug}
          </span>
        )}
      </>
    );
    return () => setHeaderContent(null);
  }, [name, slug, setHeaderContent]);

  return null;
}
