'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * RevLine configuration editor.
 * Allows enabling/disabling forms and setting trigger operations.
 * Warns if a formId is already in use by another client.
 */
interface FormConfig {
  enabled: boolean;
  triggerOperation?: string;
}

interface RevlineMeta {
  forms: Record<string, FormConfig>;
  settings: {
    defaultSource?: string;
  };
}

interface DuplicateWarning {
  formId: string;
  clientName: string;
}

interface RegisteredForm {
  id: string;
  name: string;
  description: string;
  path: string;
  type: string;
}

interface RevlineConfigEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  integrationId?: string;
  /** Current client ID - used to exclude self from duplicate checks */
  clientId?: string;
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
  clientId,
}: RevlineConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [meta, setMeta] = useState<RevlineMeta>(() => parseMeta(value));
  const [jsonText, setJsonText] = useState(value);
  const [newFormId, setNewFormId] = useState('');
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [pendingDuplicateCheck, setPendingDuplicateCheck] = useState<string | null>(null);
  
  // Form registry state
  const [registeredForms, setRegisteredForms] = useState<RegisteredForm[]>([]);
  const [unregisteredWarning, setUnregisteredWarning] = useState<string | null>(null);

  // Fetch available forms from registry on mount
  useEffect(() => {
    fetch('/api/admin/forms')
      .then(res => res.json())
      .then(data => {
        if (data.forms) {
          setRegisteredForms(data.forms);
        }
      })
      .catch(() => {
        // Silent fail - validation just won't work
      });
  }, []);

  // Check if a formId is already in use by another client
  const checkFormIdDuplicate = useCallback(async (formId: string): Promise<DuplicateWarning | null> => {
    try {
      const params = new URLSearchParams({ formId });
      if (clientId) params.append('excludeClientId', clientId);
      
      const response = await fetch(`/api/admin/check-form-id?${params}`);
      const data = await response.json();
      
      if (data.inUse) {
        return { formId, clientName: data.client.name };
      }
      return null;
    } catch {
      console.error('Failed to check form ID');
      return null;
    }
  }, [clientId]);

  // Derive the display JSON from meta when in structured mode
  const displayJsonText = isJsonMode ? jsonText : JSON.stringify(meta, null, 2);

  // Update meta and notify parent (used by structured editor)
  function updateMeta(newMeta: RevlineMeta) {
    setMeta(newMeta);
    // Notify parent immediately
    onChange(JSON.stringify(newMeta, null, 2));
  }

  // Toggle between JSON and structured mode
  function toggleJsonMode() {
    if (!isJsonMode) {
      // Switching TO JSON mode - sync jsonText from current meta
      setJsonText(JSON.stringify(meta, null, 2));
    }
    setIsJsonMode(!isJsonMode);
  }

  function handleJsonChange(text: string) {
    setJsonText(text);
    onChange(text);
    // Try to parse and update meta
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

  async function addForm() {
    if (!newFormId.trim()) return;
    const formId = newFormId.trim().toLowerCase().replace(/\s+/g, '-');
    if (meta.forms[formId]) return; // Already exists in this config
    
    // Check if form exists in registry
    const isRegistered = registeredForms.some(f => f.id === formId);
    
    // Check for duplicates before adding
    setCheckingDuplicate(true);
    const warning = await checkFormIdDuplicate(formId);
    setCheckingDuplicate(false);
    
    // Handle both warnings
    if (!isRegistered || warning) {
      if (!isRegistered) {
        setUnregisteredWarning(formId);
      }
      if (warning) {
        setDuplicateWarnings(prev => [...prev.filter(w => w.formId !== formId), warning]);
      }
      setPendingDuplicateCheck(formId);
      return; // Don't add yet - let user confirm
    }
    
    // No issues, add the form
    updateMeta({
      ...meta,
      forms: {
        ...meta.forms,
        [formId]: { enabled: true, triggerOperation: 'form_submitted' },
      },
    });
    setNewFormId('');
  }

  // Confirm adding a form that has warnings
  function confirmAddWithWarnings() {
    if (!pendingDuplicateCheck) return;
    const formId = pendingDuplicateCheck;
    
    updateMeta({
      ...meta,
      forms: {
        ...meta.forms,
        [formId]: { enabled: true, triggerOperation: 'form_submitted' },
      },
    });
    setNewFormId('');
    setPendingDuplicateCheck(null);
    setUnregisteredWarning(null);
    // Keep the duplicate warning visible so they know
  }

  // Cancel adding a form with warnings
  function cancelAddWithWarnings() {
    const formId = pendingDuplicateCheck;
    setPendingDuplicateCheck(null);
    setUnregisteredWarning(null);
    setDuplicateWarnings(prev => prev.filter(w => w.formId !== formId));
  }

  function updateForm(formId: string, updates: Partial<FormConfig>) {
    updateMeta({
      ...meta,
      forms: {
        ...meta.forms,
        [formId]: { ...meta.forms[formId], ...updates },
      },
    });
  }

  function removeForm(formId: string) {
    const newForms = { ...meta.forms };
    delete newForms[formId];
    updateMeta({ ...meta, forms: newForms });
  }

  const formIds = Object.keys(meta.forms);

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
            
            {formIds.length === 0 ? (
              <p className="text-sm text-zinc-500 italic py-2">
                No forms configured. Add a form below.
              </p>
            ) : (
              <div className="space-y-3 mb-4">
                {formIds.map((formId) => {
                  const form = meta.forms[formId];
                  const registeredForm = registeredForms.find(f => f.id === formId);
                  const isRegistered = !!registeredForm;
                  
                  return (
                    <div 
                      key={formId}
                      className={`flex items-center gap-3 p-3 bg-zinc-900 rounded border ${
                        isRegistered ? 'border-zinc-800' : 'border-red-500/30'
                      }`}
                    >
                      {/* Enable Toggle */}
                      <button
                        type="button"
                        onClick={() => updateForm(formId, { enabled: !form.enabled })}
                        className={`w-10 h-5 rounded-full relative transition-colors ${
                          form.enabled ? 'bg-amber-500' : 'bg-zinc-700'
                        }`}
                      >
                        <span 
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            form.enabled ? 'left-5' : 'left-0.5'
                          }`}
                        />
                      </button>

                      {/* Form ID and Status */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-white truncate">
                            {formId}
                          </span>
                          {isRegistered ? (
                            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded" title={registeredForm.description}>
                              ✓ {registeredForm.type}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded" title="Form not found in registry">
                              not registered
                            </span>
                          )}
                        </div>
                        {isRegistered && (
                          <span className="text-[10px] text-zinc-500 truncate block">
                            {registeredForm.path}
                          </span>
                        )}
                      </div>

                      {/* Trigger Operation */}
                      <input
                        type="text"
                        value={form.triggerOperation || 'form_submitted'}
                        onChange={(e) => updateForm(formId, { triggerOperation: e.target.value })}
                        placeholder="form_submitted"
                        className="w-40 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-zinc-300 outline-none focus:border-zinc-600"
                      />

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeForm(formId)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Warnings */}
            {pendingDuplicateCheck && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
                {/* Unregistered Warning */}
                {unregisteredWarning && (
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-red-200">
                        <span className="font-mono">{unregisteredWarning}</span> is not in the form registry
                      </p>
                      <p className="text-xs text-red-200/70 mt-1">
                        This form ID doesn&apos;t exist yet. Make sure you&apos;ve created the form and added it to the registry.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Duplicate Warning */}
                {duplicateWarnings.find(w => w.formId === pendingDuplicateCheck) && (
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm text-amber-200">
                        <span className="font-mono">{pendingDuplicateCheck}</span> is already enabled for{' '}
                        <span className="font-medium">
                          {duplicateWarnings.find(w => w.formId === pendingDuplicateCheck)?.clientName}
                        </span>
                      </p>
                      <p className="text-xs text-amber-200/70 mt-1">
                        Each form ID should only be used by one client to prevent data cross-contamination.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={confirmAddWithWarnings}
                    className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 transition-colors"
                  >
                    Add Anyway
                  </button>
                  <button
                    type="button"
                    onClick={cancelAddWithWarnings}
                    className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Add Form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newFormId}
                onChange={(e) => setNewFormId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addForm())}
                placeholder="Form ID (e.g., prospect-intake)"
                disabled={checkingDuplicate || !!pendingDuplicateCheck}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-dashed border-zinc-700 rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={addForm}
                disabled={!newFormId.trim() || checkingDuplicate || !!pendingDuplicateCheck}
                className="px-4 py-2 text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {checkingDuplicate ? (
                  <>
                    <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Add Form'
                )}
              </button>
            </div>
            
            <p className="text-xs text-zinc-600 mt-2">
              Form IDs should match the formId used in your form components
            </p>
            
            {/* Available Forms from Registry */}
            {registeredForms.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-800/50">
                <p className="text-xs text-zinc-500 mb-2">Available forms:</p>
                <div className="flex flex-wrap gap-2">
                  {registeredForms
                    .filter(f => !meta.forms[f.id])
                    .map(form => (
                      <button
                        key={form.id}
                        type="button"
                        onClick={() => {
                          updateMeta({
                            ...meta,
                            forms: {
                              ...meta.forms,
                              [form.id]: { enabled: true, triggerOperation: 'form_submitted' },
                            },
                          });
                        }}
                        className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors flex items-center gap-1.5"
                        title={form.description}
                      >
                        <span className="text-green-400">+</span>
                        <span className="font-mono">{form.id}</span>
                        <span className="text-zinc-500">({form.type})</span>
                      </button>
                    ))}
                  {registeredForms.filter(f => !meta.forms[f.id]).length === 0 && (
                    <span className="text-xs text-zinc-600 italic">All registered forms are enabled</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">How it works</h4>
            <ul className="text-xs text-zinc-500 space-y-1">
              <li>• Enable forms to allow submissions for this client</li>
              <li>• Each form can have a custom trigger operation (default: form_submitted)</li>
              <li>• Create workflows that trigger on form submissions</li>
              <li>• Forms work without RevLine config - this just adds control</li>
            </ul>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </>
      )}
    </div>
  );
}
