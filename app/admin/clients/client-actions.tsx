'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClientActionsProps {
  clientId: string;
  currentStatus: 'ACTIVE' | 'PAUSED';
  isDropdownItem?: boolean;
}

export function ClientActions({ clientId, currentStatus, isDropdownItem = false }: ClientActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    setLoading(true);
    const action = currentStatus === 'ACTIVE' ? 'pause' : 'unpause';

    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to toggle client status:', error);
    } finally {
      setLoading(false);
    }
  }

  if (isDropdownItem) {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-zinc-800 transition-colors ${
          currentStatus === 'ACTIVE' ? 'text-red-400' : 'text-green-400'
        } disabled:opacity-50`}
      >
        {loading ? '...' : currentStatus === 'ACTIVE' ? 'Pause Client' : 'Unpause Client'}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
        currentStatus === 'ACTIVE'
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
      } disabled:opacity-50`}
    >
      {loading ? '...' : currentStatus === 'ACTIVE' ? 'Pause' : 'Unpause'}
    </button>
  );
}




