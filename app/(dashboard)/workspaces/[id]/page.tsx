import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import { WorkspaceTabs } from './workspace-tabs';
import { IntegrationType } from '@prisma/client';
import { MailerLiteMeta, isMailerLiteMeta, StripeMeta } from '@/app/_lib/types';

export const dynamic = 'force-dynamic';

async function getWorkspace(id: string) {
  // Run queries in parallel for better performance
  const [workspace, eventCount, workflows] = await Promise.all([
    prisma.workspace.findUnique({
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
    }),
    prisma.event.count({ where: { workspaceId: id } }),
    prisma.workflow.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    }),
  ]);

  if (!workspace) {
    return null;
  }

  return {
    ...workspace,
    eventCount,
    workflows,
  };
}

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getWorkspace(id);

  if (!workspace) {
    notFound();
  }


  // Get MailerLite groups if configured
  const mailerliteIntegration = workspace.integrations.find(
    (i) => i.integration === IntegrationType.MAILERLITE
  );
  const mailerliteMeta = mailerliteIntegration?.meta as MailerLiteMeta | null;
  const mailerliteGroups = isMailerLiteMeta(mailerliteMeta)
    ? mailerliteMeta.groups
    : {};

  // Get Stripe products if configured
  // Support both 'productMap' (official) and 'products' (legacy) field names
  const stripeIntegration = workspace.integrations.find(
    (i) => i.integration === IntegrationType.STRIPE
  );
  const stripeMeta = stripeIntegration?.meta as StripeMeta & { products?: Record<string, string> } | null;
  const stripeProducts = stripeMeta?.productMap 
    ?? stripeMeta?.products  // fallback for legacy data
    ?? {};

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Compact Header */}
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-white">{workspace.name}</h1>
          <span className="text-zinc-500 font-mono text-xs bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-800/50">{workspace.slug}</span>
        </div>

        {/* Tabbed Content */}
        <WorkspaceTabs
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          integrations={workspace.integrations.map((i) => ({
            id: i.id,
            integration: i.integration,
            healthStatus: i.healthStatus,
            lastSeenAt: i.lastSeenAt,
            meta: i.meta,
            secrets: (i as { secrets?: unknown }).secrets ?? null,
            createdAt: i.createdAt,
          }))}
          events={workspace.events}
          eventCount={workspace.eventCount}
          leads={workspace.leads}
          workflows={workspace.workflows.map((w: typeof workspace.workflows[0]) => ({
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
          configuredIntegrations={workspace.integrations.map((i) => i.integration)}
          mailerliteGroups={mailerliteGroups}
          stripeProducts={stripeProducts}
          timezone={workspace.timezone}
          domainConfig={{
            customDomain: workspace.customDomain ?? null,
            domainVerifyToken: workspace.domainVerifyToken ?? null,
            domainVerified: workspace.domainVerified ?? false,
            domainVerifiedAt: workspace.domainVerifiedAt?.toISOString() ?? null,
          }}
        />
      </div>
    </div>
  );
}
