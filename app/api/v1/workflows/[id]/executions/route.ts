/**
 * Workflow Executions API
 *
 * GET /api/v1/workflows/[id]/executions - Get execution history
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  
  // Pagination
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  
  // Filter by status
  const status = searchParams.get('status') as 'COMPLETED' | 'FAILED' | 'RUNNING' | null;

  try {
    // Check workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      select: { id: true, name: true, workspaceId: true },
    });

    if (!workflow) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Verify user has access to the workspace this workflow belongs to
    const access = await getWorkspaceAccess(userId, workflow.workspaceId);
    if (!access) {
      return ApiResponse.error('Workflow not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Build where clause
    const where: { workflowId: string; status?: 'COMPLETED' | 'FAILED' | 'RUNNING' } = {
      workflowId: id,
    };
    if (status) {
      where.status = status;
    }

    // Get executions
    const [executions, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          status: true,
          triggerAdapter: true,
          triggerOperation: true,
          triggerPayload: true,
          actionResults: true,
          error: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.workflowExecution.count({ where }),
    ]);

    // Compute duration for each execution
    const executionsWithDuration = executions.map((e) => ({
      ...e,
      durationMs: e.completedAt
        ? new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime()
        : null,
    }));

    return ApiResponse.success({
      workflow: { id: workflow.id, name: workflow.name },
      executions: executionsWithDuration,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching executions:', error);
    return ApiResponse.internalError();
  }
}

