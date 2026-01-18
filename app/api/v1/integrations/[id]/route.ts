import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { validateCanDeleteIntegration } from '@/app/_lib/workflow';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

/**
 * DELETE /api/v1/integrations/[id] - Delete an integration
 *
 * VALIDATION:
 * - Blocks deletion if any workflows depend on this integration
 * - Returns list of dependent workflows if blocked
 */
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

  try {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id },
      select: { workspaceId: true, integration: true },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Verify user has ADMIN or higher access to manage integrations
    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return NextResponse.json({ error: 'Insufficient permissions to delete integrations' }, { status: 403 });
    }

    // Check for dependent workflows before deleting
    const validation = await validateCanDeleteIntegration(
      integration.workspaceId,
      integration.integration
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.errors[0]?.message || 'Cannot delete integration',
          code: 'HAS_DEPENDENTS',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    await prisma.workspaceIntegration.delete({
      where: { id },
    });

    await emitEvent({
      workspaceId: integration.workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'integration_deleted',
      success: true,
      errorMessage: `Deleted ${integration.integration} integration`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete integration error:', error);
    return NextResponse.json(
      { error: 'Failed to delete integration' },
      { status: 500 }
    );
  }
}




