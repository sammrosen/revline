'use client';

import { useState, useEffect } from 'react';
import { lockScroll, unlockScroll } from '@/app/_lib/utils/scroll-lock';

type TestStatus = 'PASS' | 'WARN' | 'FAIL';
type TestCategory = 'configuration' | 'api_connectivity' | 'system_metrics';

interface TestResult {
  category: TestCategory;
  name: string;
  status: TestStatus;
  message: string;
  duration: number;
}

interface SystemMetrics {
  webhooks: {
    pending: number;
    processing: number;
    failed: number;
    oldestPendingMinutes: number | null;
  };
  events: {
    totalLastHour: number;
    failedLastHour: number;
    errorRatePercent: number;
  };
  workflows: {
    failedLastHour: number;
    runningNow: number;
  };
  collectedAt: string;
}

interface HealthCheckResponse {
  workspaceId: string;
  clientName: string;
  clientSlug: string;
  timestamp: string;
  overallStatus: TestStatus;
  duration: number;
  tests: TestResult[];
  metrics?: SystemMetrics;
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

function TestSection({ 
  title, 
  tests, 
  titleColor = 'text-zinc-300' 
}: { 
  title: string; 
  tests: TestResult[];
  titleColor?: string;
}) {
  if (tests.length === 0) return null;
  
  return (
    <div>
      <h3 className={`text-sm font-semibold mb-3 ${titleColor}`}>{title}</h3>
      <div className="space-y-3">
        {tests.map((test, idx) => (
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
  );
}

function HealthCheckDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runHealthCheck() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/health-check`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setResults(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to run health check';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const configTests = results?.tests.filter((t) => t.category === 'configuration') ?? [];
  const apiTests = results?.tests.filter((t) => t.category === 'api_connectivity') ?? [];
  const metricsTests = results?.tests.filter((t) => t.category === 'system_metrics') ?? [];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Health Check</h2>
            {results && <StatusBadge status={results.overallStatus} />}
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
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Description */}
          <p className="text-sm text-zinc-400">
            Run a comprehensive health check to verify client configuration, API connectivity, 
            and system metrics. This will test integrations and check for any issues.
          </p>

          {/* Run Button (shown when no results) */}
          {!results && !loading && (
            <button
              onClick={runHealthCheck}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
            >
              Run Health Check
            </button>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <svg
                className="animate-spin h-5 w-5 text-zinc-400"
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
              <span className="text-zinc-400">Running health check...</span>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-sm text-red-400">
              <div className="font-medium mb-1">Health check failed</div>
              <div className="text-xs opacity-80">{error}</div>
            </div>
          )}

          {/* Results */}
          {results && (
            <>
              {/* Summary */}
              <div className="flex items-center justify-between text-sm text-zinc-400 bg-zinc-950 rounded-lg p-3">
                <span>
                  Client: <span className="text-white font-medium">{results.clientName}</span>
                </span>
                <span>Completed in {(results.duration / 1000).toFixed(1)}s</span>
              </div>

              {/* Configuration Tests */}
              <TestSection title="Configuration Tests" tests={configTests} />

              {/* API Connectivity Tests */}
              <TestSection title="API Connectivity Tests" tests={apiTests} />

              {/* System Metrics Tests */}
              <TestSection 
                title="System Metrics" 
                tests={metricsTests} 
                titleColor="text-blue-400"
              />

              {/* Re-run Button */}
              <button
                onClick={runHealthCheck}
                disabled={loading}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Running...' : 'Run Again'}
              </button>
            </>
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

export function HealthCheckButton({ 
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
          Run Health Check
        </button>

        {showModal && (
          <HealthCheckDialog workspaceId={workspaceId} onClose={() => setShowModal(false)} />
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
        Run Health Check
      </button>

      {showModal && (
        <HealthCheckDialog workspaceId={workspaceId} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
