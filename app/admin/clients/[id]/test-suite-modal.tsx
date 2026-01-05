'use client';

import { useState } from 'react';
import { getRegisteredActions } from '@/app/_lib/actions';

type BaseRevLineAction = 'lead.captured' | 'lead.booked' | 'lead.canceled' | 'lead.paid';

interface IntegrationResult {
  integration: string;
  result: {
    success: boolean;
    error?: string;
    data?: unknown;
  };
}

interface TestActionResponse {
  action: string;
  results: IntegrationResult[];
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
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const [action, setAction] = useState<BaseRevLineAction>('lead.captured');
  const [email, setEmail] = useState(`test-${Date.now()}@revline.test`);
  const [name, setName] = useState('Test User');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestActionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registeredActions = getRegisteredActions();

  async function fireAction() {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/test-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email, name: name || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setResults(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fire action';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function getResultMessage(result: IntegrationResult): string {
    if (!result.result.success) {
      return result.result.error || 'Unknown error';
    }
    
    // Extract friendly message from data if available
    const data = result.result.data as Record<string, unknown> | undefined;
    if (data?.groupName) {
      return `Added to group "${data.groupName}"`;
    }
    if (data?.message) {
      return String(data.message);
    }
    
    return 'Action completed successfully';
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Test Suite</h2>
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
          {/* Action Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Action
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as BaseRevLineAction)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              {registeredActions.map((a) => (
                <option key={a.action} value={a.action}>
                  {a.name} — {a.description}
                </option>
              ))}
            </select>
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Test Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Name Input (Optional) */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Name <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Test User"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Fire Button */}
          <button
            onClick={fireAction}
            disabled={loading || !email}
            className={`w-full py-3 rounded font-medium transition-colors ${
              loading || !email
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
                Firing Action...
              </span>
            ) : (
              'Fire Action'
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

              {results.results.length === 0 ? (
                <div className="text-sm text-zinc-500 bg-zinc-950 rounded p-4 text-center">
                  No integrations configured for this client
                </div>
              ) : (
                <div className="space-y-3">
                  {results.results.map((r, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-950 rounded p-4"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon success={r.result.success} />
                        <span className="font-medium text-white uppercase text-sm">
                          {r.integration}
                        </span>
                      </div>
                      <div
                        className={`text-xs ${
                          r.result.success ? 'text-zinc-400' : 'text-red-400'
                        }`}
                      >
                        {getResultMessage(r)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Overall Status */}
              <div className={`mt-4 text-sm font-medium text-center ${
                results.allSucceeded ? 'text-green-400' : 'text-red-400'
              }`}>
                {results.allSucceeded
                  ? '✓ All integrations succeeded'
                  : '✗ Some integrations failed'}
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
  clientId,
  isDropdownItem = false 
}: { 
  clientId: string;
  isDropdownItem?: boolean;
}) {
  const [showModal, setShowModal] = useState(false);

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
          Test Suite
        </button>

        {showModal && (
          <TestSuiteDialog clientId={clientId} onClose={() => setShowModal(false)} />
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
        Test Suite
      </button>

      {showModal && (
        <TestSuiteDialog clientId={clientId} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

