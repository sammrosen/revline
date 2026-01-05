import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import Link from 'next/link';
import { ClientActions } from '../client-actions';
import { DeleteClientButton } from './delete-client-button';
import { HealthCheckButton } from './health-check-button';
import { TestNotificationButton } from './test-notification-button';
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
  // Middleware handles auth - if we reach here, user is authenticated
  const { id } = await params;
  const client = await getClient(id);

  if (!client) {
    notFound();
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex gap-4 mb-2">
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
              📋 Onboarding Guide
            </Link>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <p className="text-zinc-400 font-mono">{client.slug}</p>
            </div>
            <div className="flex gap-3">
              <HealthCheckButton clientId={client.id} />
              <TestNotificationButton clientId={client.id} />
              <ClientActions clientId={client.id} currentStatus={client.status} />
              <DeleteClientButton clientId={client.id} clientName={client.name} />
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

