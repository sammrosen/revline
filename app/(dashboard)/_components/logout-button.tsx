'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
      });
      
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect on error
      router.push('/login');
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={className || "px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"}
      title="Sign Out"
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}

