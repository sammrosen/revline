/**
 * Workflow Engine
 *
 * Core engine for executing workflows.
 * Handles trigger emission, workflow matching, and action execution.
 * 
 * STANDARDS:
 * - All actions are wrapped with idempotent execution
 * - Correlation IDs are propagated through the execution chain
 * - Failed actions are logged and stop workflow execution
 */

import { z } from 'zod';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { Prisma } from '@prisma/client';
import {
  WorkflowContext,
  WorkflowAction,
  WorkflowExecutionResult,
  TriggerEmitResult,
  ActionExecutionResult,
  WorkflowTrigger,
} from './types';
import { getActionExecutor } from './executors';
import { 
  executeIdempotent, 
  generateWorkflowIdempotencyKey,
  logStructured,
} from '@/app/_lib/reliability';
import { AlertService } from '@/app/_lib/alerts';
import { enqueueFailedAction } from '@/app/_lib/services/integration-sync.service';

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Emit a trigger and execute all matching workflows
 *
 * @param workspaceId - Workspace ID
 * @param trigger - Trigger info (adapter + operation)
 * @param payload - Trigger payload
 * @returns Results from all workflow executions
 *
 * @example
 * await emitTrigger(workspaceId, {
 *   adapter: 'calendly',
 *   operation: 'booking_created',
 * }, {
 *   email: 'user@example.com',
 *   name: 'John',
 * });
 */
export async function emitTrigger(
  workspaceId: string,
  trigger: WorkflowTrigger,
  payload: Record<string, unknown>,
  options?: { isTest?: boolean }
): Promise<TriggerEmitResult> {
  // 1. Find all enabled workflows matching this trigger
  const workflows = await prisma.workflow.findMany({
    where: {
      workspaceId,
      enabled: true,
      triggerAdapter: trigger.adapter,
      triggerOperation: trigger.operation,
    },
  });

  if (workflows.length === 0) {
    return {
      workflowsFound: 0,
      workflowsExecuted: 0,
      executions: [],
    };
  }

  // 2. Build base context
  const baseContext: Omit<WorkflowContext, 'leadId'> = {
    trigger: { ...trigger, payload },
    email: extractEmail(payload),
    name: extractName(payload),
    workspaceId,
    clientId: workspaceId, // Legacy alias
    isTest: options?.isTest,
    actionData: {},
  };

  // 3. Execute each workflow that matches filters
  const executions: WorkflowExecutionResult[] = [];
  let workflowsExecuted = 0;

  const WorkflowActionSchema = z.array(z.object({
    adapter: z.string(),
    operation: z.string(),
    params: z.record(z.string(), z.unknown()),
    conditions: z.record(z.string(), z.unknown()).optional(),
    continueOnError: z.boolean().optional(),
  }));

  for (const workflow of workflows) {
    const rawFilter = workflow.triggerFilter;
    const filter = (rawFilter !== null && typeof rawFilter === 'object' && !Array.isArray(rawFilter))
      ? rawFilter as Record<string, unknown>
      : null;
    if (!matchesFilter(filter, payload)) {
      continue;
    }

    const actionsResult = WorkflowActionSchema.safeParse(workflow.actions);
    if (!actionsResult.success) {
      executions.push({
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: 'failed',
        actionsExecuted: 0,
        actionsTotal: 0,
        results: [],
        error: `Malformed workflow actions: ${actionsResult.error.message}`,
      });
      continue;
    }

    workflowsExecuted++;
    const result = await executeWorkflow(
      {
        id: workflow.id,
        name: workflow.name,
        actions: actionsResult.data,
      },
      { ...baseContext, leadId: undefined }
    );
    executions.push(result);
  }

  return {
    workflowsFound: workflows.length,
    workflowsExecuted,
    executions,
  };
}

// =============================================================================
// WORKFLOW EXECUTION
// =============================================================================

interface WorkflowData {
  id: string;
  name: string;
  actions: WorkflowAction[];
}

/**
 * Execute a single workflow
 * 
 * All actions are wrapped with idempotent execution to prevent
 * duplicate side effects on retries.
 */
async function executeWorkflow(
  workflow: WorkflowData,
  baseContext: WorkflowContext
): Promise<WorkflowExecutionResult> {
  const results: ActionExecutionResult[] = [];
  
  // Extract correlation ID from payload if present
  const correlationId = typeof baseContext.trigger.payload.correlationId === 'string'
    ? baseContext.trigger.payload.correlationId
    : crypto.randomUUID();

  // Create execution record with correlation ID
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: workflow.id,
      workspaceId: baseContext.workspaceId,
      correlationId,
      triggerAdapter: baseContext.trigger.adapter,
      triggerOperation: baseContext.trigger.operation,
      triggerPayload: baseContext.trigger.payload as Prisma.InputJsonValue,
      status: 'RUNNING',
    },
  });

  logStructured({
    correlationId,
    event: 'workflow_execution_started',
    workspaceId: baseContext.workspaceId,
    metadata: { 
      workflowId: workflow.id, 
      workflowName: workflow.name,
      executionId: execution.id,
    },
  });

  // Build mutable context
  const ctx: WorkflowContext = { ...baseContext };

  let failed = false;
  let hasWarnings = false;
  let errorMessage: string | undefined;

  for (let actionIndex = 0; actionIndex < workflow.actions.length; actionIndex++) {
    const action = workflow.actions[actionIndex];
    // Future: Check action conditions here
    // if (action.conditions && !evaluateConditions(action.conditions, ctx)) continue;

    try {
      const executor = getActionExecutor(action.adapter, action.operation);
      
      // Generate idempotency key for this specific action in this workflow execution
      const idempotencyKey = generateWorkflowIdempotencyKey(
        execution.id,
        actionIndex,
        `${action.adapter}.${action.operation}`,
        action.params
      );

      // Execute with idempotency - prevents duplicate actions on retry
      const { result, executed } = await executeIdempotent(
        baseContext.workspaceId,
        idempotencyKey,
        async () => executor.execute(ctx, action.params),
        { ttlMs: 24 * 60 * 60 * 1000 } // 24 hour TTL
      );

      if (!executed) {
        logStructured({
          correlationId,
          event: 'workflow_action_idempotent_skip',
          workspaceId: baseContext.workspaceId,
          metadata: { 
            action: `${action.adapter}.${action.operation}`,
            actionIndex,
          },
        });
      }

      results.push({ action, result });

      if (result.success) {
        // Merge action output into context for subsequent actions
        if (result.data) {
          ctx.actionData = { ...ctx.actionData, ...result.data };
          // Special case: if action created/found a lead, update context
          if (result.data.leadId) {
            ctx.leadId = result.data.leadId as string;
          }
        }
      } else if (action.continueOnError) {
        hasWarnings = true;
        const warningMessage = `${action.adapter}.${action.operation}: ${result.error}`;

        await emitEvent({
          workspaceId: ctx.workspaceId,
          leadId: ctx.leadId,
          system: EventSystem.WORKFLOW,
          eventType: 'workflow_action_warning',
          success: false,
          errorMessage: `[continueOnError] ${warningMessage}`,
        });

        logStructured({
          correlationId,
          event: 'workflow_action_continued_on_error',
          workspaceId: baseContext.workspaceId,
          success: false,
          error: warningMessage,
          metadata: {
            action: `${action.adapter}.${action.operation}`,
            actionIndex,
          },
        });

        if (ctx.email) {
          await enqueueFailedAction({
            workspaceId: ctx.workspaceId,
            email: ctx.email,
            leadId: ctx.leadId,
            adapter: action.adapter,
            operation: action.operation,
            params: action.params as Record<string, unknown>,
          });
        }
      } else {
        // Stop on error
        failed = true;
        errorMessage = `${action.adapter}.${action.operation}: ${result.error}`;

        await emitEvent({
          workspaceId: ctx.workspaceId,
          leadId: ctx.leadId,
          system: EventSystem.WORKFLOW,
          eventType: 'workflow_action_failed',
          success: false,
          errorMessage,
        });

        break;
      }
    } catch (error) {
      const catchMessage = `${action.adapter}.${action.operation}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.push({
        action,
        result: { success: false, error: catchMessage },
      });

      if (action.continueOnError) {
        hasWarnings = true;

        await emitEvent({
          workspaceId: ctx.workspaceId,
          leadId: ctx.leadId,
          system: EventSystem.WORKFLOW,
          eventType: 'workflow_action_warning',
          success: false,
          errorMessage: `[continueOnError] ${catchMessage}`,
        });

        logStructured({
          correlationId,
          event: 'workflow_action_continued_on_error',
          workspaceId: baseContext.workspaceId,
          success: false,
          error: catchMessage,
          metadata: {
            action: `${action.adapter}.${action.operation}`,
            actionIndex,
          },
        });

        if (ctx.email) {
          await enqueueFailedAction({
            workspaceId: ctx.workspaceId,
            email: ctx.email,
            leadId: ctx.leadId,
            adapter: action.adapter,
            operation: action.operation,
            params: action.params as Record<string, unknown>,
          });
        }
      } else {
        failed = true;
        errorMessage = catchMessage;

        await emitEvent({
          workspaceId: ctx.workspaceId,
          leadId: ctx.leadId,
          system: EventSystem.WORKFLOW,
          eventType: 'workflow_action_error',
          success: false,
          errorMessage,
        });

        break;
      }
    }
  }

  // Determine final status
  const finalStatus = failed ? 'FAILED' : hasWarnings ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED';
  const resultStatus = failed ? 'failed' : hasWarnings ? 'completed_with_warnings' : 'completed';

  // Update execution record
  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      actionResults: results.map((r) => ({
        action: r.action,
        result: r.result,
      })) as unknown as Prisma.InputJsonValue,
      error: errorMessage,
      completedAt: new Date(),
    },
  });

  // Emit workflow completion event
  await emitEvent({
    workspaceId: ctx.workspaceId,
    leadId: ctx.leadId,
    system: EventSystem.WORKFLOW,
    eventType: failed ? 'workflow_failed' : hasWarnings ? 'workflow_completed_with_warnings' : 'workflow_completed',
    success: !failed,
    errorMessage: failed
      ? `Workflow '${workflow.name}' failed: ${errorMessage}`
      : undefined,
  });

  // Send critical alert for workflow failure
  if (failed) {
    await AlertService.critical(
      'Workflow Failed',
      `${workflow.name}: ${errorMessage}`,
      {
        workflowId: workflow.id,
        workflowName: workflow.name,
        workspaceId: baseContext.workspaceId,
        correlationId,
      }
    );
  }

  logStructured({
    correlationId,
    event: failed ? 'workflow_execution_failed' : 'workflow_execution_completed',
    workspaceId: baseContext.workspaceId,
    success: !failed,
    error: errorMessage,
    metadata: { 
      workflowId: workflow.id, 
      workflowName: workflow.name,
      executionId: execution.id,
      actionsExecuted: results.length,
      ...(hasWarnings ? { hasWarnings: true } : {}),
    },
  });

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: resultStatus,
    actionsExecuted: results.length,
    actionsTotal: workflow.actions.length,
    results,
    error: errorMessage,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if payload matches filter conditions
 * Supports dot-notation paths for nested values
 */
function matchesFilter(
  filter: Record<string, unknown> | null,
  payload: Record<string, unknown>
): boolean {
  if (!filter) return true;

  for (const [path, expected] of Object.entries(filter)) {
    const actual = getValueByPath(payload, path);
    if (actual !== expected) return false;
  }
  return true;
}

/**
 * Get nested value by dot-notation path
 * e.g., 'payload.product' → payload['product']
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');

  // Handle 'payload.x' by checking if first part is 'payload'
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Extract email from various payload shapes
 */
function extractEmail(payload: Record<string, unknown>): string {
  // Try common field names
  if (typeof payload.email === 'string') return payload.email;
  if (typeof payload.customer_email === 'string') return payload.customer_email;
  if (typeof payload.invitee_email === 'string') return payload.invitee_email;

  // Check nested objects
  if (payload.customer && typeof payload.customer === 'object') {
    const customer = payload.customer as Record<string, unknown>;
    if (typeof customer.email === 'string') return customer.email;
  }

  return '';
}

/**
 * Extract name from various payload shapes
 */
function extractName(payload: Record<string, unknown>): string | undefined {
  // Try common field names
  if (typeof payload.name === 'string') return payload.name;
  if (typeof payload.customer_name === 'string') return payload.customer_name;
  if (typeof payload.invitee_name === 'string') return payload.invitee_name;

  // Check nested objects
  if (payload.customer && typeof payload.customer === 'object') {
    const customer = payload.customer as Record<string, unknown>;
    if (typeof customer.name === 'string') return customer.name;
  }

  return undefined;
}

