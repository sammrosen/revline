/**
 * RevLine Action Executors
 *
 * Executors for RevLine internal operations.
 * Handles lead management and event logging.
 */

import {
  upsertLead,
  updateLeadStage,
  emitEvent,
  EventSystem,
} from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { LeadStageDefinition, DEFAULT_LEAD_STAGES } from '@/app/_lib/types';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Create or update a lead record
 */
const createLead: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const source = (params.source as string) || ctx.trigger.adapter;

    if (!ctx.email) {
      return { success: false, error: 'No email in workflow context' };
    }

    try {
      const leadId = await upsertLead({
        workspaceId: ctx.workspaceId,
        email: ctx.email,
        source,
      });

      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId,
        system: EventSystem.BACKEND,
        eventType: 'lead_created',
        success: true,
      });

      return {
        success: true,
        data: { leadId, source },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create lead',
      };
    }
  },
};

/**
 * Update the stage of a lead
 */
const updateLeadStageAction: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const stage = params.stage as string;

    if (!stage) {
      return { success: false, error: 'Missing stage parameter' };
    }

    // Validate stage against workspace's configured stages
    const workspace = await prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { leadStages: true },
    });
    const stages = (workspace?.leadStages as LeadStageDefinition[] | null) ?? DEFAULT_LEAD_STAGES;
    const validKeys = stages.map(s => s.key);
    if (!validKeys.includes(stage)) {
      return { success: false, error: `Invalid stage: ${stage}. Valid stages: ${validKeys.join(', ')}` };
    }

    // Need a lead to update - create one if not exists
    let leadId = ctx.leadId;
    if (!leadId) {
      if (!ctx.email) {
        return { success: false, error: 'No email or leadId in workflow context' };
      }

      try {
        leadId = await upsertLead({
          workspaceId: ctx.workspaceId,
          email: ctx.email,
          source: ctx.trigger.adapter,
        });
      } catch (error) {
        return {
          success: false,
          error: `Failed to find/create lead: ${error instanceof Error ? error.message : 'Unknown'}`,
        };
      }
    }

    try {
      await updateLeadStage(leadId, stage);

      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId,
        system: EventSystem.BACKEND,
        eventType: `lead_stage_${stage.toLowerCase()}`,
        success: true,
      });

      return {
        success: true,
        data: { leadId, stage },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update lead stage',
      };
    }
  },
};

/**
 * Emit a custom event to the event log
 */
const emitEventAction: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const eventType = params.eventType as string;
    const success = (params.success as boolean) ?? true;

    if (!eventType) {
      return { success: false, error: 'Missing eventType parameter' };
    }

    try {
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.BACKEND,
        eventType,
        success,
      });

      return {
        success: true,
        data: { eventType, logged: true },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to emit event',
      };
    }
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const revlineExecutors: Record<string, ActionExecutor> = {
  create_lead: createLead,
  update_lead_stage: updateLeadStageAction,
  emit_event: emitEventAction,
};


