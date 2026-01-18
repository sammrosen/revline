import { prisma } from '@/app/_lib/db';
import { HealthStatus } from '@prisma/client';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getWorkspaces() {
  const workspaces = await prisma.workspace.findMany({
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

  return workspaces.map((workspace) => {
    const integrationHealth = workspace.integrations.map((i) => i.healthStatus);
    let derivedHealth: HealthStatus = HealthStatus.GREEN;

    if (integrationHealth.includes(HealthStatus.RED)) {
      derivedHealth = HealthStatus.RED;
    } else if (integrationHealth.includes(HealthStatus.YELLOW)) {
      derivedHealth = HealthStatus.YELLOW;
    }

    return {
      ...workspace,
      derivedHealth,
      lastEventAt: workspace.events[0]?.createdAt || null,
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

export default async function AdminWorkspacesPage() {
  // Middleware handles auth - if we reach here, user is authenticated
  const workspaces = await getWorkspaces();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              href="/onboarding"
              className="px-4 py-2 border border-zinc-700 text-white rounded hover:border-zinc-600 transition-colors text-sm font-medium"
            >
              Onboarding Guide
            </Link>
            <Link
              href="/workspaces/new"
              className="px-4 py-2 bg-white text-black rounded hover:bg-zinc-200 transition-colors text-sm font-medium"
            >
              Add Workspace
            </Link>
            <Link
              href="/settings"
              className="px-4 py-2 border border-zinc-700 text-white rounded hover:border-zinc-600 transition-colors text-sm font-medium"
            >
              Settings
            </Link>
            <Link
              href="/api/auth/logout"
              className="px-4 py-2 border border-zinc-700 text-zinc-400 rounded hover:border-zinc-600 hover:text-white transition-colors text-sm font-medium"
            >
              Sign Out
            </Link>
          </div>
        </div>

        {workspaces.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            No workspaces yet. Add your first workspace to get started.
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                  <th className="px-4 py-3 font-medium">Last Event</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <tr
                    key={workspace.id}
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/workspaces/${workspace.id}`}
                        className="block group"
                      >
                        <div className="text-white group-hover:underline">
                          {workspace.name}
                        </div>
                        <div className="text-zinc-500 font-mono text-xs mt-0.5">
                          /{workspace.slug}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={workspace.status} />
                    </td>
                    <td className="px-4 py-3">
                      <HealthBadge status={workspace.derivedHealth} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {formatDate(workspace.lastEventAt)}
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
