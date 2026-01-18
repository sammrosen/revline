import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

// PATCH /api/v1/integrations/[id]/meta - Update integration meta
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

  try {
    const body = await request.json();
    const { meta } = body;

    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id },
      select: { workspaceId: true, integration: true },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Verify user has ADMIN or higher access to update integration meta
    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return NextResponse.json({ error: 'Insufficient permissions to update integration config' }, { status: 403 });
    }

    await prisma.workspaceIntegration.update({
      where: { id },
      data: { meta: meta || undefined },
    });

    await emitEvent({
      workspaceId: integration.workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'integration_meta_updated',
      success: true,
      errorMessage: `Updated ${integration.integration} meta config`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update integration meta error:', error);
    return NextResponse.json(
      { error: 'Failed to update meta' },
      { status: 500 }
    );
  }
}




