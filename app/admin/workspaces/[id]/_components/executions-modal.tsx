'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface Execution {
  id: string;
  status: string;
  triggerAdapter: string;
  triggerOperation: string;
  triggerPayload: Record<string, unknown>;
  actionResults: Array<{
    action: { adapter: string; operation: string };
    result: { success: boolean };
  }> | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface ExecutionsModalProps {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}

function formatDuration(startedAt: string, completedAt: string | null) {
  if (!completedAt) return '—';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function ExecutionsModal({
  workflowId,
  workflowName,
  onClose,
}: ExecutionsModalProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExecutions() {
      try {
        const response = await fetch(`/api/v1/admin/workflows/${workflowId}/executions`);
        if (!response.ok) {
          throw new Error('Failed to load executions');
        }
        const data = await response.json();
        setExecutions(data.data?.executions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    fetchExecutions();
  }, [workflowId]);

  const completedCount = executions.filter((e) => e.status === 'COMPLETED').length;
  const failedCount = executions.filter((e) => e.status === 'FAILED').length;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center p-0 sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Execution History</h2>
            <p className="text-sm text-zinc-500">{workflowName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-zinc-800">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{executions.length}</div>
              <div className="text-xs text-zinc-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{completedCount}</div>
              <div className="text-xs text-zinc-500">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{failedCount}</div>
              <div className="text-xs text-zinc-500">Failed</div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="px-6 py-8 text-center text-red-400">{error}</div>
          )}

          {!loading && !error && executions.length === 0 && (
            <div className="px-6 py-12 text-center text-zinc-500">
              No executions yet
            </div>
          )}

          {!loading && !error && executions.length > 0 && (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="sticky top-0 bg-zinc-900">
                  <tr className="border-b border-zinc-800 text-left text-zinc-400">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Trigger</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution) => (
                    <ExecutionRow key={execution.id} execution={execution} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExecutionRow({ execution }: { execution: Execution }) {
  const email = execution.triggerPayload?.email as string | undefined;

  return (
    <tr className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50">
      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
        {formatDate(execution.startedAt)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
            execution.status === 'COMPLETED'
              ? 'bg-green-500/10 text-green-400'
              : execution.status === 'FAILED'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-yellow-500/10 text-yellow-400'
          }`}
        >
          {execution.status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
          {execution.status === 'FAILED' && <XCircle className="w-3 h-3" />}
          {execution.status === 'RUNNING' && <Clock className="w-3 h-3" />}
          {execution.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="text-white">
          {execution.triggerAdapter}.{execution.triggerOperation}
        </div>
        {email && <div className="text-xs text-zinc-500">{email}</div>}
      </td>
      <td className="px-4 py-3 text-zinc-400">
        {formatDuration(execution.startedAt, execution.completedAt)}
      </td>
      <td className="px-4 py-3">
        {execution.error ? (
          <span className="text-red-400 text-xs truncate max-w-xs block">
            {execution.error}
          </span>
        ) : (
          <ExecutionDetails actionResults={execution.actionResults} />
        )}
      </td>
    </tr>
  );
}

function ExecutionDetails({
  actionResults,
}: {
  actionResults: Execution['actionResults'];
}) {
  if (!actionResults || actionResults.length === 0) {
    return <span className="text-zinc-500 text-xs">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {actionResults.map((r, i) => (
        <span
          key={i}
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
            r.result.success
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
          title={`${r.action.adapter}.${r.action.operation}: ${
            r.result.success ? 'success' : 'failed'
          }`}
        >
          {r.result.success ? '✓' : '✗'}
        </span>
      ))}
    </div>
  );
}

