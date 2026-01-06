/**
 * Workflow Toggle API
 *
 * PATCH /api/admin/workflows/[id]/toggle - Enable/disable workflow
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;

  try {
    // Check workflow exists
    const existing = await prisma.workflow.findUnique({
      where: { id },
      select: { id: true, enabled: true, name: true },
    });

    if (!existing) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Toggle enabled status
    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        enabled: !existing.enabled,
      },
      select: {
        id: true,
        name: true,
        enabled: true,
        updatedAt: true,
      },
    });

    return ApiResponse.success({
      workflow,
      message: workflow.enabled
        ? `Workflow "${workflow.name}" enabled`
        : `Workflow "${workflow.name}" disabled`,
    });
  } catch (error) {
    console.error('Error toggling workflow:', error);
    return ApiResponse.internalError();
  }
}

