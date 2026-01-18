'use client';

import { useEffect } from 'react';

interface RevlineAddConfigProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * RevLine add config - just shows info, no config needed to add.
 */
export function RevlineAddConfig({ onChange }: RevlineAddConfigProps) {
  // Set empty default config on mount
  useEffect(() => {
    onChange(JSON.stringify({ forms: {}, settings: {} }, null, 2));
  }, [onChange]);

  return (
    <div className="space-y-4">
      {/* Ready to add */}
      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">✓</span>
          <h4 className="text-sm font-medium text-amber-400">
            Ready to add
          </h4>
        </div>
        <p className="text-xs text-zinc-400 mb-3">
          RevLine is an internal system — no API keys or configuration needed.
        </p>
        <p className="text-xs text-zinc-500">
          After adding, click <span className="text-zinc-300">&quot;Configure&quot;</span> to enable forms and set up trigger operations.
        </p>
      </div>
    </div>
  );
}
