'use client';

import { useState, useEffect } from 'react';

/**
 * Simplified ABC Ignite config for Add Integration flow.
 * Just collects Club Number - everything else comes from syncing event types.
 */
interface AbcIgniteMeta {
  clubNumber: string;
}

interface AbcIgniteAddConfigProps {
  value: string;
  onChange: (value: string) => void;
}

const DEFAULT_CONFIG: AbcIgniteMeta = {
  clubNumber: '',
};

function parseMeta(value: string): AbcIgniteMeta {
  if (!value.trim()) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(value);
    return {
      clubNumber: parsed.clubNumber || '',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Simplified ABC Ignite config for the Add Integration form.
 * Only collects Club Number - event types, categories, etc. come from sync.
 */
export function AbcIgniteAddConfig({ value, onChange }: AbcIgniteAddConfigProps) {
  const [meta, setMeta] = useState<AbcIgniteMeta>(() => parseMeta(value));

  // Sync to parent
  useEffect(() => {
    onChange(JSON.stringify({ clubNumber: meta.clubNumber }, null, 2));
  }, [meta, onChange]);

  return (
    <div className="space-y-4">
      {/* Club Number */}
      <div>
        <label className="text-xs text-zinc-400 block mb-1.5">
          Club Number <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={meta.clubNumber}
          onChange={(e) => setMeta({ clubNumber: e.target.value })}
          placeholder="Your ABC Ignite club number"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-orange-500/50 outline-none transition-colors"
        />
        <p className="text-xs text-zinc-600 mt-1">
          Find this in your ABC Ignite admin dashboard
        </p>
      </div>

      {/* Info Box - What's next */}
      <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
        <h4 className="text-sm font-medium text-orange-400 mb-2">
          After saving, you&apos;ll be able to:
        </h4>
        <ul className="text-xs text-orange-200/70 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-orange-400">🔄</span>
            <span>Sync event types (appointments & classes) from ABC Ignite</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400">⚡</span>
            <span>Set a default event type for workflows</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400">🔗</span>
            <span>Use synced events in your RevLine workflows</span>
          </li>
        </ul>
        <p className="text-[11px] text-zinc-500 mt-3">
          Click &quot;Configure&quot; on the saved integration to access these features.
        </p>
      </div>

      {/* Validation */}
      {!meta.clubNumber.trim() && (
        <p className="text-xs text-amber-400">
          ⚠️ Club Number is required
        </p>
      )}
    </div>
  );
}
