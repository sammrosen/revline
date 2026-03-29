import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { PipedriveAdapter } from '@/app/_lib/integrations';
import { ApiResponse } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';

/**
 * POST /api/v1/integrations/[id]/test
 *
 * Tests the connection for a specific integration by validating
 * its credentials against the external API.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return ApiResponse.error('Invalid integration ID', 400);
  }

  try {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id },
      select: { workspaceId: true, integration: true },
    });

    if (!integration) {
      return ApiResponse.error('Integration not found', 404);
    }

    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return ApiResponse.error('Workspace not found', 404);
    }

    if (integration.integration === 'PIPEDRIVE') {
      const adapter = await PipedriveAdapter.forWorkspace(integration.workspaceId);
      if (!adapter) {
        await emitEvent({
          workspaceId: integration.workspaceId,
          system: EventSystem.PIPEDRIVE,
          eventType: 'integration_test_failed',
          success: false,
          errorMessage: 'Adapter could not be loaded (missing API Token)',
        });
        return ApiResponse.error(
          'Pipedrive adapter could not be loaded. Check that an API Token is configured.',
          400
        );
      }

      const result = await adapter.validateConfig();
      if (!result.valid) {
        await emitEvent({
          workspaceId: integration.workspaceId,
          system: EventSystem.PIPEDRIVE,
          eventType: 'integration_test_failed',
          success: false,
          errorMessage: result.errors.join('; '),
        });
        return ApiResponse.error(result.errors.join('; '), 400);
      }

      await emitEvent({
        workspaceId: integration.workspaceId,
        system: EventSystem.PIPEDRIVE,
        eventType: 'integration_test_success',
        success: true,
        metadata: { integrationType: 'PIPEDRIVE' },
      });

      return ApiResponse.success({ message: 'Connected to Pipedrive successfully' });
    }

    return ApiResponse.error(
      `Test not implemented for integration type: ${integration.integration}`,
      400
    );
  } catch (error) {
    console.error('Test integration error:', error);
    return ApiResponse.error('Failed to test integration', 500);
  }
}
