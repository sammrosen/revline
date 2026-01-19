'use client';

import { useState, useEffect, useCallback } from 'react';
import { lockScroll, unlockScroll } from '@/app/_lib/utils/scroll-lock';
import { AppApi } from '@/app/_lib/api-paths';

/**
 * Test field definition from workflow registry
 */
interface TestField {
  name: string;
  label: string;
  type: 'email' | 'text' | 'number' | 'select' | 'datetime';
  required: boolean;
  default?: string | number;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

/**
 * Trigger option fetched from workflow registry
 */
interface TriggerOption {
  trigger: string;
  label: string;
  description?: string;
  testFields: TestField[];
}

interface ActionExecutionResult {
  action: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

interface WorkflowExecution {
  workflowId: string;
  workflowName: string;
  status: 'completed' | 'failed';
  actionsExecuted: number;
  actionsTotal: number;
  error?: string;
  results: ActionExecutionResult[];
}

interface TestTriggerResponse {
  trigger: string;
  workflowsFound: number;
  workflowsExecuted: number;
  executions: WorkflowExecution[];
  allSucceeded: boolean;
  duration: number;
}

function StatusIcon({ success }: { success: boolean }) {
  return success ? (
    <span className="text-green-400">✓</span>
  ) : (
    <span className="text-red-400">✗</span>
  );
}

function TestSuiteDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  // Dynamic triggers from registry
  const [availableTriggers, setAvailableTriggers] = useState<TriggerOption[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(true);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  
  // Form state
  const [trigger, setTrigger] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestTriggerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get current trigger's test fields
  const currentTrigger = availableTriggers.find(t => t.trigger === trigger);
  const testFields = currentTrigger?.testFields || [];

  // Initialize field values from testFields defaults
  const initializeFieldValues = useCallback((fields: TestField[]) => {
    const defaults: Record<string, string | number> = {};
    fields.forEach(field => {
      if (field.default !== undefined) {
        defaults[field.name] = field.default;
      } else if (field.type === 'email') {
        defaults[field.name] = `test-${Date.now()}@revline.test`;
      } else if (field.type === 'number') {
        defaults[field.name] = 0;
      } else {
        defaults[field.name] = '';
      }
    });
    setFieldValues(defaults);
  }, []);

  // Fetch triggers from workflow registry on mount
  useEffect(() => {
    async function loadTriggers() {
      try {
        const url = `${AppApi.workflowRegistry}?workspaceId=${encodeURIComponent(workspaceId)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          // Transform API response into flat list for dropdown
          const triggers: TriggerOption[] = (data.data?.triggers || []).flatMap(
            (adapter: { adapterId: string; adapterName: string; triggers: Array<{ name: string; label: string; description?: string; testFields?: TestField[] }> }) =>
              adapter.triggers.map((t) => ({
                trigger: `${adapter.adapterId}.${t.name}`,
                label: `${adapter.adapterName}: ${t.label}`,
                description: t.description,
                testFields: t.testFields || [],
              }))
          );
          setAvailableTriggers(triggers);
          // Set default selection to first trigger if available
          if (triggers.length > 0) {
            setTrigger(triggers[0].trigger);
            initializeFieldValues(triggers[0].testFields);
          }
        } else {
          setTriggerError('Failed to load triggers');
        }
      } catch (err) {
        console.error('Failed to load triggers:', err);
        setTriggerError('Failed to load triggers');
      } finally {
        setLoadingTriggers(false);
      }
    }
    loadTriggers();
  }, [workspaceId, initializeFieldValues]);

  // Reset field values when trigger changes
  const handleTriggerChange = (newTrigger: string) => {
    setTrigger(newTrigger);
    const newTriggerOption = availableTriggers.find(t => t.trigger === newTrigger);
    if (newTriggerOption) {
      initializeFieldValues(newTriggerOption.testFields);
    }
  };

  // Update a single field value
  const updateFieldValue = (name: string, value: string | number) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
  };

  async function fireTrigger() {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Build payload from field values, filtering out empty optional fields
      const payload: Record<string, unknown> = {};
      testFields.forEach(field => {
        const value = fieldValues[field.name];
        // Include if required, or if optional but has a value
        if (field.required || (value !== '' && value !== undefined)) {
          payload[field.name] = field.type === 'number' ? Number(value) : value;
        }
      });

      const res = await fetch(`/api/v1/workspaces/${workspaceId}/test-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger, ...payload }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setResults(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fire trigger';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Check if all required fields have values
  const hasRequiredFields = testFields.every(field => {
    if (!field.required) return true;
    const value = fieldValues[field.name];
    return value !== '' && value !== undefined;
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Test Workflows</h2>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded font-medium">
              TESTING
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* Trigger Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Trigger
            </label>
            {loadingTriggers ? (
              <div className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-500 flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Loading triggers...
              </div>
            ) : triggerError ? (
              <div className="w-full bg-red-500/10 border border-red-500/50 rounded px-3 py-2 text-red-400 text-sm">
                {triggerError}
              </div>
            ) : availableTriggers.length === 0 ? (
              <div className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-500 text-sm">
                No triggers available. Configure integrations or enable forms first.
              </div>
            ) : (
              <select
                value={trigger}
                onChange={(e) => handleTriggerChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {availableTriggers.map((t) => (
                  <option key={t.trigger} value={t.trigger}>
                    {t.label}{t.description ? ` — ${t.description}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dynamic Test Fields */}
          {testFields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {field.label}
                {!field.required && <span className="text-zinc-500 ml-1">(optional)</span>}
              </label>
              
              {field.type === 'select' && field.options ? (
                <select
                  value={fieldValues[field.name] ?? ''}
                  onChange={(e) => updateFieldValue(field.name, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={fieldValues[field.name] ?? ''}
                  onChange={(e) => updateFieldValue(field.name, e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={field.placeholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              ) : field.type === 'datetime' ? (
                <input
                  type="datetime-local"
                  value={fieldValues[field.name] ?? ''}
                  onChange={(e) => updateFieldValue(field.name, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              ) : (
                <input
                  type={field.type === 'email' ? 'email' : 'text'}
                  value={fieldValues[field.name] ?? ''}
                  onChange={(e) => updateFieldValue(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          ))}

          {/* Fire Button */}
          <button
            onClick={fireTrigger}
            disabled={loading || !hasRequiredFields || !trigger || loadingTriggers}
            className={`w-full py-3 rounded font-medium transition-colors ${
              loading || !hasRequiredFields || !trigger || loadingTriggers
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Firing Trigger...
              </span>
            ) : (
              'Fire Trigger'
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Results Section */}
          {results && (
            <div className="border-t border-zinc-800 pt-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-300">Results</h3>
                <span className="text-xs text-zinc-500">
                  {results.duration}ms
                </span>
              </div>

              {results.workflowsFound === 0 ? (
                <div className="text-sm text-zinc-500 bg-zinc-950 rounded p-4 text-center">
                  No workflows configured for this trigger
                </div>
              ) : (
                <div className="space-y-3">
                  {results.executions.map((exec, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-950 rounded p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <StatusIcon success={exec.status === 'completed'} />
                        <span className="font-medium text-white text-sm">
                          {exec.workflowName}
                        </span>
                        <span className="text-xs text-zinc-500">
                          ({exec.actionsExecuted}/{exec.actionsTotal} actions)
                        </span>
                      </div>
                      
                      {/* Show action results */}
                      {exec.results.length > 0 && (
                        <div className="ml-5 space-y-1">
                          {exec.results.map((r, actionIdx) => (
                            <div
                              key={actionIdx}
                              className={`text-xs ${
                                r.success ? 'text-zinc-400' : 'text-red-400'
                              }`}
                            >
                              <span className="font-mono">{r.action}</span>
                              {r.error && <span> — {r.error}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {exec.error && (
                        <div className="text-xs text-red-400 mt-2">
                          {exec.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="mt-4 text-xs text-zinc-500 text-center">
                {results.workflowsExecuted} of {results.workflowsFound} workflows executed
              </div>

              {/* Overall Status */}
              <div className={`mt-2 text-sm font-medium text-center ${
                results.allSucceeded ? 'text-green-400' : 'text-red-400'
              }`}>
                {results.allSucceeded
                  ? '✓ All workflows succeeded'
                  : '✗ Some workflows failed'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function TestSuiteButton({ 
  workspaceId,
  isDropdownItem = false 
}: { 
  workspaceId: string;
  isDropdownItem?: boolean;
}) {
  const [showModal, setShowModal] = useState(false);

  // Lock body scroll when modal is open (mobile UX)
  useEffect(() => {
    if (showModal) {
      lockScroll();
    } else {
      unlockScroll();
    }
    return () => unlockScroll();
  }, [showModal]);

  if (isDropdownItem) {
    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(true);
          }}
          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white"
        >
          Test Workflows
        </button>

        {showModal && (
          <TestSuiteDialog workspaceId={workspaceId} onClose={() => setShowModal(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm font-medium transition-colors"
      >
        Test Workflows
      </button>

      {showModal && (
        <TestSuiteDialog workspaceId={workspaceId} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
