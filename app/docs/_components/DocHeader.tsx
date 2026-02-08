'use client';

import { Menu } from 'lucide-react';

interface DocHeaderProps {
  onMenuOpen: () => void;
}

export function DocHeader({ onMenuOpen }: DocHeaderProps) {
  return (
    <header className="lg:hidden flex items-center h-14 gap-3 px-4 border-b border-zinc-800 shrink-0 bg-zinc-950">
      <button
        type="button"
        onClick={onMenuOpen}
        className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-lg font-bold text-white truncate">RevLine Docs</h1>
    </header>
  );
}
