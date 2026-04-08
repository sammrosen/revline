/**
 * Pipedrive Action Executors
 *
 * Executors for Pipedrive CRM operations.
 * Uses PipedriveAdapter for API calls.
 * Returns pipedrivePersonId in result.data for downstream context propagation.
 */

import { z } from 'zod';
import { PipedriveAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

const PipedriveFieldsSchema = z.record(z.string(), z.string()).optional();

const CreateDealParamsSchema = z.object({
  title: z.string().optional(),
  value: z.coerce.number().optional(),
  currency: z.string().optional(),
  pipelineId: z.coerce.number().optional(),
  stageId: z.coerce.number().optional(),
  status: z.string().optional(),
});

const UpdateDealParamsSchema = z.object({
  title: z.string().optional(),
  value: z.coerce.number().optional(),
  currency: z.string().optional(),
  pipelineId: z.coerce.number().optional(),
  stageId: z.coerce.number().optional(),
  status: z.string().optional(),
});

const MoveDealStageParamsSchema = z.object({
  stageId: z.coerce.number(),
});

/** Helper: read a numeric id from ctx.actionData or fall back to lead.properties */
async function resolveLeadNumericProperty(
  ctx: WorkflowContext,
  key: string,
): Promise<number | undefined> {
  const fromActionData = z.coerce.number().safeParse(ctx.actionData[key]);
  if (fromActionData.success) return fromActionData.data;

  if (!ctx.leadId) return undefined;
  const lead = await prisma.lead.findFirst({
    where: { id: ctx.leadId, workspaceId: ctx.workspaceId },
    select: { properties: true },
  });
  if (!lead) return undefined;
  const props = (lead.properties as Record<string, unknown>) ?? {};
  const fromProps = z.coerce.number().safeParse(props[key]);
  return fromProps.success ? fromProps.data : undefined;
}

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Create or update a person in Pipedrive by email.
 * 
 * Uses the search-then-upsert pattern (Pipedrive has no native upsert-by-email).
 * Returns { pipedrivePersonId } which merges into ctx.actionData for subsequent actions.
 *
 * Params:
 * - fields: Optional Record<string, string> of additional Pipedrive person fields
 */
const createOrUpdatePerson: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const fieldsResult = PipedriveFieldsSchema.safeParse(params.fields);
    if (!fieldsResult.success) {
      return { success: false, error: `Invalid fields param: ${fieldsResult.error.message}` };
    }
    const fields = fieldsResult.data;

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'create_or_update_person',
          summary: `Would create/update Pipedrive person for ${ctx.email || 'unknown'}`,
          params: { email: ctx.email, fields },
          pipedrivePersonId: 0,
        },
      };
    }

    if (!ctx.email) {
      return { success: false, error: 'No email in workflow context' };
    }

    const adapter = await PipedriveAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'Pipedrive not configured for this workspace' };
    }

    let result;
    try {
      result = await adapter.createOrUpdatePerson(ctx.email, ctx.name, fields);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Pipedrive API error';
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.PIPEDRIVE,
        eventType: 'pipedrive_person_upsert_failed',
        success: false,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.PIPEDRIVE,
      eventType: result.success
        ? (result.data?.isNew ? 'pipedrive_person_created' : 'pipedrive_person_updated')
        : 'pipedrive_person_upsert_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        pipedrivePersonId: result.data!.pipedrivePersonId,
        isNew: result.data!.isNew,
      },
    };
  },
};

/**
 * Update specific fields on an existing Pipedrive person.
 * Requires pipedrivePersonId to be available in ctx.actionData (from a prior action)
 * or on the lead's properties.
 *
 * Params:
 * - fields: Record<string, string> of Pipedrive person fields to update
 */
const updatePersonFields: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const fieldsResult = PipedriveFieldsSchema.safeParse(params.fields);
    if (!fieldsResult.success) {
      return { success: false, error: `Invalid fields param: ${fieldsResult.error.message}` };
    }
    const fields = fieldsResult.data;

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'update_person_fields',
          summary: `Would update Pipedrive person fields for ${ctx.email || 'unknown'}`,
          params: { fields },
        },
      };
    }

    if (!fields || Object.keys(fields).length === 0) {
      return { success: false, error: 'Missing or empty fields parameter' };
    }

    const personIdResult = z.coerce.number().safeParse(ctx.actionData.pipedrivePersonId);
    let pipedrivePersonId: number | undefined = personIdResult.success ? personIdResult.data : undefined;

    if (!pipedrivePersonId && ctx.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: ctx.leadId },
        select: { properties: true },
      });
      const props = (lead?.properties as Record<string, unknown>) ?? {};
      const leadIdResult = z.coerce.number().safeParse(props.pipedrivePersonId);
      if (leadIdResult.success) {
        pipedrivePersonId = leadIdResult.data;
      }
    }

    if (!pipedrivePersonId) {
      return {
        success: false,
        error: 'No pipedrivePersonId available — run create_or_update_person first or ensure lead has a Pipedrive link',
      };
    }

    const adapter = await PipedriveAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'Pipedrive not configured for this workspace' };
    }

    let result;
    try {
      result = await adapter.updatePersonFields(pipedrivePersonId, fields);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Pipedrive API error';
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.PIPEDRIVE,
        eventType: 'pipedrive_fields_update_failed',
        success: false,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.PIPEDRIVE,
      eventType: result.success
        ? 'pipedrive_fields_updated'
        : 'pipedrive_fields_update_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: { pipedrivePersonId, fieldsUpdated: Object.keys(fields) },
    };
  },
};

/**
 * Create a new deal in Pipedrive linked to a person.
 * Requires pipedrivePersonId from ctx.actionData or lead.properties.
 */
const createDeal: ActionExecutor = {
  async execute(ctx, params): Promise<ActionResult> {
    const paramsResult = CreateDealParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return { success: false, error: `Invalid create_deal params: ${paramsResult.error.message}` };
    }
    const p = paramsResult.data;

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'create_deal',
          summary: `Would create Pipedrive deal for ${ctx.email || 'unknown'}`,
          params: p,
          pipedriveDealId: 0,
        },
      };
    }

    const pipedrivePersonId = await resolveLeadNumericProperty(ctx, 'pipedrivePersonId');
    if (!pipedrivePersonId) {
      return {
        success: false,
        error: 'No pipedrivePersonId available — run create_or_update_person first or ensure lead has a Pipedrive link',
      };
    }

    const adapter = await PipedriveAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'Pipedrive not configured for this workspace' };
    }

    const title = p.title || (ctx.name ? `${ctx.name} deal` : `Deal for ${ctx.email || 'lead'}`);
    const pipelineId = p.pipelineId ?? adapter.getDefaultPipelineId();

    let result;
    try {
      result = await adapter.createDeal({
        title,
        personId: pipedrivePersonId,
        pipelineId,
        stageId: p.stageId,
        value: p.value,
        currency: p.currency,
        status: p.status,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Pipedrive API error';
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.PIPEDRIVE,
        eventType: 'pipedrive_deal_create_failed',
        success: false,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.PIPEDRIVE,
      eventType: result.success ? 'pipedrive_deal_created' : 'pipedrive_deal_create_failed',
      success: result.success,
      errorMessage: result.error,
      metadata: result.success ? { pipedriveDealId: result.data?.pipedriveDealId } : undefined,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        pipedriveDealId: result.data!.pipedriveDealId,
        isNew: true,
      },
    };
  },
};

/**
 * Update fields on an existing Pipedrive deal.
 * Requires pipedriveDealId from ctx.actionData or lead.properties.
 */
const updateDeal: ActionExecutor = {
  async execute(ctx, params): Promise<ActionResult> {
    const paramsResult = UpdateDealParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return { success: false, error: `Invalid update_deal params: ${paramsResult.error.message}` };
    }
    const p = paramsResult.data;

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'update_deal',
          summary: `Would update Pipedrive deal for ${ctx.email || 'unknown'}`,
          params: p,
        },
      };
    }

    const pipedriveDealId = await resolveLeadNumericProperty(ctx, 'pipedriveDealId');
    if (!pipedriveDealId) {
      return {
        success: false,
        error: 'No pipedriveDealId available — run create_deal first or ensure lead has a Pipedrive deal link',
      };
    }

    const adapter = await PipedriveAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'Pipedrive not configured for this workspace' };
    }

    let result;
    try {
      result = await adapter.updateDeal(pipedriveDealId, {
        title: p.title,
        value: p.value,
        currency: p.currency,
        pipelineId: p.pipelineId,
        stageId: p.stageId,
        status: p.status,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Pipedrive API error';
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.PIPEDRIVE,
        eventType: 'pipedrive_deal_update_failed',
        success: false,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.PIPEDRIVE,
      eventType: result.success ? 'pipedrive_deal_updated' : 'pipedrive_deal_update_failed',
      success: result.success,
      errorMessage: result.error,
      metadata: { pipedriveDealId },
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: { pipedriveDealId },
    };
  },
};

/**
 * Move a Pipedrive deal to a new stage.
 */
const moveDealStage: ActionExecutor = {
  async execute(ctx, params): Promise<ActionResult> {
    const paramsResult = MoveDealStageParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return { success: false, error: `Invalid move_deal_stage params: ${paramsResult.error.message}` };
    }
    const { stageId } = paramsResult.data;

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'move_deal_stage',
          summary: `Would move Pipedrive deal to stage ${stageId}`,
          params: { stageId },
        },
      };
    }

    const pipedriveDealId = await resolveLeadNumericProperty(ctx, 'pipedriveDealId');
    if (!pipedriveDealId) {
      return {
        success: false,
        error: 'No pipedriveDealId available — run create_deal first or ensure lead has a Pipedrive deal link',
      };
    }

    const adapter = await PipedriveAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'Pipedrive not configured for this workspace' };
    }

    let result;
    try {
      result = await adapter.moveDealStage(pipedriveDealId, stageId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Pipedrive API error';
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.PIPEDRIVE,
        eventType: 'pipedrive_deal_stage_move_failed',
        success: false,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.PIPEDRIVE,
      eventType: result.success ? 'pipedrive_deal_stage_moved' : 'pipedrive_deal_stage_move_failed',
      success: result.success,
      errorMessage: result.error,
      metadata: { pipedriveDealId, stageId },
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: { pipedriveDealId, stageId },
    };
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const pipedriveExecutors: Record<string, ActionExecutor> = {
  create_or_update_person: createOrUpdatePerson,
  update_person_fields: updatePersonFields,
  create_deal: createDeal,
  update_deal: updateDeal,
  move_deal_stage: moveDealStage,
};
