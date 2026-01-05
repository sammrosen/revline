'use client';

import { useState } from 'react';

type TestStatus = 'PASS' | 'WARN' | 'FAIL';
type TestCategory = 'configuration' | 'api_connectivity';

interface TestResult {
  category: TestCategory;
  name: string;
  status: TestStatus;
  message: string;
  duration: number;
}

interface HealthCheckResponse {
  clientId: string;
  clientName: string;
  clientSlug: string;
  timestamp: string;
  overallStatus: TestStatus;
  duration: number;
  tests: TestResult[];
}

function StatusIcon({ status }: { status: TestStatus }) {
  switch (status) {
    case 'PASS':
      return <span className="text-green-400">✓</span>;
    case 'WARN':
      return <span className="text-yellow-400">⚠</span>;
    case 'FAIL':
      return <span className="text-red-400">✗</span>;
  }
}

function StatusBadge({ status }: { status: TestStatus }) {
  const colors = {
    PASS: 'bg-green-500/20 text-green-400',
    WARN: 'bg-yellow-500/20 text-yellow-400',
    FAIL: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-3 py-1 text-sm rounded font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

function HealthCheckDialog({
  results,
  onClose,
}: {
  results: HealthCheckResponse;
  onClose: () => void;
}) {
  const configTests = results.tests.filter((t) => t.category === 'configuration');
  const apiTests = results.tests.filter((t) => t.category === 'api_connectivity');

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Health Check Results</h2>
            <StatusBadge status={results.overallStatus} />
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
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>
              Client: <span className="text-white font-medium">{results.clientName}</span>
            </span>
            <span>Completed in {(results.duration / 1000).toFixed(1)}s</span>
          </div>

          {/* Configuration Tests */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Configuration Tests</h3>
            <div className="space-y-3">
              {configTests.map((test, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 text-sm bg-zinc-950 rounded p-3"
                >
                  <StatusIcon status={test.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{test.name}</span>
                      <span className="text-zinc-500 text-xs">({test.duration}ms)</span>
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        test.status === 'PASS'
                          ? 'text-zinc-400'
                          : test.status === 'WARN'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {test.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Connectivity Tests */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">API Connectivity Tests</h3>
            <div className="space-y-3">
              {apiTests.map((test, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 text-sm bg-zinc-950 rounded p-3"
                >
                  <StatusIcon status={test.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{test.name}</span>
                      <span className="text-zinc-500 text-xs">({test.duration}ms)</span>
                    </div>
                    <div
                      className={`text-xs mt-1 break-words ${
                        test.status === 'PASS'
                          ? 'text-zinc-400'
                          : test.status === 'WARN'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {test.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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

export function HealthCheckButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRunTime, setLastRunTime] = useState<number>(0);

  async function runHealthCheck() {
    // Rate limiting: prevent spam clicking (1 minute cooldown)
    const now = Date.now();
    const timeSinceLastRun = now - lastRunTime;
    if (timeSinceLastRun < 60000 && lastRunTime > 0) {
      const secondsRemaining = Math.ceil((60000 - timeSinceLastRun) / 1000);
      setError(`Please wait ${secondsRemaining}s before running again`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/health-check`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setResults(data);
      setLastRunTime(now);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to run health check';
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  function closeDialog() {
    setResults(null);
  }

  return (
    <>
      <button
        onClick={runHealthCheck}
        disabled={loading}
        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
          loading
            ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
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
            Running Tests...
          </span>
        ) : (
          'Run Health Check'
        )}
      </button>

      {error && (
        <div className="fixed top-4 right-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-sm text-red-400 z-50 max-w-md">
          {error}
        </div>
      )}

      {results && <HealthCheckDialog results={results} onClose={closeDialog} />}
    </>
  );
}

