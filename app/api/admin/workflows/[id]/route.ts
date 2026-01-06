/**
 * Single Workflow Admin API
 *
 * GET /api/admin/workflows/[id] - Get workflow details
 * PUT /api/admin/workflows/[id] - Update workflow
 * DELETE /api/admin/workflows/[id] - Delete workflow
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { requireAdmin } from '@/app/_lib/auth';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const WorkflowActionSchema = z.object({
  adapter: z.string().min(1),
  operation: z.string().min(1),
  params: z.record(z.unknown()),
  conditions: z.record(z.unknown()).optional(),
});

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  triggerAdapter: z.string().min(1).optional(),
  triggerOperation: z.string().min(1).optional(),
  triggerFilter: z.record(z.unknown()).optional().nullable(),
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
  const admin = await requireAdmin();
  if (!admin) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;

  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        client: {
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
        client: workflow.client,
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
  const admin = await requireAdmin();
  if (!admin) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validation = UpdateWorkflowSchema.safeParse(body);

    if (!validation.success) {
      return ApiResponse.error(
        validation.error.errors[0]?.message || 'Invalid input',
        400,
        ErrorCodes.VALIDATION_FAILED
      );
    }

    // Check workflow exists
    const existing = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!existing) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Update workflow
    const data = validation.data;
    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.triggerAdapter !== undefined && { triggerAdapter: data.triggerAdapter }),
        ...(data.triggerOperation !== undefined && { triggerOperation: data.triggerOperation }),
        ...(data.triggerFilter !== undefined && { triggerFilter: data.triggerFilter }),
        ...(data.actions !== undefined && { actions: data.actions }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
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
  const admin = await requireAdmin();
  if (!admin) {
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

