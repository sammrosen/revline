'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Plus, Loader2, RefreshCw } from 'lucide-react';

/**
 * Compatibility result from the API — mirrors server-side CompatibilityResult
 */
interface CompatibilityResult {
  matched: { key: string; label: string; type: string }[];
  available: { key: string; suggestion: { key: string; label: string; type: string; required: boolean } }[];
  totalPayloadFields: number;
  totalMatched: number;
}

interface FieldCompatibilityCheckProps {
  /** Workspace ID for API calls */
  workspaceId: string;
  /** Adapter ID e.g. "abc_ignite" */
  adapter: string;
  /** Trigger operation e.g. "new_member" */
  operation: string;
  /** Callback when properties are added (parent should refresh) */
  onPropertiesAdded?: () => void;
}

/**
 * FieldCompatibilityCheck
 * 
 * Reusable, integration-agnostic component that compares a trigger's payload
 * schema against the workspace's leadPropertySchema.
 * Shows matched/available fields and lets users add missing ones with one click.
 */
export function FieldCompatibilityCheck({
  workspaceId,
  adapter,
  operation,
  onPropertiesAdded,
}: FieldCompatibilityCheckProps) {
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const [addingAll, setAddingAll] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchCompatibility = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/property-compatibility?adapter=${encodeURIComponent(adapter)}&operation=${encodeURIComponent(operation)}`
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to check compatibility');
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, adapter, operation]);

  useEffect(() => {
    fetchCompatibility();
  }, [fetchCompatibility]);

  /** Add one or more properties to the workspace schema */
  const addProperties = async (keys: string[]) => {
    if (!result) return;

    const isAll = keys.length > 1;
    if (isAll) setAddingAll(true);
    setAddingKeys(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.add(k));
      return next;
    });

    try {
      // Get current schema
      const wsRes = await fetch(`/api/v1/workspaces/${workspaceId}`);
      if (!wsRes.ok) throw new Error('Failed to load workspace');
      const ws = await wsRes.json();
      const currentSchema = ws.leadPropertySchema ?? [];

      // Build new schema with suggestions appended
      const existingKeys = new Set(currentSchema.map((d: { key: string }) => d.key));
      const toAdd = result.available
        .filter(a => keys.includes(a.key) && !existingKeys.has(a.key))
        .map(a => a.suggestion);

      if (toAdd.length === 0) {
        await fetchCompatibility();
        return;
      }

      const newSchema = [...currentSchema, ...toAdd];

      const patchRes = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadPropertySchema: newSchema }),
      });

      if (!patchRes.ok) {
        const data = await patchRes.json();
        setError(data.error || 'Failed to add properties');
        return;
      }

      await fetchCompatibility();
      onPropertiesAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add properties');
    } finally {
      setAddingKeys(new Set());
      setAddingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-zinc-900/50 rounded border border-zinc-800/50">
        <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
        <span className="text-xs text-zinc-500">Checking field compatibility...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/5 rounded border border-red-500/20">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-xs text-red-400">{error}</span>
        <button onClick={fetchCompatibility} className="ml-auto text-xs text-zinc-400 hover:text-white">
          Retry
        </button>
      </div>
    );
  }

  if (!result || result.totalPayloadFields === 0) return null;

  const allMatched = result.available.length === 0;
  const percentage = Math.round((result.totalMatched / result.totalPayloadFields) * 100);

  return (
    <div className="rounded border border-zinc-800/50 overflow-hidden">
      {/* Summary header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors text-left"
      >
        {allMatched ? (
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-300">
              {result.totalMatched} of {result.totalPayloadFields} fields mapped
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              allMatched ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {percentage}%
            </span>
          </div>
          <div className="mt-1.5 w-full bg-zinc-800 rounded-full h-1">
            <div
              className={`h-1 rounded-full transition-all ${allMatched ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <RefreshCw
            className="w-3 h-3 text-zinc-600 hover:text-zinc-400"
            onClick={(e) => { e.stopPropagation(); fetchCompatibility(); }}
          />
          <svg
            className={`w-3 h-3 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-800/50 p-3 space-y-3">
          {result.matched.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Matched</p>
              <div className="flex flex-wrap gap-1.5">
                {result.matched.map(f => (
                  <span key={f.key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[11px] text-green-300">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="font-mono">{f.key}</span>
                    <span className="text-green-500/60">{f.type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.available.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Available to Add</p>
                {result.available.length > 1 && (
                  <button
                    type="button"
                    onClick={() => addProperties(result.available.map(a => a.key))}
                    disabled={addingAll}
                    className="text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-50 flex items-center gap-1"
                  >
                    {addingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add All ({result.available.length})
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.available.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => addProperties([f.key])}
                    disabled={addingKeys.has(f.key) || addingAll}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                  >
                    {addingKeys.has(f.key) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    <span className="font-mono">{f.key}</span>
                    <span className="text-amber-500/60">{f.suggestion.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {allMatched && (
            <p className="text-xs text-green-400/70">All payload fields are mapped to workspace properties.</p>
          )}
        </div>
      )}
    </div>
  );
}
