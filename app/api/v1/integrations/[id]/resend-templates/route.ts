import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { ResendAdapter } from '@/app/_lib/integrations';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { IntegrationType } from '@prisma/client';

/**
 * GET /api/v1/integrations/[id]/resend-templates
 * 
 * Fetch available email templates from the workspace's Resend account.
 * Returns template IDs, names, and variable definitions for config editor UI.
 * 
 * Keeps Resend API key server-side (never exposed to client).
 * 
 * STANDARDS:
 * - Workspace-scoped (verifies user has access to the integration's workspace)
 * - Admin/Owner only (managing integrations requires elevated access)
 * - Returns structured response
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
    // Load the integration and verify it's a Resend integration
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id },
      select: { workspaceId: true, integration: true },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    if (integration.integration !== IntegrationType.RESEND) {
      return NextResponse.json(
        { error: 'This endpoint is only available for Resend integrations' },
        { status: 400 }
      );
    }

    // Verify user has ADMIN or higher access
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

    // Load the Resend adapter for this workspace
    const adapter = await ResendAdapter.forWorkspace(integration.workspaceId);
    if (!adapter) {
      return NextResponse.json(
        { error: 'Resend integration not properly configured (missing API key)' },
        { status: 400 }
      );
    }

    // Fetch templates from Resend API
    const listResult = await adapter.listRemoteTemplates();
    if (!listResult.success) {
      return NextResponse.json(
        { error: listResult.error || 'Failed to fetch templates from Resend' },
        { status: 502 }
      );
    }

    const templates = listResult.data || [];

    // For each template, try to fetch variable definitions
    // (The list endpoint may not include variables, so we fetch details individually)
    const templatesWithVars = await Promise.all(
      templates.map(async (t) => {
        const detailResult = await adapter.getRemoteTemplate(t.id);
        if (detailResult.success && detailResult.data) {
          return {
            id: t.id,
            name: t.name,
            variables: detailResult.data.variables?.map((v) => ({
              key: v.key,
              type: v.type,
              fallbackValue: v.fallbackValue,
            })) || [],
          };
        }
        // Fall back to basic info if detail fetch fails
        return {
          id: t.id,
          name: t.name,
          variables: [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: templatesWithVars,
    });

  } catch (error) {
    console.error('Fetch Resend templates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
