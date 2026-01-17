/**
 * Workflows Admin API
 *
 * GET /api/v1/admin/workflows?clientId=xxx - List workflows for a client
 * POST /api/v1/admin/workflows - Create a new workflow
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const WorkflowActionSchema = z.object({
  adapter: z.string().min(1),
  operation: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
  conditions: z.record(z.string(), z.unknown()).optional(),
});

const CreateWorkflowSchema = z.preprocess(
  (data) => {
    // Normalize fields: convert null/undefined to appropriate defaults
    if (data && typeof data === 'object') {
      const normalized = data as Record<string, unknown>;
      // Normalize actions
      if (!('actions' in normalized) || normalized.actions === null || normalized.actions === undefined) {
        normalized.actions = [];
      }
      // Normalize description: convert null to undefined (optional field)
      if (normalized.description === null) {
        normalized.description = undefined;
      }
      return normalized;
    }
    return data;
  },
  z.object({
    workspaceId: z.string().uuid('Invalid client ID'),
    name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
    triggerAdapter: z.string().min(1, 'Trigger integration is required'),
    triggerOperation: z.string().min(1, 'Trigger event is required'),
    triggerFilter: z.record(z.string(), z.unknown()).nullable().optional(),
    actions: z.array(WorkflowActionSchema).min(1, 'At least one action is required'),
    enabled: z.boolean().optional().default(false),
  })
);

// =============================================================================
// GET - List workflows
// =============================================================================

export async function GET(request: NextRequest) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return ApiResponse.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return ApiResponse.error(
      'Missing clientId parameter',
      400,
      ErrorCodes.MISSING_REQUIRED
    );
  }

  try {
    const workflows = await prisma.workflow.findMany({
      where: { workspaceId: clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });

    // Get recent execution stats for each workflow
    const workflowsWithStats = await Promise.all(
      workflows.map(async (workflow) => {
        const recentExecutions = await prisma.workflowExecution.findMany({
          where: { workflowId: workflow.id },
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            status: true,
            startedAt: true,
          },
        });

        const successCount = recentExecutions.filter(
          (e) => e.status === 'COMPLETED'
        ).length;
        const failCount = recentExecutions.filter(
          (e) => e.status === 'FAILED'
        ).length;

        return {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          enabled: workflow.enabled,
          triggerAdapter: workflow.triggerAdapter,
          triggerOperation: workflow.triggerOperation,
          triggerFilter: workflow.triggerFilter,
          actionsCount: (workflow.actions as unknown[])?.length || 0,
          totalExecutions: workflow._count.executions,
          recentStats: {
            success: successCount,
            failed: failCount,
            total: recentExecutions.length,
          },
          lastExecution: recentExecutions[0]?.startedAt || null,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
        };
      })
    );

    return ApiResponse.success({ workflows: workflowsWithStats });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return ApiResponse.internalError();
  }
}

// =============================================================================
// POST - Create workflow
// =============================================================================

export async function POST(request: NextRequest) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return ApiResponse.unauthorized();
  }

  try {
    const body = await request.json();
    const validation = CreateWorkflowSchema.safeParse(body);

    if (!validation.success) {
      // Build a helpful error message from all validation issues
      const errorMessages = validation.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      });

      // Special handling for actions field
      const actionsIssue = validation.error.issues.find(
        (issue) => issue.path.includes('actions')
      );
      
      let errorMessage = errorMessages.join('; ');
      
      // Provide more helpful message for actions field
      if (actionsIssue) {
        // Check if actions was null/undefined in original body
        const originalActions = body?.actions;
        if (originalActions === null || originalActions === undefined) {
          errorMessage = 'At least one action is required. Please add an action to your workflow before saving.';
        } else if (actionsIssue.code === 'too_small' && Array.isArray(originalActions) && originalActions.length === 0) {
          errorMessage = 'At least one action is required. Please add an action to your workflow before saving.';
        } else {
          errorMessage = `Actions: ${actionsIssue.message}`;
        }
      }

      console.error('Workflow validation failed:', {
        errors: validation.error.issues,
        received: body,
        originalActions: body?.actions,
      });

      return ApiResponse.error(errorMessage, 400, ErrorCodes.VALIDATION_FAILED);
    }

    const data = validation.data;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: data.workspaceId },
    });

    if (!workspace) {
      return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Create workflow
    const workflow = await prisma.workflow.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        triggerAdapter: data.triggerAdapter,
        triggerOperation: data.triggerOperation,
        triggerFilter: data.triggerFilter
          ? (data.triggerFilter as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        actions: data.actions as unknown as Prisma.InputJsonValue,
      },
    });

    return ApiResponse.success(
      {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          enabled: workflow.enabled,
        },
      },
      201
    );
  } catch (error) {
    console.error('Error creating workflow:', error);
    return ApiResponse.internalError();
  }
}
