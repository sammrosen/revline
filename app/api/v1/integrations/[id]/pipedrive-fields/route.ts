import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { PipedriveAdapter } from '@/app/_lib/integrations';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { IntegrationType } from '@prisma/client';
import { ApiResponse } from '@/app/_lib/utils/api-response';

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

    if (integration.integration !== IntegrationType.PIPEDRIVE) {
      return ApiResponse.error(
        'This endpoint is only available for Pipedrive integrations',
        400
      );
    }

    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return ApiResponse.error('Workspace not found', 404);
    }

    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return ApiResponse.error('Insufficient permissions to manage integrations', 403);
    }

    const adapter = await PipedriveAdapter.forWorkspace(integration.workspaceId);
    if (!adapter) {
      return ApiResponse.error(
        'Pipedrive integration not properly configured (missing API Token)',
        400
      );
    }

    const result = await adapter.listPersonFields();
    if (!result.success) {
      return ApiResponse.error(
        result.error || 'Failed to fetch fields from Pipedrive',
        502
      );
    }

    return ApiResponse.success(result.data || []);
  } catch (error) {
    console.error('Fetch Pipedrive fields error:', error);
    return ApiResponse.error('Failed to fetch fields', 500);
  }
}
