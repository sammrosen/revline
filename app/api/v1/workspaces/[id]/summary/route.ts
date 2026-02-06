import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';

// GET /api/v1/workspaces/[id]/summary - Get lightweight workspace summary for sidebar
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify user has access to this workspace
  const access = await getWorkspaceAccess(userId, id);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Fetch workspace with counts in parallel
  const [workspace, counts] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    }),
    prisma.$transaction([
      prisma.workflow.count({ where: { workspaceId: id } }),
      prisma.workspaceIntegration.count({ where: { workspaceId: id } }),
      prisma.lead.count({ where: { workspaceId: id } }),
      prisma.event.count({ where: { workspaceId: id } }),
    ]),
  ]);

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    status: workspace.status,
    counts: {
      workflows: counts[0],
      integrations: counts[1],
      leads: counts[2],
      events: counts[3],
    },
  });
}
