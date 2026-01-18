'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface WorkspaceDangerZoneButtonProps {
  workspaceId: string;
  workspaceName: string;
  currentStatus: 'ACTIVE' | 'PAUSED';
  isDropdownItem?: boolean;
}

export function WorkspaceDangerZoneButton({
  workspaceId,
  workspaceName,
  currentStatus,
  isDropdownItem = false,
}: WorkspaceDangerZoneButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [pauseConfirmText, setPauseConfirmText] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const workspaceSlug = workspaceName.toLowerCase().replace(/\s+/g, '-');
  const expectedPauseText = `pause ${workspaceSlug}`;
  const expectedDeleteText = `delete ${workspaceSlug}`;

  async function handlePause() {
    if (pauseConfirmText !== expectedPauseText) return;

    setLoading(true);
    setError('');

    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      const res = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update status');
        return;
      }

      setPauseConfirmText('');
      setShowModal(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirmText !== expectedDeleteText) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
        return;
      }

      router.push('/workspaces');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const buttonClass = isDropdownItem
    ? 'w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors'
    : 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors';

  return (
    <>
      <button onClick={() => setShowModal(true)} className={buttonClass}>
        {isDropdownItem ? 'Danger Zone' : '⚠️ Danger Zone'}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg p-4 sm:p-6 max-w-lg w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-red-400">Danger Zone - {workspaceName}</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setPauseConfirmText('');
                  setDeleteConfirmText('');
                  setError('');
                }}
                className="text-zinc-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Pause Section */}
            <div className="mb-6 p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-orange-400/80 text-lg">⚠️</span>
                <h4 className="text-sm font-semibold text-orange-400/90">
                  {currentStatus === 'ACTIVE' ? 'Pause Client' : 'Resume Client'}
                </h4>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                {currentStatus === 'ACTIVE'
                  ? 'Temporarily disable all integrations and webhooks.'
                  : 'Re-enable all integrations and webhooks.'}
              </p>
              <p className="text-xs text-zinc-300 mb-2">
                Type <span className="font-mono font-bold">{expectedPauseText}</span> to confirm:
              </p>
              <input
                type="text"
                value={pauseConfirmText}
                onChange={(e) => setPauseConfirmText(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-white text-sm mb-3"
                placeholder={expectedPauseText}
              />
              <button
                onClick={handlePause}
                disabled={pauseConfirmText !== expectedPauseText || loading}
                className="w-full px-4 py-2 bg-orange-600/80 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {loading
                  ? currentStatus === 'ACTIVE'
                    ? 'Pausing...'
                    : 'Resuming...'
                  : currentStatus === 'ACTIVE'
                  ? 'Pause Client'
                  : 'Resume Client'}
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-800 my-6" />

            {/* Delete Section */}
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-400/80 text-lg">🔥</span>
                <h4 className="text-sm font-semibold text-red-400/90">Delete Client</h4>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Permanently delete this client and all associated data (leads, events, integrations).{' '}
                <span className="font-semibold text-red-400">This action cannot be undone.</span>
              </p>
              <p className="text-xs text-zinc-300 mb-2">
                Type <span className="font-mono font-bold">{expectedDeleteText}</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-white text-sm mb-3"
                placeholder={expectedDeleteText}
              />
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== expectedDeleteText || loading}
                className="w-full px-4 py-2 bg-red-600/80 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {loading ? 'Deleting...' : 'Delete Client Forever'}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

