import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { pauseClient, unpauseClient } from '@/app/_lib/client-gate';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

// GET /api/v1/workspaces/[id] - Get workspace details with events
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Middleware handles auth - if we reach here, user is authenticated
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

  // Run workspace query and event count in parallel
  const [workspace, eventCount] = await Promise.all([
    prisma.workspace.findUnique({
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
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h ago
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
    }),
    prisma.event.count({ where: { workspaceId: id } }),
  ]);

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...workspace,
    userRole: access.role,
    eventCount, // Total event count for "X of Y" display
    stuckLeads: workspace.leads,
    leads: undefined, // Remove full leads from response
  });
}

// PATCH /api/v1/workspaces/[id] - Update workspace (pause/unpause or settings)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Middleware handles auth - if we reach here, user is authenticated
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify user has ADMIN or higher access to this workspace
  const access = await getWorkspaceAccess(userId, id);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  
  if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { action, timezone } = body;

  // Handle pause/unpause actions
  if (action === 'pause') {
    await pauseClient(id);
    return NextResponse.json({ success: true, status: 'PAUSED' });
  }

  if (action === 'unpause') {
    await unpauseClient(id);
    return NextResponse.json({ success: true, status: 'ACTIVE' });
  }

  // Handle settings updates (timezone, etc.)
  if (timezone !== undefined) {
    // Validate timezone is a valid IANA timezone
    const validTimezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'America/Phoenix',
      'UTC',
    ];
    
    if (!validTimezones.includes(timezone)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
    }

    await prisma.workspace.update({
      where: { id },
      data: { timezone },
    });

    return NextResponse.json({ success: true, timezone });
  }

  return NextResponse.json({ error: 'Invalid action or missing fields' }, { status: 400 });
}

// DELETE /api/v1/workspaces/[id] - Delete workspace (cascade deletes integrations, leads, events)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Middleware handles auth - if we reach here, user is authenticated
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify user has OWNER access to this workspace (only owners can delete)
  const access = await getWorkspaceAccess(userId, id);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  
  if (access.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: 'Only workspace owners can delete workspaces' }, { status: 403 });
  }

  try {
    // Get workspace name for logging
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Hard delete - Prisma cascade will handle related records (integrations, leads, events)
    await prisma.workspace.delete({
      where: { id },
    });

    console.log(`[ADMIN] Deleted workspace: ${workspace.name} (${id}) by user ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
