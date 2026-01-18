'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { lockScroll, unlockScroll } from '@/app/_lib/utils/scroll-lock';

interface DeleteClientButtonProps {
  clientId: string;
  clientName: string;
}

export function DeleteClientButton({ 
  clientId, 
  clientName,
  isDropdownItem = false 
}: DeleteClientButtonProps & { isDropdownItem?: boolean }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Lock body scroll when modal is open (mobile UX)
  useEffect(() => {
    if (showConfirm) {
      lockScroll();
    } else {
      unlockScroll();
    }
    return () => unlockScroll();
  }, [showConfirm]);

  async function handleDelete() {
    if (confirmText !== clientName) return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/workspaces/${clientId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
        return;
      }

      // Redirect to clients list after successful deletion
      router.push('/workspaces');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (isDropdownItem) {
    return (
      <>
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-zinc-800 transition-colors text-red-400 font-medium"
        >
          Delete Client
        </button>
        {showConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-0 sm:p-4 z-50" onClick={(e) => e.stopPropagation()}>
            {/* Modal content same as before */}
            <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg p-4 sm:p-6 max-w-md w-full h-full sm:h-auto overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-2 text-red-400">⚠️ Delete Client</h3>
              <p className="text-sm text-zinc-400 mb-4">
                This will <span className="font-bold text-red-400">permanently delete</span>:
              </p>
              <ul className="text-sm text-zinc-300 mb-4 space-y-1 list-disc list-inside">
                <li>Client record</li>
                <li>All integrations (encrypted secrets)</li>
                <li>All leads and customer data</li>
                <li>All event history</li>
              </ul>
              
              <div className="mt-6 p-3 bg-red-950/30 border border-red-900/50 rounded mb-4">
                <p className="text-sm text-red-300 mb-2">
                  Type <span className="font-mono font-bold">{clientName}</span> to confirm:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white mb-3"
                  placeholder={clientName}
                  autoFocus
                />
              </div>

              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={confirmText !== clientName || loading}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {loading ? 'Deleting...' : 'Permanently Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmText('');
                    setError('');
                  }}
                  className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="px-3 py-1 text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-800 rounded transition-colors"
      >
        Delete Client
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg p-4 sm:p-6 max-w-md w-full h-full sm:h-auto overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2 text-red-400">⚠️ Delete Client</h3>
        <p className="text-sm text-zinc-400 mb-4">
          This will <span className="font-bold text-red-400">permanently delete</span>:
        </p>
        <ul className="text-sm text-zinc-300 mb-4 space-y-1 list-disc list-inside">
          <li>Client record</li>
          <li>All integrations (encrypted secrets)</li>
          <li>All leads and customer data</li>
          <li>All event history</li>
        </ul>
        <p className="text-sm text-zinc-300 mb-2 font-bold">
          Webhooks and automations will stop working immediately.
        </p>
        
        <div className="mt-6 p-3 bg-red-950/30 border border-red-900/50 rounded mb-4">
          <p className="text-sm text-red-300 mb-2">
            Type <span className="font-mono font-bold">{clientName}</span> to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white mb-3"
            placeholder={clientName}
            autoFocus
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={confirmText !== clientName || loading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading ? 'Deleting...' : 'Permanently Delete'}
          </button>
          <button
            onClick={() => {
              setShowConfirm(false);
              setConfirmText('');
              setError('');
            }}
            className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

