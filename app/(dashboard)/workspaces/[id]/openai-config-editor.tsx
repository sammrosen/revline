'use client';

import { useState, useEffect, useCallback } from 'react';

interface OpenAIMeta {
  model: string;
  temperature?: number;
  maxTokens?: number;
  organizationId?: string;
}

interface RemoteModel {
  id: string;
  created: number;
  ownedBy: string;
}

interface OpenAIConfigEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  integrationId?: string;
}

const DEFAULT_CONFIG: OpenAIMeta = {
  model: 'gpt-4.1-mini',
};

const RECOMMENDED_MODELS = [
  { id: 'gpt-4.1', label: 'GPT-4.1', desc: 'Flagship — best for complex reasoning' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', desc: 'Recommended — fast, cheap, capable' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', desc: 'Fastest — simple tasks, classification' },
  { id: 'gpt-4o', label: 'GPT-4o', desc: 'Previous gen — multimodal' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Previous gen — lightweight' },
];

function parseMeta(value: string): OpenAIMeta {
  if (!value.trim()) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(value);
    return {
      model: parsed.model || 'gpt-4.1-mini',
      temperature: parsed.temperature ?? undefined,
      maxTokens: parsed.maxTokens ?? undefined,
      organizationId: parsed.organizationId || undefined,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function serializeMeta(meta: OpenAIMeta): string {
  const output: Record<string, unknown> = { model: meta.model };
  if (meta.temperature !== undefined) output.temperature = meta.temperature;
  if (meta.maxTokens !== undefined) output.maxTokens = meta.maxTokens;
  if (meta.organizationId?.trim()) output.organizationId = meta.organizationId;
  return JSON.stringify(output, null, 2);
}

export function OpenAIConfigEditor({
  value,
  onChange,
  error: externalError,
  integrationId,
}: OpenAIConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<OpenAIMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Model fetching state
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);

  useEffect(() => {
    if (!isJsonMode) {
      onChange(serializeMeta(meta));
    }
  }, [meta, isJsonMode, onChange]);

  function handleSwitchToJson() {
    setJsonText(serializeMeta(meta));
    setIsJsonMode(true);
    setJsonError(null);
  }

  function handleSwitchToStructured() {
    try {
      const parsed = JSON.parse(jsonText);
      setMeta({
        model: parsed.model || 'gpt-4.1-mini',
        temperature: parsed.temperature ?? undefined,
        maxTokens: parsed.maxTokens ?? undefined,
        organizationId: parsed.organizationId || undefined,
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

  const handleFetchModels = useCallback(async () => {
    if (!integrationId) {
      setFetchError('Integration ID not available');
      return;
    }

    setFetchingModels(true);
    setFetchError(null);

    try {
      const response = await fetch(`/api/v1/integrations/${integrationId}/openai-models`);
      const data = await response.json();

      if (!response.ok) {
        setFetchError(data.error || 'Failed to fetch models');
        return;
      }

      setRemoteModels(data.data || []);
      setHasFetched(true);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setFetchingModels(false);
    }
  }, [integrationId]);

  const temperatureValid = meta.temperature === undefined || (meta.temperature >= 0 && meta.temperature <= 2);
  const maxTokensValid = meta.maxTokens === undefined || meta.maxTokens >= 1;
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
      {/* Mode Toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSwitchToJson}
          className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
        >
          Switch to JSON
        </button>
      </div>

      {/* Model Selection */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Model</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Select the OpenAI model to use for completions. This can be overridden per workflow action.
        </p>

        {/* Quick-select recommended models */}
        <div className="space-y-1.5 mb-4">
          {RECOMMENDED_MODELS.map((m) => {
            const isSelected = meta.model === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMeta({ ...meta, model: m.id })}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                  isSelected
                    ? 'bg-zinc-800 border-zinc-600'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <span className={`text-sm font-mono ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                    {m.id}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">{m.desc}</span>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-zinc-400 bg-zinc-700 px-1.5 py-0.5 rounded">
                    SELECTED
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom model input */}
        <div className="mb-4">
          <label className="text-[11px] text-zinc-500 block mb-1">Or enter a custom model ID</label>
          <input
            type="text"
            value={meta.model}
            onChange={(e) => setMeta({ ...meta, model: e.target.value })}
            placeholder="gpt-4.1-mini"
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white focus:border-zinc-600 focus:outline-none"
          />
        </div>

        {/* Fetch Models from API */}
        {integrationId && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={fetchingModels}
              className="w-full px-3 py-2 text-sm border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {fetchingModels
                ? 'Fetching models...'
                : hasFetched
                  ? 'Refresh Models from OpenAI'
                  : 'Fetch Models from OpenAI'}
            </button>

            {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}

            {hasFetched && remoteModels.length === 0 && !fetchError && (
              <p className="text-xs text-zinc-500 text-center py-2">
                No chat-capable models found in your account.
              </p>
            )}

            {remoteModels.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    Available models ({remoteModels.length}):
                  </p>
                  {remoteModels.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllModels(!showAllModels)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      {showAllModels ? 'Show less' : `Show all ${remoteModels.length}`}
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-zinc-800 p-2 bg-zinc-900/30">
                  {(showAllModels ? remoteModels : remoteModels.slice(0, 10)).map((remote) => {
                    const isSelected = meta.model === remote.id;
                    return (
                      <button
                        key={remote.id}
                        type="button"
                        onClick={() => setMeta({ ...meta, model: remote.id })}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-zinc-700/50 text-white'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <span className="font-mono text-[13px]">{remote.id}</span>
                        {isSelected && (
                          <span className="text-[10px] text-zinc-400">selected</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {!integrationId && (
          <p className="text-xs text-zinc-500">
            Save the integration first, then you can fetch available models from your OpenAI account.
          </p>
        )}
      </div>

      {/* Generation Settings */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Generation Settings</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Default settings for all completions. Individual workflow actions can override these.
        </p>

        <div className="space-y-4">
          {/* Temperature */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">Temperature</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={meta.temperature ?? 1}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setMeta({ ...meta, temperature: val === 1 ? undefined : val });
                }}
                className="flex-1 accent-zinc-400"
              />
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={meta.temperature ?? 1}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setMeta({ ...meta, temperature: val === 1 ? undefined : val });
                  }
                }}
                className={`w-20 px-2 py-1.5 bg-zinc-950 border rounded text-sm font-mono text-white text-center focus:outline-none ${
                  !temperatureValid ? 'border-red-500/50' : 'border-zinc-800 focus:border-zinc-600'
                }`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>Deterministic (0)</span>
              <span>Default (1)</span>
              <span>Creative (2)</span>
            </div>
            {!temperatureValid && (
              <p className="text-[10px] text-red-400 mt-0.5">Must be between 0 and 2</p>
            )}
          </div>

          {/* Max Tokens */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">Max Tokens</label>
            <input
              type="number"
              min="1"
              value={meta.maxTokens ?? ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                setMeta({ ...meta, maxTokens: val });
              }}
              placeholder="Default (model limit)"
              className={`w-full px-3 py-2 bg-zinc-950 border rounded text-sm font-mono text-white focus:outline-none ${
                !maxTokensValid ? 'border-red-500/50' : 'border-zinc-800 focus:border-zinc-600'
              }`}
            />
            <p className="text-xs text-zinc-600 mt-1">
              Maximum tokens in the response. Leave empty for model default.
            </p>
            {!maxTokensValid && (
              <p className="text-[10px] text-red-400 mt-0.5">Must be at least 1</p>
            )}
          </div>

          {/* Organization ID */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">Organization ID</label>
            <input
              type="text"
              value={meta.organizationId ?? ''}
              onChange={(e) => setMeta({ ...meta, organizationId: e.target.value || undefined })}
              placeholder="org-xxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white focus:border-zinc-600 focus:outline-none"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Optional. Only needed for org-scoped API keys.
            </p>
          </div>
        </div>
      </div>

      {/* Workflow Actions Info */}
      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Available Workflow Actions</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-zinc-300 text-sm mt-0.5">&#10024;</span>
            <div>
              <p className="text-sm text-zinc-300">Generate Text</p>
              <p className="text-xs text-zinc-500">
                Generate AI text from a prompt. Supports {'{{lead.*}}'} and {'{{payload.*}}'} template variables.
                Optionally include a system prompt for instructions.
              </p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 mt-3">
          Use the Workflows tab to configure when AI generation runs.
        </p>
      </div>

      {/* Preview */}
      {meta.model && (
        <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Configuration Preview</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Model:</span>
              <span className="font-mono text-white">{meta.model}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Temperature:</span>
              <span className="font-mono text-white">{meta.temperature ?? 1}</span>
            </div>
            {meta.maxTokens && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Max Tokens:</span>
                <span className="font-mono text-white">{meta.maxTokens}</span>
              </div>
            )}
            {meta.organizationId && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Organization:</span>
                <span className="font-mono text-white">{meta.organizationId}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation */}
      {!meta.model && (
        <p className="text-xs text-amber-400">
          A model must be selected for AI completions to work
        </p>
      )}

      {displayError && <p className="text-red-400 text-sm">{displayError}</p>}
    </div>
  );
}
