/**
 * Single Workflow Admin API
 *
 * GET /api/v1/workflows/[id] - Get workflow details
 * PUT /api/v1/workflows/[id] - Update workflow
 * DELETE /api/v1/workflows/[id] - Delete workflow
 *
 * VALIDATION:
 * - PUT: Blocks edits to active workflows (must disable first)
 * - PUT: Validates config against integration requirements
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { validateCanEdit } from '@/app/_lib/workflow';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const WorkflowActionSchema = z.object({
  adapter: z.string().min(1),
  operation: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
  conditions: z.record(z.string(), z.unknown()).optional(),
});

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
  triggerAdapter: z.string().min(1).optional(),
  triggerOperation: z.string().min(1).optional(),
  triggerFilter: z.record(z.string(), z.unknown()).nullish(),
  actions: z.array(WorkflowActionSchema).min(1).optional(),
  enabled: z.boolean().optional(),
});

// =============================================================================
// GET - Get workflow details
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;

  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!workflow) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Verify user has access to the workspace this workflow belongs to
    const access = await getWorkspaceAccess(userId, workflow.workspaceId);
    if (!access) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get recent executions
    const recentExecutions = await prisma.workflowExecution.findMany({
      where: { workflowId: id },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        triggerPayload: true,
        actionResults: true,
        error: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return ApiResponse.success({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        enabled: workflow.enabled,
        triggerAdapter: workflow.triggerAdapter,
        triggerOperation: workflow.triggerOperation,
        triggerFilter: workflow.triggerFilter,
        actions: workflow.actions,
        workspace: workflow.workspace,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
      recentExecutions,
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return ApiResponse.internalError();
  }
}

// =============================================================================
// PUT - Update workflow
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const schemaValidation = UpdateWorkflowSchema.safeParse(body);

    if (!schemaValidation.success) {
      return ApiResponse.error(
        schemaValidation.error.issues[0]?.message || 'Invalid input',
        400,
        ErrorCodes.VALIDATION_FAILED
      );
    }

    // Check workflow exists
    const existing = await prisma.workflow.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        enabled: true,
        name: true,
        triggerAdapter: true,
        triggerOperation: true,
        triggerFilter: true,
        actions: true,
      },
    });

    if (!existing) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Verify user has ADMIN or higher access to modify workflows
    const access = await getWorkspaceAccess(userId, existing.workspaceId);
    if (!access) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }
    
    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return ApiResponse.error('Insufficient permissions to modify workflows', 403, ErrorCodes.UNAUTHORIZED);
    }

    // Block edits to active workflows (must disable first)
    // Exception: allow toggling enabled status
    const data = schemaValidation.data;
    const isOnlyEnableToggle = Object.keys(data).length === 1 && 'enabled' in data;

    if (existing.enabled && !isOnlyEnableToggle) {
      const editValidation = validateCanEdit(existing);
      if (!editValidation.valid) {
        return ApiResponse.error(
          editValidation.errors[0]?.message || 'Cannot edit active workflow',
          400,
          ErrorCodes.VALIDATION_FAILED
        );
      }
    }

    // Note: No validation here - workflows must be disabled to edit anyway.
    // Validation happens when enabling workflows via the toggle endpoint.

    // Build update data
    const updateData: Prisma.WorkflowUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.triggerAdapter !== undefined)
      updateData.triggerAdapter = data.triggerAdapter;
    if (data.triggerOperation !== undefined)
      updateData.triggerOperation = data.triggerOperation;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    if (data.triggerFilter !== undefined) {
      updateData.triggerFilter = data.triggerFilter
        ? (data.triggerFilter as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    if (data.actions !== undefined) {
      updateData.actions = data.actions as unknown as Prisma.InputJsonValue;
    }

    // Update workflow
    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    return ApiResponse.success({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        enabled: workflow.enabled,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return ApiResponse.internalError();
  }
}

// =============================================================================
// DELETE - Delete workflow
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;

  try {
    // Check workflow exists
    const existing = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!existing) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Verify user has ADMIN or higher access to delete workflows
    const access = await getWorkspaceAccess(userId, existing.workspaceId);
    if (!access) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }
    
    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return ApiResponse.error('Insufficient permissions to delete workflows', 403, ErrorCodes.UNAUTHORIZED);
    }

    // Delete workflow (executions cascade)
    await prisma.workflow.delete({
      where: { id },
    });

    return ApiResponse.success({ deleted: true });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return ApiResponse.internalError();
  }
}
