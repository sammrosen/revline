'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Integration {
  id: string;
  integration: string;
  meta: unknown;
}

interface IntegrationActionsProps {
  clientId: string;
  integration: Integration;
}

export function IntegrationActions({ clientId, integration }: IntegrationActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [metaText, setMetaText] = useState(JSON.stringify(integration.meta || {}, null, 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleDelete() {
    if (deleteConfirmText !== 'DELETE') return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
        return;
      }

      router.refresh();
      setShowDeleteConfirm(false);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateMeta() {
    setLoading(true);
    setError('');

    try {
      let parsedMeta = null;
      if (metaText.trim()) {
        try {
          parsedMeta = JSON.parse(metaText);
        } catch {
          setError('Invalid JSON');
          setLoading(false);
          return;
        }
      }

      const res = await fetch(`/api/admin/integrations/${integration.id}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta: parsedMeta }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update');
        return;
      }

      setShowEditMeta(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (showDeleteConfirm) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold mb-2 text-red-400">Delete Integration</h3>
          <p className="text-sm text-zinc-400 mb-4">
            This will permanently delete the <span className="font-mono text-white">{integration.integration}</span> integration. 
            Webhooks and API calls will stop working immediately.
          </p>
          
          <p className="text-sm text-zinc-300 mb-2">Type <span className="font-mono font-bold">DELETE</span> to confirm:</p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono mb-4"
            placeholder="DELETE"
            autoFocus
          />

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleteConfirmText !== 'DELETE' || loading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Deleting...' : 'Delete Integration'}
            </button>
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText('');
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

  if (showEditMeta) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-2xl w-full">
          <h3 className="text-lg font-semibold mb-2">Edit Meta Config</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Update non-sensitive configuration (group IDs, product maps, etc.)
          </p>
          
          <textarea
            value={metaText}
            onChange={(e) => setMetaText(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm mb-4"
            rows={12}
          />

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleUpdateMeta}
              disabled={loading}
              className="px-4 py-2 bg-white text-black rounded hover:bg-zinc-200 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setShowEditMeta(false);
                setMetaText(JSON.stringify(integration.meta || {}, null, 2));
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

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setShowEditMeta(true)}
        className="px-3 py-1 text-xs border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors"
      >
        Edit Meta
      </button>
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="px-3 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}




