import { redirect, notFound } from 'next/navigation';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { HealthStatus } from '@prisma/client';
import Link from 'next/link';
import { ClientActions } from '../client-actions';
import { AddIntegrationForm } from './add-integration-form';

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
        where: {
          stage: 'CAPTURED',
          lastEventAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        take: 20,
        orderBy: { lastEventAt: 'asc' },
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

function formatDate(date: Date | string | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const client = await getClient(id);

  if (!client) {
    notFound();
  }

  const stuckLeads = client.leads;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/clients"
            className="text-zinc-400 hover:text-white text-sm mb-2 inline-block"
          >
            ← Back to Clients
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <p className="text-zinc-400 font-mono">{client.slug}</p>
            </div>
            <ClientActions clientId={client.id} currentStatus={client.status} />
          </div>
        </div>

        {/* Integrations */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {client.integrations.map((integration) => (
              <div
                key={integration.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">{integration.integration}</span>
                  <HealthBadge status={integration.healthStatus} />
                </div>
                <div className="text-sm text-zinc-400">
                  Last seen: {formatDate(integration.lastSeenAt)}
                </div>
                {integration.meta && (
                  <pre className="mt-2 text-xs bg-zinc-950 p-2 rounded overflow-x-auto">
                    {JSON.stringify(integration.meta, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
          <AddIntegrationForm clientId={client.id} />
        </div>

        {/* Stuck Leads */}
        {stuckLeads.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-yellow-400">
              Stuck Leads ({stuckLeads.length})
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-400">
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium">Last Event</th>
                  </tr>
                </thead>
                <tbody>
                  {stuckLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-zinc-800 last:border-0">
                      <td className="px-4 py-2 font-mono">{lead.email}</td>
                      <td className="px-4 py-2 text-zinc-400">{lead.source || '—'}</td>
                      <td className="px-4 py-2 text-zinc-400">
                        {formatDate(lead.lastEventAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Events */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Events (Last 50)</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">System</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {client.events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      No events yet
                    </td>
                  </tr>
                ) : (
                  client.events.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                        {formatDate(event.createdAt)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{event.system}</td>
                      <td className="px-4 py-2">{event.eventType}</td>
                      <td className="px-4 py-2">
                        {event.success ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-red-400">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-red-400 text-xs truncate max-w-xs">
                        {event.errorMessage || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

