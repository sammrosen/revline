'use client';

import { useState, useEffect } from 'react';

/**
 * Resolve a path template by replacing {slug} with actual workspace slug
 */
function resolveFormPath(pathTemplate: string, workspaceSlug: string): string {
  return pathTemplate.replace(/{slug}/g, workspaceSlug);
}

/**
 * RevLine configuration editor.
 * 
 * Allows enabling/disabling forms for a workspace.
 * Forms are defined in the form registry - enable them here to activate their triggers.
 * Each form declares its triggers in the registry; enabling a form enables all its triggers.
 */
interface FormConfig {
  enabled: boolean;
}

interface RevlineMeta {
  forms: Record<string, FormConfig>;
  settings: {
    defaultSource?: string;
  };
}

interface FormTrigger {
  id: string;
  label: string;
  description?: string;
}

interface RegisteredForm {
  id: string;
  name: string;
  description: string;
  path: string;
  type: string;
  triggers: FormTrigger[];
}

export interface RevlineConfigEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  integrationId?: string;
  /** Current workspace ID - used to exclude self from duplicate checks */
  workspaceId?: string;
  /** Current workspace slug - used for resolving form path templates */
  workspaceSlug?: string;
}

const DEFAULT_CONFIG: RevlineMeta = {
  forms: {},
  settings: {
    defaultSource: '',
  },
};

function parseMeta(value: string): RevlineMeta {
  if (!value.trim()) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(value);
    return {
      forms: parsed.forms || {},
      settings: {
        defaultSource: parsed.settings?.defaultSource || '',
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Full RevLine config editor for the Configure modal.
 */
export function RevlineConfigEditor({ 
  value, 
  onChange, 
  error,
  workspaceSlug,
}: RevlineConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [meta, setMeta] = useState<RevlineMeta>(() => parseMeta(value));
  const [jsonText, setJsonText] = useState(value);
  
  // Form registry state
  const [registeredForms, setRegisteredForms] = useState<RegisteredForm[]>([]);

  // Fetch available forms from registry on mount
  useEffect(() => {
    fetch('/api/v1/forms')
      .then(res => res.json())
      .then(data => {
        if (data.forms) {
          setRegisteredForms(data.forms);
        }
      })
      .catch(() => {
        // Silent fail - forms list just won't show
      });
  }, []);

  // Derive the display JSON from meta when in structured mode
  const displayJsonText = isJsonMode ? jsonText : JSON.stringify(meta, null, 2);

  // Update meta and notify parent
  function updateMeta(newMeta: RevlineMeta) {
    setMeta(newMeta);
    onChange(JSON.stringify(newMeta, null, 2));
  }

  // Toggle between JSON and structured mode
  function toggleJsonMode() {
    if (!isJsonMode) {
      setJsonText(JSON.stringify(meta, null, 2));
    }
    setIsJsonMode(!isJsonMode);
  }

  function handleJsonChange(text: string) {
    setJsonText(text);
    onChange(text);
    try {
      const parsed = JSON.parse(text);
      setMeta({
        forms: parsed.forms || {},
        settings: {
          defaultSource: parsed.settings?.defaultSource || '',
        },
      });
    } catch {
      // Invalid JSON, don't update meta
    }
  }

  function updateSettings(field: keyof RevlineMeta['settings'], value: string) {
    updateMeta({
      ...meta,
      settings: { ...meta.settings, [field]: value },
    });
  }

  function enableForm(formId: string) {
    updateMeta({
      ...meta,
      forms: {
        ...meta.forms,
        [formId]: { enabled: true },
      },
    });
  }

  function toggleForm(formId: string) {
    const current = meta.forms[formId];
    updateMeta({
      ...meta,
      forms: {
        ...meta.forms,
        [formId]: { enabled: !current?.enabled },
      },
    });
  }

  function removeForm(formId: string) {
    const newForms = { ...meta.forms };
    delete newForms[formId];
    updateMeta({ ...meta, forms: newForms });
  }

  const enabledFormIds = Object.keys(meta.forms);
  const availableForms = registeredForms.filter(f => !meta.forms[f.id]);

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleJsonMode}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isJsonMode ? '← Structured Editor' : 'JSON Mode →'}
        </button>
      </div>

      {isJsonMode ? (
        /* JSON Mode */
        <div>
          <textarea
            value={displayJsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm min-h-[300px] outline-none focus:border-zinc-700"
            spellCheck={false}
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
      ) : (
        /* Structured Editor */
        <>
          {/* Settings Section */}
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Settings</h4>
            
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">
                Default Source
              </label>
              <input
                type="text"
                value={meta.settings.defaultSource || ''}
                onChange={(e) => updateSettings('defaultSource', e.target.value)}
                placeholder="e.g., landing, website"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Used when no source is specified in form submissions
              </p>
            </div>
          </div>

          {/* Forms Section */}
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Enabled Forms</h4>
            
            {enabledFormIds.length === 0 ? (
              <p className="text-sm text-zinc-500 italic py-2">
                No forms enabled. Select from available forms below.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {enabledFormIds.map((formId) => {
                  const form = meta.forms[formId];
                  const registeredForm = registeredForms.find(f => f.id === formId);
                  const isRegistered = !!registeredForm;
                  
                  return (
                    <div 
                      key={formId}
                      className={`p-3 bg-zinc-900 rounded border ${
                        isRegistered ? 'border-zinc-800' : 'border-red-500/30'
                      }`}
                    >
                      {/* Top row: toggle, name, type badge, remove */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleForm(formId)}
                          className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                            form.enabled ? 'bg-amber-500' : 'bg-zinc-700'
                          }`}
                        >
                          <span 
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                              form.enabled ? 'left-5' : 'left-0.5'
                            }`}
                          />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-mono text-white">
                              {registeredForm?.name || formId}
                            </span>
                            {isRegistered ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                                {registeredForm.type}
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                                not registered
                              </span>
                            )}
                          </div>
                          {/* Form URL */}
                          {registeredForm?.path && workspaceSlug && (
                            <a
                              href={resolveFormPath(registeredForm.path, workspaceSlug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-zinc-500 hover:text-amber-400 transition-colors flex items-center gap-1 mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              {resolveFormPath(registeredForm.path, workspaceSlug)}
                            </a>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeForm(formId)}
                          className="text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
                          title="Remove form"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Triggers row */}
                      {registeredForm?.triggers?.length ? (
                        <div className="mt-2 pt-2 border-t border-zinc-800/50">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-zinc-500">triggers:</span>
                            {registeredForm.triggers.map(t => (
                              <span 
                                key={t.id} 
                                className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded font-mono" 
                                title={t.description || t.label}
                              >
                                {t.id}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Available Forms from Registry */}
            {registeredForms.length > 0 && (
              <div className="pt-3 border-t border-zinc-800/50">
                <p className="text-xs text-zinc-500 mb-2">Available forms:</p>
                {availableForms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {availableForms.map(form => (
                      <button
                        key={form.id}
                        type="button"
                        onClick={() => enableForm(form.id)}
                        className="px-2.5 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors flex items-center gap-1.5"
                        title={`${form.description}\n\nTriggers: ${form.triggers?.map(t => t.id).join(', ') || 'none'}`}
                      >
                        <span className="text-green-400">+</span>
                        <span className="font-medium">{form.name}</span>
                        <span className="text-zinc-500">({form.type})</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600 italic">All registered forms are enabled</span>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">How it works</h4>
            <ul className="text-xs text-zinc-500 space-y-1">
              <li>• Forms are defined in the form registry (code)</li>
              <li>• Enable a form here to activate it for this workspace</li>
              <li>• Each form&apos;s triggers become available in the workflow editor</li>
            </ul>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </>
      )}
    </div>
  );
}
