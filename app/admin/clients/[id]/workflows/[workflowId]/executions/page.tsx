import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getExecutionsData(clientId: string, workflowId: string) {
  const [client, workflow, executions] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    }),
    prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, name: true, clientId: true },
    }),
    prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    }),
  ]);

  return { client, workflow, executions };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}

function formatDuration(startedAt: Date, completedAt: Date | null) {
  if (!completedAt) return '—';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function ExecutionsPage({
  params,
}: {
  params: Promise<{ id: string; workflowId: string }>;
}) {
  const { id, workflowId } = await params;
  const { client, workflow, executions } = await getExecutionsData(id, workflowId);

  if (!client || !workflow) {
    notFound();
  }

  // Verify workflow belongs to this client
  if (workflow.clientId !== client.id) {
    notFound();
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4 mb-4">
            <Link
              href={`/admin/clients/${client.id}/workflows`}
              className="text-zinc-400 hover:text-white text-sm inline-block"
            >
              ← Back to Workflows
            </Link>
            <Link
              href={`/admin/clients/${client.id}/workflows/${workflow.id}`}
              className="text-zinc-400 hover:text-white text-sm inline-block"
            >
              Edit Workflow
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Execution History
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{workflow.name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{executions.length}</div>
            <div className="text-sm text-zinc-500">Total Executions</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">
              {executions.filter((e) => e.status === 'COMPLETED').length}
            </div>
            <div className="text-sm text-zinc-500">Successful</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-400">
              {executions.filter((e) => e.status === 'FAILED').length}
            </div>
            <div className="text-sm text-zinc-500">Failed</div>
          </div>
        </div>

        {/* Executions Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Trigger</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No executions yet
                  </td>
                </tr>
              ) : (
                executions.map((execution) => (
                  <ExecutionRow key={execution.id} execution={execution} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EXECUTION ROW COMPONENT
// =============================================================================

interface ExecutionRowProps {
  execution: {
    id: string;
    status: string;
    triggerAdapter: string;
    triggerOperation: string;
    triggerPayload: unknown;
    actionResults: unknown;
    error: string | null;
    startedAt: Date;
    completedAt: Date | null;
  };
}

function ExecutionRow({ execution }: ExecutionRowProps) {
  const payload = execution.triggerPayload as Record<string, unknown>;
  const email = payload?.email as string | undefined;

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
          {execution.status === 'COMPLETED' && '✓'}
          {execution.status === 'FAILED' && '✗'}
          {execution.status === 'RUNNING' && '◌'}
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

function ExecutionDetails({ actionResults }: { actionResults: unknown }) {
  if (!actionResults || !Array.isArray(actionResults)) {
    return <span className="text-zinc-500 text-xs">—</span>;
  }

  const results = actionResults as Array<{
    action: { adapter: string; operation: string };
    result: { success: boolean };
  }>;

  return (
    <div className="flex items-center gap-1">
      {results.map((r, i) => (
        <span
          key={i}
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
            r.result.success
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
          title={`${r.action.adapter}.${r.action.operation}: ${r.result.success ? 'success' : 'failed'}`}
        >
          {r.result.success ? '✓' : '✗'}
        </span>
      ))}
    </div>
  );
}


