import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { OpenAIAdapter } from '@/app/_lib/integrations';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { IntegrationType } from '@prisma/client';

/**
 * GET /api/v1/integrations/[id]/openai-models
 * 
 * Fetch available models from the workspace's OpenAI account.
 * Filters to chat-capable models and returns sorted by recency.
 * 
 * Keeps OpenAI API key server-side (never exposed to client).
 */

const CHAT_MODEL_PREFIXES = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt'];

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

    if (integration.integration !== IntegrationType.OPENAI) {
      return NextResponse.json(
        { error: 'This endpoint is only available for OpenAI integrations' },
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

    const adapter = await OpenAIAdapter.forWorkspace(integration.workspaceId);
    if (!adapter) {
      return NextResponse.json(
        { error: 'OpenAI integration not properly configured (missing API Key)' },
        { status: 400 }
      );
    }

    const result = await adapter.listModels();
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch models from OpenAI' },
        { status: 502 }
      );
    }

    const allModels = result.data || [];
    const chatModels = allModels.filter((m) =>
      CHAT_MODEL_PREFIXES.some((prefix) => m.id.startsWith(prefix))
    );

    return NextResponse.json({
      success: true,
      data: chatModels,
    });
  } catch (error) {
    console.error('Fetch OpenAI models error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
