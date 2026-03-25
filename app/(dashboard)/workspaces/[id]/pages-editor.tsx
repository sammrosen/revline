'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RevlineConfigEditor } from './revline-config-editor';

interface PagesEditorProps {
  workspaceId: string;
  workspaceSlug: string;
  pagesConfig?: Record<string, unknown> | null;
  agents?: Record<string, string>;
}

export function PagesEditor({ workspaceId, workspaceSlug, pagesConfig, agents }: PagesEditorProps) {
  const router = useRouter();
  const [metaText, setMetaText] = useState(() =>
    JSON.stringify(pagesConfig || {}, null, 2)
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    setSaveStatus('idle');

    try {
      let parsed = null;
      if (metaText.trim()) {
        try {
          parsed = JSON.parse(metaText);
        } catch {
          setError('Invalid JSON');
          setSaving(false);
          return;
        }
      }

      const res = await fetch(`/api/v1/workspaces/${workspaceId}/pages-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagesConfig: parsed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save');
        setSaveStatus('error');
        return;
      }

      setSaveStatus('saved');
      router.refresh();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setError('Failed to save');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [metaText, workspaceId, router]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Pages</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Configure your landing pages, booking forms, and signup pages.</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-400">Saved</span>
          )}
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-white text-black rounded hover:bg-zinc-200 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <RevlineConfigEditor
        value={metaText}
        onChange={setMetaText}
        error={error}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        agents={agents}
      />
    </div>
  );
}
