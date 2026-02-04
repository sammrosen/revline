'use client';

import { useState } from 'react';

/**
 * Workspace Settings Component
 * 
 * Allows editing workspace-level settings like timezone.
 */

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'UTC', label: 'UTC' },
];

interface WorkspaceSettingsProps {
  workspaceId: string;
  currentTimezone: string;
}

export function WorkspaceSettings({ workspaceId, currentTimezone }: WorkspaceSettingsProps) {
  const [timezone, setTimezone] = useState(currentTimezone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = timezone !== currentTimezone;

  return (
    <div className="space-y-6">
      {/* Timezone Setting */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-1">Timezone</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Used for displaying times in emails and booking confirmations.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white focus:border-amber-500/50 outline-none transition-colors"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-6 py-2 rounded font-medium transition-colors ${
              hasChanges && !saving
                ? 'bg-amber-500 hover:bg-amber-600 text-black'
                : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        {saved && (
          <p className="mt-3 text-sm text-green-400">Settings saved successfully.</p>
        )}
      </div>

      {/* Info */}
      <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">About Timezone Settings</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Affects how times are displayed in booking confirmation emails</li>
          <li>• Used for health check business hours calculations</li>
          <li>• Does not change when events/bookings actually occur</li>
        </ul>
      </div>
    </div>
  );
}
