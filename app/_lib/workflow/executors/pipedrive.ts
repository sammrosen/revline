/**
 * Pipedrive Action Executors
 *
 * Executors for Pipedrive CRM operations.
 * Uses PipedriveAdapter for API calls.
 * Returns pipedrivePersonId in result.data for downstream context propagation.
 */

import { PipedriveAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

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
    const fields = params.fields as Record<string, string> | undefined;

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

    const result = await adapter.createOrUpdatePerson(ctx.email, ctx.name, fields);

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
    const fields = params.fields as Record<string, string> | undefined;

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

    // Resolve pipedrivePersonId from context or lead properties
    let pipedrivePersonId = ctx.actionData.pipedrivePersonId as number | undefined;

    if (!pipedrivePersonId && ctx.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: ctx.leadId },
        select: { properties: true },
      });
      const props = (lead?.properties as Record<string, unknown>) ?? {};
      pipedrivePersonId = props.pipedrivePersonId as number | undefined;
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

    const result = await adapter.updatePersonFields(pipedrivePersonId, fields);

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

// =============================================================================
// EXPORT
// =============================================================================

export const pipedriveExecutors: Record<string, ActionExecutor> = {
  create_or_update_person: createOrUpdatePerson,
  update_person_fields: updatePersonFields,
};
