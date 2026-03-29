import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { PipedriveAdapter } from '@/app/_lib/integrations';

/**
 * POST /api/v1/integrations/[id]/test
 *
 * Tests the connection for a specific integration by validating
 * its credentials against the external API.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (integration.integration === 'PIPEDRIVE') {
      const adapter = await PipedriveAdapter.forWorkspace(integration.workspaceId);
      if (!adapter) {
        return NextResponse.json(
          { success: false, error: 'Pipedrive adapter could not be loaded. Check that an API Token is configured.' },
          { status: 400 }
        );
      }

      const result = await adapter.validateConfig();
      if (!result.valid) {
        return NextResponse.json(
          { success: false, error: result.errors.join('; ') },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: 'Connected to Pipedrive successfully' });
    }

    return NextResponse.json(
      { error: `Test not implemented for integration type: ${integration.integration}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Test integration error:', error);
    return NextResponse.json(
      { error: 'Failed to test integration' },
      { status: 500 }
    );
  }
}
