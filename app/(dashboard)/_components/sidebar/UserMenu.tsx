'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, ChevronUp } from 'lucide-react';

interface UserMenuProps {
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      // Even on error, redirect to login
      router.push('/login');
    }
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-zinc-800/50 rounded-lg transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
          <span className="text-sm font-medium text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">{displayName}</p>
          <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
        </div>
        <ChevronUp className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => {
              setIsOpen(false);
              router.push('/settings');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
          >
            <Settings className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-white">Account Settings</span>
          </button>
          <div className="border-t border-zinc-800" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-white">Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
