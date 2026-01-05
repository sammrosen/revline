import { prisma } from '@/app/_lib/db';
import { HealthStatus } from '@prisma/client';
import Link from 'next/link';
import { ClientActions } from './client-actions';

export const dynamic = 'force-dynamic';

async function getClients() {
  const clients = await prisma.client.findMany({
    include: {
      integrations: {
        select: {
          integration: true,
          healthStatus: true,
          lastSeenAt: true,
        },
      },
      events: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return clients.map((client) => {
    const integrationHealth = client.integrations.map((i) => i.healthStatus);
    let derivedHealth: HealthStatus = HealthStatus.GREEN;

    if (integrationHealth.includes(HealthStatus.RED)) {
      derivedHealth = HealthStatus.RED;
    } else if (integrationHealth.includes(HealthStatus.YELLOW)) {
      derivedHealth = HealthStatus.YELLOW;
    }

    return {
      ...client,
      derivedHealth,
      lastEventAt: client.events[0]?.createdAt || null,
    };
  });
}

function HealthBadge({ status }: { status: HealthStatus }) {
  const colors = {
    GREEN: 'bg-green-500/20 text-green-400',
    YELLOW: 'bg-yellow-500/20 text-yellow-400',
    RED: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded ${colors[status]}`}>
      {status}
    </span>
  );
}

function StatusBadge({ status }: { status: 'ACTIVE' | 'PAUSED' }) {
  const colors = {
    ACTIVE: 'bg-green-500/20 text-green-400',
    PAUSED: 'bg-zinc-500/20 text-zinc-400',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded ${colors[status]}`}>
      {status}
    </span>
  );
}

function formatDate(date: Date | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default async function AdminClientsPage() {
  // Middleware handles auth - if we reach here, user is authenticated
  const clients = await getClients();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Clients</h1>
          <div className="flex gap-3">
            <Link
              href="/admin/onboarding"
              className="px-4 py-2 border border-zinc-700 text-white rounded hover:border-zinc-600 transition-colors text-sm font-medium"
            >
              Onboarding Guide
            </Link>
            <Link
              href="/admin/clients/new"
              className="px-4 py-2 bg-white text-black rounded hover:bg-zinc-200 transition-colors text-sm font-medium"
            >
              Add Client
            </Link>
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            No clients yet. Add your first client to get started.
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                  <th className="px-4 py-3 font-medium">Last Event</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-white hover:underline"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-sm">
                      {client.slug}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="px-4 py-3">
                      <HealthBadge status={client.derivedHealth} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {formatDate(client.lastEventAt)}
                    </td>
                    <td className="px-4 py-3">
                      <ClientActions
                        clientId={client.id}
                        currentStatus={client.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

