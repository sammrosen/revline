/**
 * Workflow Toggle API
 *
 * PATCH /api/admin/workflows/[id]/toggle - Enable/disable workflow
 *
 * VALIDATION:
 * - Before enabling: validates all required integrations are configured
 * - Returns validation errors if requirements not met
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { validateCanEnable } from '@/app/_lib/workflow';

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

    // If enabling, validate requirements first
    if (!existing.enabled) {
      const validation = await validateCanEnable(id);

      if (!validation.valid) {
        return ApiResponse.error(
          validation.errors[0]?.message || 'Validation failed',
          400,
          ErrorCodes.VALIDATION_FAILED,
          {
            errors: validation.errors,
            warnings: validation.warnings,
          }
        );
      }

      // Log warnings if any (but allow enable)
      if (validation.warnings.length > 0) {
        console.warn('Workflow enable warnings:', {
          workflowId: id,
          warnings: validation.warnings,
        });
      }
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

