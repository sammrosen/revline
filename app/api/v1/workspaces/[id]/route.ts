import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { pauseClient, unpauseClient } from '@/app/_lib/client-gate';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { LeadStageDefinition } from '@/app/_lib/types';
import { Prisma } from '@prisma/client';

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

  // Handle lead stages update
  if (body.leadStages !== undefined) {
    const stages = body.leadStages as LeadStageDefinition[];

    // Validate structure
    if (!Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ error: 'leadStages must be a non-empty array' }, { status: 400 });
    }

    // Validate each stage has required fields
    for (const stage of stages) {
      if (!stage.key || typeof stage.key !== 'string') {
        return NextResponse.json({ error: 'Each stage must have a string key' }, { status: 400 });
      }
      if (!stage.label || typeof stage.label !== 'string') {
        return NextResponse.json({ error: 'Each stage must have a string label' }, { status: 400 });
      }
      if (!stage.color || typeof stage.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(stage.color)) {
        return NextResponse.json({ error: `Invalid color for stage "${stage.label}". Must be a hex color like #3B82F6` }, { status: 400 });
      }
    }

    // Enforce CAPTURED as the first stage
    if (stages[0].key !== 'CAPTURED') {
      return NextResponse.json({ error: 'CAPTURED must be the first stage' }, { status: 400 });
    }

    // Enforce unique keys
    const keys = stages.map(s => s.key);
    if (new Set(keys).size !== keys.length) {
      return NextResponse.json({ error: 'Stage keys must be unique' }, { status: 400 });
    }

    // Check that no removed stages have existing leads
    const currentWorkspace = await prisma.workspace.findUnique({
      where: { id },
      select: { leadStages: true },
    });
    const currentStages = (currentWorkspace?.leadStages as LeadStageDefinition[] | null) ?? [];
    const currentKeys = currentStages.map(s => s.key);
    const removedKeys = currentKeys.filter(k => !keys.includes(k));

    if (removedKeys.length > 0) {
      const leadsInRemovedStages = await prisma.lead.count({
        where: {
          workspaceId: id,
          stage: { in: removedKeys },
        },
      });

      if (leadsInRemovedStages > 0) {
        return NextResponse.json({
          error: `Cannot remove stages that have existing leads. Move or delete leads in: ${removedKeys.join(', ')}`,
        }, { status: 400 });
      }
    }

    await prisma.workspace.update({
      where: { id },
      data: { leadStages: stages as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({ success: true, leadStages: stages });
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
