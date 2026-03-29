'use client';

import { useState, useEffect } from 'react';

interface PipedriveMetaConfig {
  fieldMap: Record<string, string>;
  defaultPipelineId: number | null;
  stageMap: Record<string, number>;
  logActivities: boolean;
  webhookSecret: string;
}

interface PipedriveField {
  key: string;
  name: string;
  fieldType: string;
  isCustom: boolean;
}

interface WorkspaceProperty {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

interface PipedriveConfigEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  integrationId?: string;
  workspaceId?: string;
  workspaceSlug?: string;
}

const DEFAULT_CONFIG: PipedriveMetaConfig = {
  fieldMap: {},
  defaultPipelineId: null,
  stageMap: {},
  logActivities: false,
  webhookSecret: '',
};

function parseMeta(value: string): PipedriveMetaConfig {
  if (!value.trim()) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(value);
    return {
      fieldMap: parsed.fieldMap ?? {},
      defaultPipelineId: parsed.defaultPipelineId ?? null,
      stageMap: parsed.stageMap ?? {},
      logActivities: parsed.logActivities ?? false,
      webhookSecret: parsed.webhookSecret ?? '',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

const IGNORED_PD_KEYS = new Set([
  'id', 'owner_id', 'creator_user_id', 'org_id', 'company_id',
  'activities_count', 'done_activities_count', 'undone_activities_count',
  'closed_deals_count', 'open_deals_count', 'lost_deals_count', 'won_deals_count',
  'related_closed_deals_count', 'related_open_deals_count', 'related_lost_deals_count', 'related_won_deals_count',
  'email_messages_count', 'files_count', 'notes_count', 'followers_count',
  'last_activity_date', 'next_activity_date', 'last_activity_id',
  'last_incoming_mail_time', 'last_outgoing_mail_time',
  'update_time', 'add_time', 'delete_time',
  'visible_to', 'picture_id', 'active_flag',
  'cc_email',
]);

interface FieldMappingPanelProps {
  meta: PipedriveMetaConfig;
  setMeta: React.Dispatch<React.SetStateAction<PipedriveMetaConfig>>;
  pipedriveFields: PipedriveField[];
  workspaceProps: WorkspaceProperty[];
  setWorkspaceProps: React.Dispatch<React.SetStateAction<WorkspaceProperty[]>>;
  workspaceId?: string;
  hasSynced: boolean;
  fieldsLoading: boolean;
  fieldsError: string | null;
  integrationId?: string;
  onSync: () => void;
  normalize: (s: string) => string;
  newFieldLeft: string;
  setNewFieldLeft: (v: string) => void;
  newFieldRight: string;
  setNewFieldRight: (v: string) => void;
  onAddFieldMapping: () => void;
  onRemoveFieldMapping: (key: string) => void;
}

function FieldMappingPanel({
  meta, setMeta, pipedriveFields, workspaceProps, setWorkspaceProps, workspaceId, hasSynced,
  fieldsLoading, fieldsError, integrationId, onSync, normalize,
  newFieldLeft, setNewFieldLeft, newFieldRight, setNewFieldRight,
  onAddFieldMapping, onRemoveFieldMapping,
}: FieldMappingPanelProps) {
  const fieldEntries = Object.entries(meta.fieldMap);
  const mappedKeys = new Set(fieldEntries.map(([k]) => k));
  const mappedValues = new Set(fieldEntries.map(([, v]) => v));

  const totalProps = workspaceProps.length;
  const mappedCount = workspaceProps.filter(p => mappedKeys.has(p.key)).length;
  const pct = totalProps > 0 ? Math.round((mappedCount / totalProps) * 100) : 0;

  type Suggestion = { prop: WorkspaceProperty; pdField: PipedriveField };
  const suggestions: Suggestion[] = [];
  const unmapped: WorkspaceProperty[] = [];

  if (hasSynced) {
    for (const prop of workspaceProps) {
      if (mappedKeys.has(prop.key)) continue;
      const exact = pipedriveFields.find(
        f => !mappedValues.has(f.key) && normalize(f.key) === normalize(prop.key),
      );
      const byName = !exact
        ? pipedriveFields.find(
            f => !mappedValues.has(f.key) && normalize(f.name) === normalize(prop.key),
          )
        : undefined;
      const match = exact || byName;
      if (match) {
        suggestions.push({ prop, pdField: match });
      } else {
        unmapped.push(prop);
      }
    }
  }

  function handleAcceptSuggestion(propKey: string, pdKey: string) {
    setMeta(prev => ({
      ...prev,
      fieldMap: { ...prev.fieldMap, [propKey]: pdKey },
    }));
  }

  function handleAcceptAll() {
    setMeta(prev => {
      const added: Record<string, string> = {};
      for (const s of suggestions) {
        if (!prev.fieldMap[s.prop.key]) {
          added[s.prop.key] = s.pdField.key;
        }
      }
      return { ...prev, fieldMap: { ...prev.fieldMap, ...added } };
    });
  }

  function handleMapUnmapped(propKey: string, pdKey: string) {
    if (!pdKey) return;
    setMeta(prev => ({
      ...prev,
      fieldMap: { ...prev.fieldMap, [propKey]: pdKey },
    }));
  }

  const availablePdFields = pipedriveFields.filter(f => !mappedValues.has(f.key));

  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const [addingAll, setAddingAll] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function pdKeyToPropertyKey(f: PipedriveField): string {
    if (f.isCustom || /^[0-9a-f]{10,}$/i.test(f.key)) {
      return normalize(f.name).replace(/^_+|_+$/g, '').replace(/_{2,}/g, '_') || f.key;
    }
    return normalize(f.key);
  }

  const wsKeySet = new Set(workspaceProps.map(p => p.key));
  const importable: PipedriveField[] = [];
  if (hasSynced) {
    for (const f of pipedriveFields) {
      if (IGNORED_PD_KEYS.has(f.key)) continue;
      if (mappedValues.has(f.key)) continue;
      const wouldBeKey = pdKeyToPropertyKey(f);
      if (wsKeySet.has(wouldBeKey)) continue;
      if (wsKeySet.has(f.key)) continue;
      importable.push(f);
    }
  }

  async function handleCreateAndMap(fields: PipedriveField[]) {
    if (!workspaceId) return;
    const isAll = fields.length > 1;
    if (isAll) setAddingAll(true);
    setAddingKeys(prev => {
      const next = new Set(prev);
      fields.forEach(f => next.add(f.key));
      return next;
    });
    setImportError(null);

    try {
      const wsRes = await fetch(`/api/v1/workspaces/${workspaceId}`);
      if (!wsRes.ok) throw new Error('Failed to load workspace');
      const ws = await wsRes.json();
      const currentSchema: WorkspaceProperty[] = ws.leadPropertySchema ?? [];
      const existingKeys = new Set(currentSchema.map(p => p.key));

      const newProps: WorkspaceProperty[] = [];
      const newMappings: Record<string, string> = {};

      for (const f of fields) {
        const propKey = pdKeyToPropertyKey(f);
        if (existingKeys.has(propKey)) {
          newMappings[propKey] = f.key;
          continue;
        }
        const prop: WorkspaceProperty = {
          key: propKey,
          label: f.name,
          type: 'string',
          required: false,
        };
        newProps.push(prop);
        newMappings[propKey] = f.key;
        existingKeys.add(propKey);
      }

      if (newProps.length > 0) {
        const patchRes = await fetch(`/api/v1/workspaces/${workspaceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadPropertySchema: [...currentSchema, ...newProps] }),
        });
        if (!patchRes.ok) {
          const data = await patchRes.json();
          throw new Error(data.error || 'Failed to create properties');
        }
        setWorkspaceProps(prev => [...prev, ...newProps]);
      }

      setMeta(prev => ({
        ...prev,
        fieldMap: { ...prev.fieldMap, ...newMappings },
      }));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to create properties');
    } finally {
      setAddingKeys(new Set());
      setAddingAll(false);
    }
  }

  if (!hasSynced) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium text-zinc-300">Field Mappings</h4>
          <button
            type="button"
            onClick={onSync}
            disabled={fieldsLoading || !integrationId}
            className="text-xs px-2.5 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-50"
          >
            {fieldsLoading ? 'Syncing...' : 'Sync Fields'}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-3">
          Map RevLine lead properties to Pipedrive person field keys.{' '}
          {integrationId && (
            <span className="text-zinc-600">Click &quot;Sync Fields&quot; to auto-detect mappings.</span>
          )}
        </p>
        {fieldsError && <p className="text-xs text-red-400 mb-2">{fieldsError}</p>}

        {fieldEntries.length > 0 && (
          <div className="space-y-2 mb-3">
            {fieldEntries.map(([left, right]) => (
              <div key={left} className="flex items-center gap-2 p-2.5 bg-zinc-950 rounded border border-zinc-800">
                <span className="flex-1 text-sm font-mono text-zinc-300 truncate">{left}</span>
                <span className="text-zinc-600 text-xs">&rarr;</span>
                <span className="flex-1 text-sm font-mono text-zinc-300 truncate">{right}</span>
                <button type="button" onClick={() => onRemoveFieldMapping(left)} className="text-red-400/80 hover:text-red-400 text-sm px-1.5">&times;</button>
              </div>
            ))}
          </div>
        )}

        {fieldEntries.length === 0 && (
          <p className="text-sm text-zinc-500 italic">No field mappings configured.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-medium text-zinc-300">Field Mappings</h4>
        <button
          type="button"
          onClick={onSync}
          disabled={fieldsLoading}
          className="text-xs px-2.5 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-50"
        >
          {fieldsLoading ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      <p className="text-xs text-zinc-500 mb-3">
        Map RevLine lead properties to Pipedrive person field keys.
      </p>
      {fieldsError && <p className="text-xs text-red-400 mb-2">{fieldsError}</p>}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
        {/* Progress Bar */}
        {totalProps > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{mappedCount} of {totalProps} properties mapped</span>
              <span className={`font-medium ${pct === 100 ? 'text-green-400' : 'text-zinc-400'}`}>{pct}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-emerald-500/70'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Mapped Section */}
        {fieldEntries.length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Mapped</p>
            <div className="flex flex-wrap gap-2">
              {fieldEntries.map(([left, right]) => {
                const pdField = pipedriveFields.find(f => f.key === right);
                const rightLabel = pdField ? pdField.name : right;
                return (
                  <span
                    key={left}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-green-500/10 border border-green-500/20 text-green-400"
                  >
                    <span className="font-mono">{left}</span>
                    <span className="text-green-600">&rarr;</span>
                    <span>{rightLabel}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveFieldMapping(left)}
                      className="ml-0.5 text-green-600 hover:text-green-300 transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggested Section */}
        {suggestions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Suggested</p>
              {suggestions.length > 1 && (
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Add All ({suggestions.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(({ prop, pdField }) => (
                <button
                  key={prop.key}
                  type="button"
                  onClick={() => handleAcceptSuggestion(prop.key, pdField.key)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  <span>+</span>
                  <span className="font-mono">{prop.key}</span>
                  <span className="text-amber-600">&rarr;</span>
                  <span>{pdField.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Unmapped Section */}
        {unmapped.length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Unmapped</p>
            <div className="space-y-2">
              {unmapped.map(prop => (
                <div key={prop.key} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-400 w-32 truncate" title={prop.key}>{prop.key}</span>
                  <span className="text-zinc-600 text-xs">&rarr;</span>
                  <select
                    defaultValue=""
                    onChange={(e) => handleMapUnmapped(prop.key, e.target.value)}
                    className="flex-1 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-white outline-none"
                  >
                    <option value="">Select Pipedrive field…</option>
                    {availablePdFields.filter(f => !f.isCustom).length > 0 && (
                      <optgroup label="Built-in">
                        {availablePdFields.filter(f => !f.isCustom).map(f => (
                          <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                        ))}
                      </optgroup>
                    )}
                    {availablePdFields.filter(f => f.isCustom).length > 0 && (
                      <optgroup label="Custom">
                        {availablePdFields.filter(f => f.isCustom).map(f => (
                          <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available from Pipedrive — create property + map in one click */}
        {importable.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Available from Pipedrive</p>
              {importable.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleCreateAndMap(importable)}
                  disabled={addingAll}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {addingAll ? 'Adding...' : `Add All (${importable.length})`}
                </button>
              )}
            </div>
            <p className="text-[10px] text-zinc-600 mb-2">Click to create as RevLine property and map automatically.</p>
            <div className="flex flex-wrap gap-2">
              {importable.map(f => {
                const loading = addingKeys.has(f.key) || addingAll;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleCreateAndMap([f])}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                  >
                    <span>{loading ? '...' : '+'}</span>
                    <span>{f.name}</span>
                    <span className="text-cyan-600 font-mono text-[10px]">({f.isCustom ? pdKeyToPropertyKey(f) : f.key})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {importError && <p className="text-xs text-red-400">{importError}</p>}

        {/* All-mapped confirmation */}
        {hasSynced && totalProps > 0 && suggestions.length === 0 && unmapped.length === 0 && importable.length === 0 && (
          <p className="text-xs text-green-400/80 text-center py-1">All workspace properties are mapped.</p>
        )}

        {totalProps === 0 && importable.length === 0 && (
          <p className="text-xs text-zinc-500 italic text-center py-1">
            No workspace properties defined. Add properties in the Lead Properties editor, then sync here.
          </p>
        )}

        {totalProps === 0 && importable.length > 0 && (
          <p className="text-xs text-zinc-500 italic text-center py-1">
            No workspace properties yet. Click Pipedrive fields above to create and map them.
          </p>
        )}
      </div>

      {/* Manual fallback */}
      <div className="mt-3">
        <p className="text-xs text-zinc-600 mb-2">Custom mapping (for keys not in workspace schema)</p>
        <div className="flex items-end gap-2 p-2.5 bg-zinc-900/50 rounded border border-dashed border-zinc-700">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">RevLine Property</label>
            <input
              type="text"
              value={newFieldLeft}
              onChange={(e) => setNewFieldLeft(e.target.value)}
              placeholder="custom_key"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
            />
          </div>
          <span className="text-zinc-600 text-xs pb-2">&rarr;</span>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Pipedrive Field</label>
            {pipedriveFields.length > 0 ? (
              <select
                value={newFieldRight}
                onChange={(e) => setNewFieldRight(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white outline-none"
              >
                <option value="">Select a field...</option>
                {pipedriveFields.some(f => !f.isCustom) && (
                  <optgroup label="Built-in">
                    {pipedriveFields.filter(f => !f.isCustom).map(f => (
                      <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                    ))}
                  </optgroup>
                )}
                {pipedriveFields.some(f => f.isCustom) && (
                  <optgroup label="Custom">
                    {pipedriveFields.filter(f => f.isCustom).map(f => (
                      <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                    ))}
                  </optgroup>
                )}
              </select>
            ) : (
              <input
                type="text"
                value={newFieldRight}
                onChange={(e) => setNewFieldRight(e.target.value)}
                placeholder="phone"
                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
              />
            )}
          </div>
          <button
            type="button"
            onClick={onAddFieldMapping}
            disabled={!newFieldLeft.trim() || !newFieldRight.trim()}
            className="px-3 py-1.5 text-sm bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export function PipedriveConfigEditor({
  value,
  onChange,
  error: externalError,
  integrationId,
  workspaceId,
  workspaceSlug,
}: PipedriveConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<PipedriveMetaConfig>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const [newFieldLeft, setNewFieldLeft] = useState('');
  const [newFieldRight, setNewFieldRight] = useState('');

  const [newStageKey, setNewStageKey] = useState('');
  const [newStageId, setNewStageId] = useState('');

  const [pipedriveFields, setPipedriveFields] = useState<PipedriveField[]>([]);
  const [workspaceProps, setWorkspaceProps] = useState<WorkspaceProperty[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [hasSynced, setHasSynced] = useState(false);

  function normalize(s: string) {
    return s.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  async function handleSyncFields() {
    if (!integrationId) {
      setFieldsError('Save the integration first');
      return;
    }
    setFieldsLoading(true);
    setFieldsError(null);
    try {
      const [fieldsRes, wsRes] = await Promise.all([
        fetch(`/api/v1/integrations/${integrationId}/pipedrive-fields`),
        workspaceId ? fetch(`/api/v1/workspaces/${workspaceId}`) : Promise.resolve(null),
      ]);

      const fieldsData = await fieldsRes.json();
      if (!fieldsData.success || !Array.isArray(fieldsData.data)) {
        setFieldsError(fieldsData.error || 'Failed to fetch Pipedrive fields');
        return;
      }

      const sorted = [...fieldsData.data].sort((a: PipedriveField, b: PipedriveField) => {
        if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
      setPipedriveFields(sorted);

      if (wsRes) {
        const wsData = await wsRes.json();
        const schema = Array.isArray(wsData.leadPropertySchema)
          ? (wsData.leadPropertySchema as WorkspaceProperty[])
          : [];
        setWorkspaceProps(schema);
      }

      setHasSynced(true);
    } catch {
      setFieldsError('Failed to reach the server');
    } finally {
      setFieldsLoading(false);
    }
  }

  useEffect(() => {
    if (!isJsonMode) {
      const obj: Record<string, unknown> = { fieldMap: meta.fieldMap };
      if (meta.defaultPipelineId !== null) obj.defaultPipelineId = meta.defaultPipelineId;
      if (Object.keys(meta.stageMap).length > 0) obj.stageMap = meta.stageMap;
      if (meta.logActivities) obj.logActivities = true;
      if (meta.webhookSecret) obj.webhookSecret = meta.webhookSecret;
      const newJson = JSON.stringify(obj, null, 2);
      onChange(newJson);
    }
  }, [meta, isJsonMode, onChange]);

  function handleSwitchToJson() {
    setJsonText(JSON.stringify(meta, null, 2));
    setIsJsonMode(true);
    setJsonError(null);
  }

  function handleSwitchToStructured() {
    try {
      const parsed = JSON.parse(jsonText);
      setMeta({
        fieldMap: parsed.fieldMap ?? {},
        defaultPipelineId: parsed.defaultPipelineId ?? null,
        stageMap: parsed.stageMap ?? {},
        logActivities: parsed.logActivities ?? false,
        webhookSecret: parsed.webhookSecret ?? '',
      });
      setIsJsonMode(false);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON — fix before switching to structured mode');
    }
  }

  function handleJsonChange(newText: string) {
    setJsonText(newText);
    setJsonError(null);
    try {
      JSON.parse(newText);
      onChange(newText);
    } catch {
      setJsonError('Invalid JSON');
    }
  }

  function handleAddFieldMapping() {
    if (!newFieldLeft.trim() || !newFieldRight.trim()) return;
    setMeta(prev => ({
      ...prev,
      fieldMap: { ...prev.fieldMap, [newFieldLeft.trim()]: newFieldRight.trim() },
    }));
    setNewFieldLeft('');
    setNewFieldRight('');
  }

  function handleRemoveFieldMapping(key: string) {
    setMeta(prev => {
      const updated = { ...prev.fieldMap };
      delete updated[key];
      return { ...prev, fieldMap: updated };
    });
  }

  function handleAddStageMapping() {
    if (!newStageKey.trim() || !newStageId.trim()) return;
    const stageIdNum = parseInt(newStageId.trim(), 10);
    if (isNaN(stageIdNum)) return;
    setMeta(prev => ({
      ...prev,
      stageMap: { ...prev.stageMap, [newStageKey.trim()]: stageIdNum },
    }));
    setNewStageKey('');
    setNewStageId('');
  }

  function handleRemoveStageMapping(key: string) {
    setMeta(prev => {
      const updated = { ...prev.stageMap };
      delete updated[key];
      return { ...prev, stageMap: updated };
    });
  }

  async function handleTestConnection() {
    if (!integrationId) {
      setTestStatus('error');
      setTestMessage('Save the integration first, then test the connection');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    try {
      const res = await fetch(`/api/v1/integrations/${integrationId}/test`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success || res.ok) {
        setTestStatus('success');
        setTestMessage('Connected to Pipedrive successfully');
      } else {
        setTestStatus('error');
        setTestMessage(data.data?.error || data.error || 'Connection failed');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Failed to reach the test endpoint');
    }

    setTimeout(() => setTestStatus('idle'), 5000);
  }

  const stageEntries = Object.entries(meta.stageMap);
  const displayError = externalError || jsonError;

  if (isJsonMode) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-400">JSON Mode</span>
          <button
            type="button"
            onClick={handleSwitchToStructured}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
          >
            Switch to Structured
          </button>
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm"
          rows={12}
          spellCheck={false}
        />
        {displayError && <p className="text-red-400 text-sm">{displayError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle + Test Connection */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testStatus === 'testing' || !integrationId}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            testStatus === 'success'
              ? 'text-green-400 border-green-500/30 bg-green-500/10'
              : testStatus === 'error'
                ? 'text-red-400 border-red-500/30 bg-red-500/10'
                : 'text-zinc-400 hover:text-white border-zinc-700 hover:border-zinc-600'
          } disabled:opacity-50`}
        >
          {testStatus === 'testing' ? 'Testing...' : testStatus === 'success' ? 'Connected' : testStatus === 'error' ? 'Failed' : 'Test Connection'}
        </button>
        <button
          type="button"
          onClick={handleSwitchToJson}
          className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
        >
          Switch to JSON
        </button>
      </div>

      {testMessage && (
        <p className={`text-xs ${testStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
          {testMessage}
        </p>
      )}

      {/* Activity Logging Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/60">
        <div>
          <h4 className="text-sm font-medium text-zinc-300">Log agent activity</h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            Automatically log agent SMS and email messages to the person&apos;s Pipedrive timeline.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={meta.logActivities}
          onClick={() => setMeta(prev => ({ ...prev, logActivities: !prev.logActivities }))}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            meta.logActivities ? 'bg-green-600' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              meta.logActivities ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Webhook Secret + URL */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <h4 className="text-sm font-medium text-zinc-300">Inbound Webhook</h4>
        <p className="text-xs text-zinc-500">
          Receive person created/updated events from Pipedrive. Generate a secret, then register this URL as a webhook in Pipedrive.
        </p>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Webhook Secret</label>
            <input
              type="text"
              value={meta.webhookSecret}
              onChange={(e) => setMeta(prev => ({ ...prev, webhookSecret: e.target.value }))}
              placeholder="Click Generate to create a secret"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
              readOnly={false}
            />
          </div>
          <button
            type="button"
            onClick={() => setMeta(prev => ({ ...prev, webhookSecret: crypto.randomUUID() }))}
            className="px-3 py-1.5 text-sm bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors"
          >
            Generate
          </button>
        </div>

        {meta.webhookSecret && (
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Webhook URL (copy to Pipedrive)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/pipedrive-webhook?source=${workspaceSlug || 'YOUR_SLUG'}&secret=${meta.webhookSecret}`}
                className="flex-1 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-400"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/api/v1/pipedrive-webhook?source=${workspaceSlug || 'YOUR_SLUG'}&secret=${meta.webhookSecret}`;
                  navigator.clipboard.writeText(url);
                }}
                className="px-2.5 py-1.5 text-xs bg-zinc-800 text-zinc-400 hover:text-white rounded hover:bg-zinc-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Field Mappings — Auto-Mapping Panel */}
      <FieldMappingPanel
        meta={meta}
        setMeta={setMeta}
        pipedriveFields={pipedriveFields}
        workspaceProps={workspaceProps}
        setWorkspaceProps={setWorkspaceProps}
        workspaceId={workspaceId}
        hasSynced={hasSynced}
        fieldsLoading={fieldsLoading}
        fieldsError={fieldsError}
        integrationId={integrationId}
        onSync={handleSyncFields}
        normalize={normalize}
        newFieldLeft={newFieldLeft}
        setNewFieldLeft={setNewFieldLeft}
        newFieldRight={newFieldRight}
        setNewFieldRight={setNewFieldRight}
        onAddFieldMapping={handleAddFieldMapping}
        onRemoveFieldMapping={handleRemoveFieldMapping}
      />

      {/* Stage Mappings (optional) */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-1">Stage Mappings <span className="text-zinc-500 font-normal">(optional)</span></h4>
        <p className="text-xs text-zinc-500 mb-3">
          Map RevLine lead stages to Pipedrive pipeline stage IDs. Used for deal management.
        </p>

        <div className="space-y-2 mb-3">
          {stageEntries.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No stage mappings configured.</p>
          ) : (
            stageEntries.map(([stageKey, stageId]) => (
              <div key={stageKey} className="flex items-center gap-2 p-2.5 bg-zinc-950 rounded border border-zinc-800">
                <span className="flex-1 text-sm font-mono text-zinc-300">{stageKey}</span>
                <span className="text-zinc-600 text-xs">&rarr;</span>
                <span className="text-sm font-mono text-zinc-300">Stage {stageId}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveStageMapping(stageKey)}
                  className="text-red-400/80 hover:text-red-400 text-sm px-1.5"
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-end gap-2 p-2.5 bg-zinc-900/50 rounded border border-dashed border-zinc-700">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Lead Stage</label>
            <input
              type="text"
              value={newStageKey}
              onChange={(e) => setNewStageKey(e.target.value)}
              placeholder="CAPTURED"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
            />
          </div>
          <span className="text-zinc-600 text-xs pb-2">&rarr;</span>
          <div className="w-24">
            <label className="text-xs text-zinc-500 block mb-1">Stage ID</label>
            <input
              type="number"
              value={newStageId}
              onChange={(e) => setNewStageId(e.target.value)}
              placeholder="1"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
            />
          </div>
          <button
            type="button"
            onClick={handleAddStageMapping}
            disabled={!newStageKey.trim() || !newStageId.trim()}
            className="px-3 py-1.5 text-sm bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Pipeline ID */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-1">Default Pipeline ID <span className="text-zinc-500 font-normal">(optional)</span></h4>
        <p className="text-xs text-zinc-500 mb-2">
          Pipedrive pipeline ID for new deals. Find in Pipedrive URL when viewing a pipeline.
        </p>
        <input
          type="number"
          value={meta.defaultPipelineId ?? ''}
          onChange={(e) => {
            const val = e.target.value.trim();
            setMeta(prev => ({
              ...prev,
              defaultPipelineId: val ? parseInt(val, 10) : null,
            }));
          }}
          placeholder="1"
          className="w-32 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
        />
      </div>

      {displayError && <p className="text-red-400 text-sm">{displayError}</p>}
    </div>
  );
}
