import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { HealthStatus, WorkspaceRole } from '@prisma/client';

// GET /api/v1/workspaces - List workspaces user has access to
export async function GET() {
  // Middleware handles auth - if we reach here, user is authenticated
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    // This should not happen if middleware is working correctly
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only return workspaces the user has membership to
  const workspaces = await prisma.workspace.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        where: { userId },
        select: { role: true },
      },
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

  // Derive workspace-level health from integrations
  const workspacesWithHealth = workspaces.map((workspace) => {
    const integrationHealth = workspace.integrations.map((i) => i.healthStatus);
    let derivedHealth: HealthStatus = HealthStatus.GREEN;
    
    if (integrationHealth.includes(HealthStatus.RED)) {
      derivedHealth = HealthStatus.RED;
    } else if (integrationHealth.includes(HealthStatus.YELLOW)) {
      derivedHealth = HealthStatus.YELLOW;
    }

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
      timezone: workspace.timezone,
      createdAt: workspace.createdAt,
      derivedHealth,
      userRole: workspace.members[0]?.role ?? null,
      integrations: workspace.integrations,
      lastEventAt: workspace.events[0]?.createdAt || null,
    };
  });

  return NextResponse.json(workspacesWithHealth);
}

// POST /api/v1/workspaces - Create a new workspace
export async function POST(request: NextRequest) {
  // Middleware handles auth - if we reach here, user is authenticated
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    // This should not happen if middleware is working correctly
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, slug, timezone } = body;

    if (!name || !slug || !timezone) {
      return NextResponse.json(
        { error: 'Name, slug, and timezone are required' },
        { status: 400 }
      );
    }

    // Create workspace and membership in a transaction
    const workspace = await prisma.$transaction(async (tx) => {
      // Create the workspace
      const newWorkspace = await tx.workspace.create({
        data: {
          name,
          slug: slug.toLowerCase(),
          timezone,
          createdById: userId,
        },
      });

      // Create OWNER membership for the creating user
      await tx.workspaceMember.create({
        data: {
          userId,
          workspaceId: newWorkspace.id,
          role: WorkspaceRole.OWNER,
        },
      });

      return newWorkspace;
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Workspace with this slug already exists' },
        { status: 400 }
      );
    }
    throw error;
  }
}
