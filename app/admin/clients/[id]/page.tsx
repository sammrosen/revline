import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import Link from 'next/link';
import { ClientActionsDropdown } from './client-actions-dropdown';
import { ClientTabs } from './client-tabs';
import { IntegrationType } from '@prisma/client';
import { MailerLiteMeta, isMailerLiteMeta } from '@/app/_lib/types';

export const dynamic = 'force-dynamic';

async function getClient(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      integrations: true,
      events: {
        take: 50,
        orderBy: { createdAt: 'desc' },
      },
      leads: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          stage: true,
          source: true,
          lastEventAt: true,
          createdAt: true,
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

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) {
    notFound();
  }


  // Get MailerLite groups if configured
  const mailerliteIntegration = client.integrations.find(
    (i) => i.integration === IntegrationType.MAILERLITE
  );
  const mailerliteMeta = mailerliteIntegration?.meta as MailerLiteMeta | null;
  const mailerliteGroups = isMailerLiteMeta(mailerliteMeta)
    ? mailerliteMeta.groups
    : {};

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4 mb-4">
            <Link
              href="/admin/clients"
              className="text-zinc-400 hover:text-white text-sm inline-block"
            >
              ← Back to Clients
            </Link>
            <Link
              href="/admin/onboarding"
              className="text-zinc-400 hover:text-white text-sm inline-block"
            >
              Onboarding Guide
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 relative">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-white">{client.name}</h1>
              <p className="text-zinc-500 font-mono text-xs bg-zinc-900/50 w-fit px-2 py-0.5 rounded border border-zinc-800/50">{client.slug}</p>
            </div>
            <div className="flex items-center justify-end">
              <ClientActionsDropdown 
                clientId={client.id} 
                clientName={client.name}
                currentStatus={client.status}
              />
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <ClientTabs
          clientId={client.id}
          integrations={client.integrations.map((i) => ({
            id: i.id,
            integration: i.integration,
            healthStatus: i.healthStatus,
            lastSeenAt: i.lastSeenAt,
            meta: i.meta,
            secrets: (i as { secrets?: unknown }).secrets ?? null,
            createdAt: i.createdAt,
          }))}
          events={client.events}
          leads={client.leads}
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
          configuredIntegrations={client.integrations.map((i) => i.integration)}
          mailerliteGroups={mailerliteGroups}
        />
      </div>
    </div>
  );
}




