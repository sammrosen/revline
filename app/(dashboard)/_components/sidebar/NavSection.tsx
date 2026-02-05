'use client';

import { ReactNode } from 'react';

interface NavSectionProps {
  title?: string;
  children: ReactNode;
}

export function NavSection({ title, children }: NavSectionProps) {
  return (
    <div className="space-y-1">
      {title && (
        <div className="px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {title}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
