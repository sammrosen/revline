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
  WorkflowContextLead,
  WorkflowContextWorkspace,
  SyncWorkflowResult,
  SyncWorkflowOptions,
} from './types';
import { getActionExecutor } from './executors';
import { 
  executeIdempotent, 
  generateWorkflowIdempotencyKey,
  logStructured,
} from '@/app/_lib/reliability';
import { AlertService } from '@/app/_lib/alerts';
import { LeadCustomData } from '@/app/_lib/types/custom-fields';

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
  payload: Record<string, unknown>
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

  // 2. Load workspace data for context
  const workspaceData = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true },
  });

  const workspaceContext: WorkflowContextWorkspace | undefined = workspaceData
    ? { id: workspaceData.id, name: workspaceData.name, slug: workspaceData.slug }
    : undefined;

  // 3. Build base context
  const baseContext: Omit<WorkflowContext, 'leadId' | 'lead'> = {
    trigger: { ...trigger, payload },
    email: extractEmail(payload),
    name: extractName(payload),
    workspaceId,
    clientId: workspaceId, // Legacy alias
    workspace: workspaceContext,
    actionData: {},
  };

  // 4. Execute each workflow that matches filters
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
      { ...baseContext, leadId: undefined, lead: undefined }
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
// SYNC WORKFLOW EXECUTION
// =============================================================================

/**
 * Execute a single workflow synchronously and return results
 * 
 * Unlike emitTrigger (fire-and-forget), this waits for completion
 * and returns the final action's result to the caller.
 * 
 * Use for user-facing flows that need a response (e.g., booking).
 * 
 * @param workspaceId - Workspace ID
 * @param trigger - Trigger info (adapter + operation)
 * @param payload - Trigger payload
 * @param options - Execution options (timeout, idempotency)
 * @returns Result from the workflow execution
 * 
 * @example
 * const result = await executeWorkflowSync(
 *   workspaceId,
 *   { adapter: 'booking', operation: 'create_booking' },
 *   { slotId, memberId, employeeId, ... }
 * );
 * if (!result.success) {
 *   return ApiResponse.error(result.error);
 * }
 */
export async function executeWorkflowSync(
  workspaceId: string,
  trigger: WorkflowTrigger,
  payload: Record<string, unknown>,
  options: SyncWorkflowOptions = {}
): Promise<SyncWorkflowResult> {
  const { timeoutMs = 30000, allowNoWorkflow = false } = options;

  // Create a timeout promise
  const timeoutPromise = new Promise<SyncWorkflowResult>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Workflow execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  // Execute with timeout
  try {
    const executionPromise = executeWorkflowSyncInternal(
      workspaceId,
      trigger,
      payload,
      allowNoWorkflow
    );

    return await Promise.race([executionPromise, timeoutPromise]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'sync_workflow_error',
      workspaceId,
      success: false,
      error: errorMessage,
      metadata: { trigger },
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Internal sync execution (without timeout wrapper)
 */
async function executeWorkflowSyncInternal(
  workspaceId: string,
  trigger: WorkflowTrigger,
  payload: Record<string, unknown>,
  allowNoWorkflow: boolean
): Promise<SyncWorkflowResult> {
  // 1. Find enabled workflows matching this trigger
  const workflows = await prisma.workflow.findMany({
    where: {
      workspaceId,
      enabled: true,
      triggerAdapter: trigger.adapter,
      triggerOperation: trigger.operation,
    },
  });

  // 2. Handle no workflow found
  if (workflows.length === 0) {
    if (allowNoWorkflow) {
      return {
        success: true,
        data: { noWorkflow: true },
      };
    }
    return {
      success: false,
      error: `No workflow configured for trigger ${trigger.adapter}.${trigger.operation}`,
    };
  }

  // 3. For sync execution, we expect exactly one workflow
  // Multiple workflows would be ambiguous - which result to return?
  if (workflows.length > 1) {
    return {
      success: false,
      error: `Multiple workflows (${workflows.length}) found for trigger ${trigger.adapter}.${trigger.operation}. Sync execution requires exactly one.`,
    };
  }

  const workflow = workflows[0];

  // 4. Check trigger filter
  const filter = workflow.triggerFilter as Record<string, unknown> | null;
  if (!matchesFilter(filter, payload)) {
    return {
      success: false,
      error: `Payload does not match workflow filter`,
    };
  }

  // 5. Load workspace data for context
  const workspaceData = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true },
  });

  const workspaceContext: WorkflowContextWorkspace | undefined = workspaceData
    ? { id: workspaceData.id, name: workspaceData.name, slug: workspaceData.slug }
    : undefined;

  // 6. Build context
  const baseContext: WorkflowContext = {
    trigger: { ...trigger, payload },
    email: extractEmail(payload),
    name: extractName(payload),
    workspaceId,
    clientId: workspaceId,
    workspace: workspaceContext,
    actionData: {},
    leadId: undefined,
    lead: undefined,
  };

  // 7. Execute workflow
  const result = await executeWorkflow(
    {
      id: workflow.id,
      name: workflow.name,
      actions: workflow.actions as unknown as WorkflowAction[],
    },
    baseContext
  );

  // 8. Return sync result
  // Get the last action's result data (the "primary" result)
  const lastActionResult = result.results[result.results.length - 1]?.result;

  return {
    success: result.status === 'completed',
    data: lastActionResult?.data,
    error: result.error,
    executionId: result.workflowId, // Note: This should be execution ID but we don't expose it yet
    workflowId: result.workflowId,
    workflowName: result.workflowName,
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
          // Special case: if action created/found a lead, update context with full lead data
          if (result.data.leadId) {
            const leadId = result.data.leadId as string;
            ctx.leadId = leadId;
            // Load full lead data including custom fields for interpolation
            ctx.lead = await loadLeadContext(leadId);
          }
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
      failed = true;
      errorMessage = `${action.adapter}.${action.operation}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.push({
        action,
        result: { success: false, error: errorMessage },
      });

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
    workspaceId: ctx.workspaceId,
    leadId: ctx.leadId,
    system: EventSystem.WORKFLOW,
    eventType: failed ? 'workflow_failed' : 'workflow_completed',
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
    },
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

/**
 * Load lead data with custom fields for workflow context
 * Used for variable interpolation: {{lead.email}}, {{lead.custom.barcode}}
 */
async function loadLeadContext(leadId: string): Promise<WorkflowContextLead | undefined> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        email: true,
        stage: true,
        source: true,
        customData: true,
      },
    });

    if (!lead) {
      return undefined;
    }

    return {
      id: lead.id,
      email: lead.email,
      stage: lead.stage,
      source: lead.source,
      custom: (lead.customData as LeadCustomData) || {},
    };
  } catch (error) {
    // Fail-safe: if we can't load lead data, continue without it
    console.error('Failed to load lead context:', error);
    return undefined;
  }
}

