/**
 * Workflows Admin API
 *
 * GET /api/admin/workflows?clientId=xxx - List workflows for a client
 * POST /api/admin/workflows - Create a new workflow
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

const CreateWorkflowSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  triggerAdapter: z.string().min(1),
  triggerOperation: z.string().min(1),
  triggerFilter: z.record(z.unknown()).optional(),
  actions: z.array(WorkflowActionSchema).min(1),
  enabled: z.boolean().optional().default(true),
});

// =============================================================================
// GET - List workflows
// =============================================================================

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
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
      where: { clientId },
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
  const admin = await requireAdmin();
  if (!admin) {
    return ApiResponse.unauthorized();
  }

  try {
    const body = await request.json();
    const validation = CreateWorkflowSchema.safeParse(body);

    if (!validation.success) {
      return ApiResponse.error(
        validation.error.errors[0]?.message || 'Invalid input',
        400,
        ErrorCodes.VALIDATION_FAILED
      );
    }

    const data = validation.data;

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    });

    if (!client) {
      return ApiResponse.error('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Create workflow
    const workflow = await prisma.workflow.create({
      data: {
        clientId: data.clientId,
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        triggerAdapter: data.triggerAdapter,
        triggerOperation: data.triggerOperation,
        triggerFilter: data.triggerFilter || null,
        actions: data.actions,
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

