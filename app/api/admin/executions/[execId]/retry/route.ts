/**
 * Workflow Execution Retry API
 *
 * POST /api/admin/executions/[execId]/retry
 *
 * Retries a failed workflow execution by replaying from the webhook event.
 * 
 * SECURITY:
 * - Requires admin authentication
 * - Audit logs every retry attempt
 * - Idempotent: if already succeeded, returns cached result
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitTrigger } from '@/app/_lib/workflow';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { logStructured } from '@/app/_lib/reliability';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ execId: string }> }
) {
  // 1. Require admin authentication
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return ApiResponse.unauthorized();
  }

  const { execId } = await params;
  const correlationId = crypto.randomUUID();

  try {
    // 2. Get the execution
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: execId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            enabled: true,
            actions: true,
          },
        },
      },
    });

    if (!execution) {
      return ApiResponse.error('Execution not found', 404, ErrorCodes.NOT_FOUND);
    }

    // 3. Check if already succeeded - idempotent behavior
    if (execution.status === 'COMPLETED') {
      logStructured({
        correlationId,
        event: 'execution_retry_skipped',
        clientId: execution.clientId,
        metadata: { 
          execId, 
          reason: 'already_completed',
          adminId,
        },
      });
      
      return ApiResponse.success({
        message: 'Execution already completed successfully',
        execution: {
          id: execution.id,
          status: execution.status,
          completedAt: execution.completedAt,
        },
        retried: false,
      });
    }

    // 4. Check if currently running
    if (execution.status === 'RUNNING') {
      return ApiResponse.error(
        'Execution is currently running',
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    // 5. Check if workflow is still enabled
    if (!execution.workflow.enabled) {
      return ApiResponse.error(
        'Cannot retry - workflow is disabled',
        400,
        ErrorCodes.INVALID_STATE
      );
    }

    // 6. Get the original webhook event if we have a correlationId
    let webhookEvent = null;
    if (execution.correlationId) {
      webhookEvent = await prisma.webhookEvent.findFirst({
        where: { correlationId: execution.correlationId },
      });
    }

    // 7. Audit log the retry attempt
    await emitEvent({
      clientId: execution.clientId,
      system: EventSystem.WORKFLOW,
      eventType: 'execution_retry_requested',
      success: true,
      errorMessage: `Admin ${adminId} requested retry of execution ${execId}`,
    });

    logStructured({
      correlationId,
      event: 'execution_retry_started',
      clientId: execution.clientId,
      metadata: { 
        execId, 
        workflowId: execution.workflowId,
        workflowName: execution.workflow.name,
        adminId,
        hasWebhookEvent: !!webhookEvent,
      },
    });

    // 8. Update retry tracking fields
    await prisma.workflowExecution.update({
      where: { id: execId },
      data: {
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
        retryRequestedBy: adminId,
      },
    });

    // 9. Re-emit the trigger with the original payload
    // Add a new correlationId for this retry attempt
    const triggerPayload = execution.triggerPayload as Record<string, unknown>;
    const result = await emitTrigger(
      execution.clientId,
      { 
        adapter: execution.triggerAdapter, 
        operation: execution.triggerOperation,
      },
      {
        ...triggerPayload,
        correlationId,  // New correlation ID for this retry
        _retryOf: execId,  // Reference to original execution
      }
    );

    // 10. Check results
    const succeeded = result.executions.every(e => e.status === 'completed');
    const errors = result.executions
      .filter(e => e.status === 'failed')
      .map(e => e.error)
      .filter(Boolean);

    logStructured({
      correlationId,
      event: succeeded ? 'execution_retry_succeeded' : 'execution_retry_failed',
      clientId: execution.clientId,
      success: succeeded,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      metadata: { 
        execId,
        workflowsExecuted: result.workflowsExecuted,
        adminId,
      },
    });

    if (succeeded) {
      return ApiResponse.success({
        message: 'Execution retried successfully',
        execution: {
          id: execId,
          newExecutions: result.executions.map(e => ({
            workflowId: e.workflowId,
            workflowName: e.workflowName,
            status: e.status,
            actionsExecuted: e.actionsExecuted,
          })),
        },
        retried: true,
      });
    } else {
      return ApiResponse.success({
        message: 'Retry attempted but some workflows failed',
        execution: {
          id: execId,
          newExecutions: result.executions.map(e => ({
            workflowId: e.workflowId,
            workflowName: e.workflowName,
            status: e.status,
            error: e.error,
          })),
        },
        retried: true,
        errors,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logStructured({
      correlationId,
      event: 'execution_retry_error',
      error: errorMessage,
      metadata: { execId, adminId },
    });
    
    console.error('Execution retry error:', error);
    return ApiResponse.internalError();
  }
}
