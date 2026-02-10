'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import type { LeadPropertyDefinition, LeadPropertyType } from '@/app/_lib/types';
import { FieldCompatibilityCheck } from './field-compatibility';

// =============================================================================
// TYPES
// =============================================================================

interface PropertySource {
  adapter: string;
  adapterName: string;
  trigger: string;
  triggerLabel: string;
}

type PropertySourceMap = Record<string, PropertySource[]>;

interface CoverageData {
  totalLeads: number;
  coverage: Record<string, number>;
}

const PROPERTY_TYPES: { value: LeadPropertyType; label: string; color: string }[] = [
  { value: 'string', label: 'Text', color: 'bg-zinc-500/20 text-zinc-300' },
  { value: 'email', label: 'Email', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'number', label: 'Number', color: 'bg-purple-500/20 text-purple-300' },
  { value: 'boolean', label: 'Boolean', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'url', label: 'URL', color: 'bg-cyan-500/20 text-cyan-300' },
];

function getTypeStyle(type: LeadPropertyType) {
  return PROPERTY_TYPES.find(t => t.value === type) ?? PROPERTY_TYPES[0];
}

// =============================================================================
// COMPONENT
// =============================================================================

interface LeadPropertiesEditorProps {
  workspaceId: string;
  leadPropertySchema?: LeadPropertyDefinition[] | null;
}

export function LeadPropertiesEditor({
  workspaceId,
  leadPropertySchema: initialSchema,
}: LeadPropertiesEditorProps) {
  // Local editable state
  const [properties, setProperties] = useState<LeadPropertyDefinition[]>(initialSchema ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enrichment data
  const [sources, setSources] = useState<PropertySourceMap>({});
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Add property form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<LeadPropertyType>('string');
  const [newRequired, setNewRequired] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // "Add from trigger" section
  const [showTriggerAdd, setShowTriggerAdd] = useState(false);
  const [triggerAdapter, setTriggerAdapter] = useState('');
  const [triggerOperation, setTriggerOperation] = useState('');
  const [availableTriggers, setAvailableTriggers] = useState<Array<{
    adapterId: string;
    adapterName: string;
    triggers: Array<{ name: string; label: string }>;
  }>>([]);

  // Track changes
  const hasChanges = JSON.stringify(properties) !== JSON.stringify(initialSchema ?? []);

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  const fetchMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [sourcesRes, coverageRes] = await Promise.all([
        fetch(`/api/v1/workspaces/${workspaceId}/property-sources`),
        fetch(`/api/v1/workspaces/${workspaceId}/property-coverage`),
      ]);
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources ?? {});
      }
      if (coverageRes.ok) {
        const data = await coverageRes.json();
        setCoverage(data);
      }
    } catch {
      // Non-critical — just means sources/coverage won't show
    } finally {
      setLoadingMeta(false);
    }
  }, [workspaceId]);

  // Load triggers for "add from trigger" feature
  const fetchTriggers = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workflow-registry?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableTriggers(data.data?.triggers ?? []);
      }
    } catch {
      // Non-critical
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMeta();
    fetchTriggers();
  }, [fetchMeta, fetchTriggers]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleUpdateLabel = (key: string, label: string) => {
    setProperties(prev => prev.map(p => p.key === key ? { ...p, label } : p));
  };

  const handleUpdateType = (key: string, type: LeadPropertyType) => {
    setProperties(prev => prev.map(p => p.key === key ? { ...p, type } : p));
  };

  const handleToggleRequired = (key: string) => {
    setProperties(prev => prev.map(p => p.key === key ? { ...p, required: !p.required } : p));
  };

  const handleRemove = (key: string) => {
    setProperties(prev => prev.filter(p => p.key !== key));
  };

  const handleAdd = () => {
    setAddError(null);
    const trimmedKey = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (!trimmedKey) {
      setAddError('Key is required');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(trimmedKey)) {
      setAddError('Key must start with a letter and contain only lowercase letters, numbers, underscores');
      return;
    }
    if (properties.some(p => p.key === trimmedKey)) {
      setAddError(`Key "${trimmedKey}" already exists`);
      return;
    }
    if (properties.length >= 25) {
      setAddError('Maximum 25 properties allowed');
      return;
    }

    setProperties(prev => [...prev, {
      key: trimmedKey,
      label: newLabel.trim() || trimmedKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      type: newType,
      required: newRequired,
    }]);

    setNewKey('');
    setNewLabel('');
    setNewType('string');
    setNewRequired(false);
    setShowAddForm(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadPropertySchema: properties.length > 0 ? properties : null }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Refresh coverage data
      fetchMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePropertiesAddedFromTrigger = () => {
    // Re-fetch workspace to get updated schema
    fetch(`/api/v1/workspaces/${workspaceId}`)
      .then(r => r.json())
      .then(data => {
        const schema = data.leadPropertySchema ?? [];
        setProperties(schema);
        fetchMeta();
      })
      .catch(() => {});
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
      <h3 className="text-lg font-medium text-white mb-1">Lead Properties</h3>
      <p className="text-sm text-zinc-400 mb-4">
        Custom fields captured on leads. These appear as columns in the Leads tab and can be auto-populated by integration triggers.
      </p>

      {/* Property List */}
      <div className="space-y-2 mb-4">
        {properties.length === 0 ? (
          <div className="p-6 bg-zinc-950 border border-dashed border-zinc-700 rounded-lg text-center">
            <p className="text-sm text-zinc-500 italic">No custom properties defined.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Add properties manually or import from an integration trigger.
            </p>
          </div>
        ) : (
          properties.map((prop) => {
            const typeStyle = getTypeStyle(prop.type);
            const propSources = sources[prop.key] ?? [];
            const propCoverage = coverage ? coverage.coverage[prop.key] ?? 0 : null;
            const coveragePct = coverage && coverage.totalLeads > 0
              ? Math.round((propCoverage ?? 0) / coverage.totalLeads * 100)
              : null;

            return (
              <div
                key={prop.key}
                className="flex items-start gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg group"
              >
                {/* Type badge */}
                <span className={`mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${typeStyle.color}`}>
                  {prop.type}
                </span>

                {/* Main content */}
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Label (editable) + key */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={prop.label}
                      onChange={(e) => handleUpdateLabel(prop.key, e.target.value)}
                      className="bg-transparent text-sm font-medium text-white outline-none border-b border-transparent focus:border-zinc-600 transition-colors min-w-0 flex-1"
                    />
                    <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded shrink-0">
                      {prop.key}
                    </span>
                  </div>

                  {/* Sources + Coverage row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Sources */}
                    {propSources.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {propSources.map((s, i) => (
                          <span
                            key={`${s.adapter}-${s.trigger}-${i}`}
                            className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded"
                            title={`${s.adapterName} / ${s.triggerLabel}`}
                          >
                            {s.adapterName} / {s.trigger}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-600 italic">No trigger sources</span>
                    )}

                    {/* Coverage */}
                    {coveragePct !== null && coverage && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 bg-zinc-800 rounded-full h-1">
                          <div
                            className={`h-1 rounded-full ${coveragePct > 50 ? 'bg-green-500' : coveragePct > 0 ? 'bg-amber-500' : 'bg-zinc-700'}`}
                            style={{ width: `${Math.max(coveragePct, 2)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {propCoverage}/{coverage.totalLeads}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Type selector */}
                  <select
                    value={prop.type}
                    onChange={(e) => handleUpdateType(prop.key, e.target.value as LeadPropertyType)}
                    className="text-[10px] bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-zinc-400 outline-none"
                  >
                    {PROPERTY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>

                  {/* Required toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleRequired(prop.key)}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                      prop.required
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-zinc-800 text-zinc-600 hover:text-zinc-400'
                    }`}
                    title={prop.required ? 'Required (click to make optional)' : 'Optional (click to make required)'}
                  >
                    {prop.required ? 'req' : 'opt'}
                  </button>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => handleRemove(prop.key)}
                    className="p-1 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove property"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Property Section */}
      <div className="space-y-3 mb-4">
        {/* Manual Add Form */}
        {showAddForm ? (
          <div className="p-4 border border-dashed border-zinc-700 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Key</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="e.g., phone_number"
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Phone Number"
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as LeadPropertyType)}
                  className="px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white outline-none"
                >
                  {PROPERTY_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setNewRequired(!newRequired)}
                  className={`text-xs px-2 py-1 rounded ${newRequired ? 'bg-red-500/20 text-red-300' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {newRequired ? 'Required' : 'Optional'}
                </button>
              </div>
            </div>
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                className="px-3 py-1.5 text-xs bg-amber-500 text-black rounded hover:bg-amber-600 font-medium"
              >
                Add Property
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddError(null); }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-zinc-700 text-zinc-400 rounded hover:border-zinc-600 hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Property
            </button>
            <button
              type="button"
              onClick={() => setShowTriggerAdd(!showTriggerAdd)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-zinc-700 text-zinc-400 rounded hover:border-zinc-600 hover:text-white transition-colors"
            >
              {showTriggerAdd ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Add from Trigger
            </button>
          </div>
        )}

        {/* Add from Trigger */}
        {showTriggerAdd && !showAddForm && (
          <div className="p-4 border border-dashed border-zinc-700 rounded-lg space-y-3">
            <p className="text-xs text-zinc-400">
              Select an integration trigger to see which fields it provides and add missing ones.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Integration</label>
                <select
                  value={triggerAdapter}
                  onChange={(e) => { setTriggerAdapter(e.target.value); setTriggerOperation(''); }}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white outline-none"
                >
                  <option value="">Select...</option>
                  {availableTriggers.map(t => (
                    <option key={t.adapterId} value={t.adapterId}>{t.adapterName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Trigger</label>
                <select
                  value={triggerOperation}
                  onChange={(e) => setTriggerOperation(e.target.value)}
                  disabled={!triggerAdapter}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white outline-none disabled:opacity-50"
                >
                  <option value="">Select...</option>
                  {(availableTriggers.find(t => t.adapterId === triggerAdapter)?.triggers ?? []).map(t => (
                    <option key={t.name} value={t.name}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {triggerAdapter && triggerOperation && (
              <FieldCompatibilityCheck
                workspaceId={workspaceId}
                adapter={triggerAdapter}
                operation={triggerOperation}
                onPropertiesAdded={handlePropertiesAddedFromTrigger}
              />
            )}
          </div>
        )}
      </div>

      {/* Save / Status */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-6 py-2 rounded font-medium transition-colors ${
            hasChanges && !saving
              ? 'bg-amber-500 hover:bg-amber-600 text-black'
              : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Properties'}
        </button>

        {hasChanges && !saving && (
          <span className="text-xs text-zinc-500">Unsaved changes</span>
        )}

        {loadingMeta && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading field data...
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {saved && <p className="mt-3 text-sm text-green-400">Properties saved successfully.</p>}
    </div>
  );
}
