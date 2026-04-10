/**
 * ActionFlow Action Executors
 *
 * Executors for ActionFlow ERP operations (outbound only).
 * Uses ActionFlowAdapter for API calls.
 * Returns actionFlowCustomerId / job data in result.data for downstream context propagation.
 */

import { z } from 'zod';
import { ActionFlowAdapter, CreateCustomerOptions } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

const CreateCustomerParamsSchema = z.object({
  jobName: z.string().optional(),
  jobNotes: z.string().optional(),
  actionComment: z.string().optional(),
  street1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

const GetJobParamsSchema = z.object({
  jobId: z.coerce.number(),
  includeCompleted: z.coerce.boolean().optional(),
});

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Create a customer in ActionFlow with a lead notification action.
 * Alerts ActionFlow users that a new lead customer was created.
 *
 * Params:
 * - jobName: Optional job name to create alongside the customer
 * - jobNotes: Optional notes for the job
 * - actionComment: Optional note for the lead notification action
 * - street1, city, state, zip: Optional address fields
 */
const createCustomerWithLead: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const parsed = CreateCustomerParamsSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: `Invalid params: ${parsed.error.message}` };
    }

    const customerName = ctx.name || ctx.email || 'Unknown';

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'create_customer_with_lead',
          summary: `Would create ActionFlow customer with lead for "${customerName}"`,
          params: { name: customerName, email: ctx.email, ...parsed.data },
          actionFlowCustomerId: 0,
        },
      };
    }

    const adapter = await ActionFlowAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'ActionFlow not configured for this workspace' };
    }

    const opts = buildCustomerOptions(ctx, parsed.data);
    let result;
    try {
      result = await adapter.createCustomerWithLead(opts);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown ActionFlow API error';
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.ACTIONFLOW,
        eventType: 'actionflow_customer_create_failed',
        success: false,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.ACTIONFLOW,
      eventType: result.success
        ? 'actionflow_customer_created'
        : 'actionflow_customer_create_failed',
      success: result.success,
      errorMessage: result.error,
      metadata: result.success
        ? {
            actionFlowCustomerId: result.data?.customerId,
            customerName: result.data?.name,
            withLead: true,
          }
        : undefined,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        actionFlowCustomerId: result.data!.customerId,
        customerName: result.data!.name,
        jobs: result.data!.jobs,
      },
    };
  },
};

/**
 * Create a customer in ActionFlow without a lead notification.
 *
 * Params: same as create_customer_with_lead minus actionComment
 */
const createCustomer: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const parsed = CreateCustomerParamsSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: `Invalid params: ${parsed.error.message}` };
    }

    const customerName = ctx.name || ctx.email || 'Unknown';

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'create_customer',
          summary: `Would create ActionFlow customer "${customerName}"`,
          params: { name: customerName, email: ctx.email, ...parsed.data },
          actionFlowCustomerId: 0,
        },
      };
    }

    const adapter = await ActionFlowAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'ActionFlow not configured for this workspace' };
    }

    const opts = buildCustomerOptions(ctx, parsed.data);
    let result;
    try {
      result = await adapter.createCustomer(opts);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown ActionFlow API error';
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.ACTIONFLOW,
        eventType: 'actionflow_customer_create_failed',
        success: false,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.ACTIONFLOW,
      eventType: result.success
        ? 'actionflow_customer_created'
        : 'actionflow_customer_create_failed',
      success: result.success,
      errorMessage: result.error,
      metadata: result.success
        ? {
            actionFlowCustomerId: result.data?.customerId,
            customerName: result.data?.name,
            withLead: false,
          }
        : undefined,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        actionFlowCustomerId: result.data!.customerId,
        customerName: result.data!.name,
        jobs: result.data!.jobs,
      },
    };
  },
};

/**
 * Get job details from ActionFlow.
 * Returns job data for use in downstream actions (e.g., message templates).
 *
 * Params:
 * - jobId: Required ActionFlow JobID
 * - includeCompleted: Optional, include completed items
 */
const getJob: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const parsed = GetJobParamsSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: `Invalid params: ${parsed.error.message}` };
    }

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'get_job',
          summary: `Would fetch ActionFlow job #${parsed.data.jobId}`,
          params: parsed.data,
        },
      };
    }

    const adapter = await ActionFlowAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'ActionFlow not configured for this workspace' };
    }

    let result;
    try {
      result = await adapter.getJob(parsed.data.jobId, parsed.data.includeCompleted);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown ActionFlow API error';
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.ACTIONFLOW,
        eventType: 'actionflow_job_fetch_failed',
        success: false,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.ACTIONFLOW,
      eventType: result.success
        ? 'actionflow_job_fetched'
        : 'actionflow_job_fetch_failed',
      success: result.success,
      errorMessage: result.error,
      metadata: result.success
        ? {
            actionFlowJobId: result.data?.JobID,
            jobName: result.data?.Name,
            jobStatus: result.data?.Status,
          }
        : undefined,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        actionFlowJobId: result.data!.JobID,
        jobName: result.data!.Name,
        customerName: result.data!.CustomerName,
        jobNum: result.data!.JobNum,
        status: result.data!.Status,
        calcs: result.data!.Calcs,
      },
    };
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function buildCustomerOptions(
  ctx: WorkflowContext,
  params: z.infer<typeof CreateCustomerParamsSchema>
): CreateCustomerOptions {
  const opts: CreateCustomerOptions = {
    name: ctx.name || ctx.email || 'Unknown',
  };

  if (ctx.email) opts.email = ctx.email;

  // Phone from trigger payload
  const phone = ctx.trigger.payload.phone as string | undefined;
  if (phone) opts.phone = phone;

  if (params.street1) {
    opts.address = {
      street1: params.street1,
      city: params.city,
      state: params.state,
      zip: params.zip,
    };
  }

  if (params.jobName) {
    opts.jobs = [{
      name: params.jobName,
      notes: params.jobNotes,
    }];
  }

  if (params.actionComment) {
    opts.actionComment = params.actionComment;
  }

  return opts;
}

// =============================================================================
// EXPORT
// =============================================================================

export const actionflowExecutors: Record<string, ActionExecutor> = {
  create_customer_with_lead: createCustomerWithLead,
  create_customer: createCustomer,
  get_job: getJob,
};
