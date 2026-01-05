import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import Link from 'next/link';
import { ClientActionsDropdown } from './client-actions-dropdown';
import { ClientTabs } from './client-tabs';

export const dynamic = 'force-dynamic';

async function getClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      integrations: {
        select: {
          id: true,
          integration: true,
          healthStatus: true,
          lastSeenAt: true,
          meta: true,
          secrets: true,
          createdAt: true,
        },
      },
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
          integrations={client.integrations}
          events={client.events}
          leads={client.leads}
        />
      </div>
    </div>
  );
}




