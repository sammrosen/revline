import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { AnthropicAdapter } from '@/app/_lib/integrations';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { IntegrationType } from '@prisma/client';

/**
 * GET /api/v1/integrations/[id]/anthropic-models
 * 
 * Fetch available models from the workspace's Anthropic account.
 * Returns model list sorted by display name.
 * 
 * Keeps Anthropic API key server-side (never exposed to client).
 */

export async function GET(
  request: NextRequest,
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

    if (integration.integration !== IntegrationType.ANTHROPIC) {
      return NextResponse.json(
        { error: 'This endpoint is only available for Anthropic integrations' },
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

    const adapter = await AnthropicAdapter.forWorkspace(integration.workspaceId);
    if (!adapter) {
      return NextResponse.json(
        { error: 'Anthropic integration not properly configured (missing API Key)' },
        { status: 400 }
      );
    }

    const result = await adapter.listModels();
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch models from Anthropic' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data || [],
    });
  } catch (error) {
    console.error('Fetch Anthropic models error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
