import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import Link from 'next/link';
import { WorkflowList } from './workflow-list';

export const dynamic = 'force-dynamic';

async function getClientWithWorkflows(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      integrations: {
        select: {
          integration: true,
        },
      },
    },
  });

  if (!client) {
    return null;
  }

  // Fetch workflows separately to avoid Prisma type issues
  const workflows = await prisma.workflow.findMany({
    where: { clientId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { executions: true },
      },
    },
  });

  return {
    ...client,
    workflows,
  };
}

export default async function WorkflowsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientWithWorkflows(id);

  if (!client) {
    notFound();
  }

  // Get configured integrations for the UI
  const configuredIntegrations = client.integrations.map((i) => i.integration);

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4 mb-4">
            <Link
              href={`/admin/clients/${client.id}`}
              className="text-zinc-400 hover:text-white text-sm inline-block"
            >
              ← Back to {client.name}
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Workflows
              </h1>
              <p className="text-zinc-500 text-sm">
                Automate actions when events occur
              </p>
            </div>
            <div>
              <Link
                href={`/admin/clients/${client.id}/workflows/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Workflow
              </Link>
            </div>
          </div>
        </div>

        {/* Workflow List */}
        <WorkflowList
          clientId={client.id}
          workflows={client.workflows.map((w: typeof client.workflows[0]) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            enabled: w.enabled,
            triggerAdapter: w.triggerAdapter,
            triggerOperation: w.triggerOperation,
            actions: (w.actions as Array<{ adapter: string; operation: string; params: Record<string, unknown> }>) || [],
            actionsCount: (w.actions as unknown[])?.length || 0,
            totalExecutions: w._count.executions,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
          }))}
          configuredIntegrations={configuredIntegrations}
        />
      </div>
    </div>
  );
}

