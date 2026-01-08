/**
 * Workflow Engine
 *
 * Core engine for executing workflows.
 * Handles trigger emission, workflow matching, and action execution.
 */

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

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Emit a trigger and execute all matching workflows
 *
 * @param clientId - Client ID
 * @param trigger - Trigger info (adapter + operation)
 * @param payload - Trigger payload
 * @returns Results from all workflow executions
 *
 * @example
 * await emitTrigger(clientId, {
 *   adapter: 'calendly',
 *   operation: 'booking_created',
 * }, {
 *   email: 'user@example.com',
 *   name: 'John',
 * });
 */
export async function emitTrigger(
  clientId: string,
  trigger: WorkflowTrigger,
  payload: Record<string, unknown>
): Promise<TriggerEmitResult> {
  // 1. Find all enabled workflows matching this trigger
  const workflows = await prisma.workflow.findMany({
    where: {
      clientId,
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
    clientId,
    actionData: {},
  };

  // 3. Execute each workflow that matches filters
  const executions: WorkflowExecutionResult[] = [];
  let workflowsExecuted = 0;

  for (const workflow of workflows) {
    // Check trigger filter
    const filter = workflow.triggerFilter as Record<string, unknown> | null;
    if (!matchesFilter(filter, payload)) {
      continue;
    }

    workflowsExecuted++;
    const result = await executeWorkflow(
      {
        id: workflow.id,
        name: workflow.name,
        actions: workflow.actions as unknown as WorkflowAction[],
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
 */
async function executeWorkflow(
  workflow: WorkflowData,
  baseContext: WorkflowContext
): Promise<WorkflowExecutionResult> {
  const results: ActionExecutionResult[] = [];

  // Create execution record
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: workflow.id,
      clientId: baseContext.clientId,
      triggerAdapter: baseContext.trigger.adapter,
      triggerOperation: baseContext.trigger.operation,
      triggerPayload: baseContext.trigger.payload as Prisma.InputJsonValue,
      status: 'RUNNING',
    },
  });

  // Build mutable context
  const ctx: WorkflowContext = { ...baseContext };

  let failed = false;
  let errorMessage: string | undefined;

  for (const action of workflow.actions) {
    // Future: Check action conditions here
    // if (action.conditions && !evaluateConditions(action.conditions, ctx)) continue;

    try {
      const executor = getActionExecutor(action.adapter, action.operation);
      const result = await executor.execute(ctx, action.params);

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
      } else {
        // Stop on error
        failed = true;
        errorMessage = `${action.adapter}.${action.operation}: ${result.error}`;

        await emitEvent({
          clientId: ctx.clientId,
          leadId: ctx.leadId,
          system: EventSystem.WORKFLOW,
          eventType: 'workflow_action_failed',
          success: false,
          errorMessage,
        });

        break;
      }
    } catch (error) {
      failed = true;
      errorMessage = `${action.adapter}.${action.operation}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.push({
        action,
        result: { success: false, error: errorMessage },
      });

      await emitEvent({
        clientId: ctx.clientId,
        leadId: ctx.leadId,
        system: EventSystem.WORKFLOW,
        eventType: 'workflow_action_error',
        success: false,
        errorMessage,
      });

      break;
    }
  }

  // Update execution record
  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: failed ? 'FAILED' : 'COMPLETED',
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
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    system: EventSystem.WORKFLOW,
    eventType: failed ? 'workflow_failed' : 'workflow_completed',
    success: !failed,
    errorMessage: failed
      ? `Workflow '${workflow.name}' failed: ${errorMessage}`
      : undefined,
  });

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: failed ? 'failed' : 'completed',
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

