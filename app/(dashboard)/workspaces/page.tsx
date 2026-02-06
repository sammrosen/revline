import { prisma } from '@/app/_lib/db';
import { HealthStatus } from '@prisma/client';
import Link from 'next/link';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getUserWorkspaces } from '@/app/_lib/workspace-access';

export const dynamic = 'force-dynamic';

async function getWorkspacesForUser(userId: string) {
  // Get workspaces user has access to (direct + org-level)
  const accessibleWorkspaces = await getUserWorkspaces(userId);
  const workspaceIds = accessibleWorkspaces.map((w) => w.id);

  // Fetch workspace details with integrations and events
  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: workspaceIds } },
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
    orderBy: { name: 'asc' },
  });

  return workspaces.map((workspace) => {
    const integrationHealth = workspace.integrations.map((i) => i.healthStatus);
    let derivedHealth: HealthStatus = HealthStatus.GREEN;

    if (integrationHealth.includes(HealthStatus.RED)) {
      derivedHealth = HealthStatus.RED;
    } else if (integrationHealth.includes(HealthStatus.YELLOW)) {
      derivedHealth = HealthStatus.YELLOW;
    }

    // Find the user's role for this workspace
    const accessInfo = accessibleWorkspaces.find((w) => w.id === workspace.id);

    return {
      ...workspace,
      derivedHealth,
      lastEventAt: workspace.events[0]?.createdAt || null,
      userRole: accessInfo?.userRole,
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
  const userId = await getUserIdFromHeaders();
  
  if (!userId) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-zinc-500">
          Please log in to view workspaces.
        </div>
      </div>
    );
  }

  const workspaces = await getWorkspacesForUser(userId);

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Workspaces</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage your client workspaces and integrations
            </p>
          </div>
          <Link
            href="/workspaces/new"
            className="px-4 py-2 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors text-sm font-medium"
          >
            Add Workspace
          </Link>
        </div>

        {workspaces.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-zinc-500 mb-4">
              No workspaces yet. Add your first workspace to get started.
            </div>
            <Link
              href="/workspaces/new"
              className="inline-block px-4 py-2 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors text-sm font-medium"
            >
              Create Workspace
            </Link>
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
