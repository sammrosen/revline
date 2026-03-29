import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { PipedriveAdapter } from '@/app/_lib/integrations';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { IntegrationType } from '@prisma/client';

/**
 * GET /api/v1/integrations/[id]/pipedrive-fields
 *
 * Fetch all person fields from the workspace's Pipedrive account.
 * Returns field keys, display names, types, and whether they're custom.
 * Keeps API token server-side (never exposed to client).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    if (integration.integration !== IntegrationType.PIPEDRIVE) {
      return NextResponse.json(
        { error: 'This endpoint is only available for Pipedrive integrations' },
        { status: 400 }
      );
    }

    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return NextResponse.json(
        { error: 'Insufficient permissions to manage integrations' },
        { status: 403 }
      );
    }

    const adapter = await PipedriveAdapter.forWorkspace(integration.workspaceId);
    if (!adapter) {
      return NextResponse.json(
        { error: 'Pipedrive integration not properly configured (missing API Token)' },
        { status: 400 }
      );
    }

    const result = await adapter.listPersonFields();
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch fields from Pipedrive' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data || [],
    });
  } catch (error) {
    console.error('Fetch Pipedrive fields error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fields' },
      { status: 500 }
    );
  }
}
