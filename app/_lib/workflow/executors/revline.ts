/**
 * RevLine Action Executors
 *
 * Executors for RevLine internal operations.
 * Handles lead management, event logging, and custom lead properties.
 */

import { z } from 'zod';
import {
  upsertLead,
  updateLeadStage,
  emitEvent,
  EventSystem,
} from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { LeadStageDefinition, LeadPropertyDefinition, DEFAULT_LEAD_STAGES } from '@/app/_lib/types';
import {
  validateProperties,
  extractPropertiesFromPayload,
  mergeProperties,
} from '@/app/_lib/services/lead-properties';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';
import { Prisma } from '@prisma/client';
import { enqueueFailedAction } from '@/app/_lib/services/integration-sync.service';
import { logStructured } from '@/app/_lib/reliability';

const LeadPropertySchemaValidator = z.array(z.object({
  key: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean(),
}));

const LeadStageSchemaValidator = z.array(z.object({
  key: z.string(),
  label: z.string(),
  color: z.string(),
}));

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Load the workspace's lead property schema from the database.
 */
async function getPropertySchema(workspaceId: string): Promise<LeadPropertyDefinition[]> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { leadPropertySchema: true },
  });
  const result = LeadPropertySchemaValidator.safeParse(workspace?.leadPropertySchema);
  return result.success ? result.data : [];
}

const PIPEDRIVE_PERSON_ID_DEF: LeadPropertyDefinition = {
  key: 'pipedrivePersonId',
  label: 'Pipedrive Person ID',
  type: 'number',
  required: false,
};

/**
 * Auto-provision pipedrivePersonId in the workspace's leadPropertySchema
 * so it appears as a column in the leads table. Idempotent — skips if
 * the property already exists. Fail-safe: never blocks lead creation.
 */
async function ensurePipedrivePropertyInSchema(workspaceId: string): Promise<void> {
  try {
    const schema = await getPropertySchema(workspaceId);
    if (schema.some(p => p.key === 'pipedrivePersonId')) return;

    const updated = [...schema, PIPEDRIVE_PERSON_ID_DEF];
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { leadPropertySchema: updated as unknown as Prisma.InputJsonValue },
    });

    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'workspace_schema_auto_provisioned',
      success: true,
    });
  } catch (err) {
    logStructured({
      correlationId: workspaceId,
      event: 'workspace_schema_auto_provision_failed',
      workspaceId,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}

/**
 * Resolve properties from params and/or payload, validated against workspace schema.
 * Returns validated properties or null if none to set.
 */
async function resolveProperties(
  ctx: WorkflowContext,
  params: Record<string, unknown>
): Promise<{ properties: Record<string, unknown> | null; error?: string }> {
  const schema = await getPropertySchema(ctx.workspaceId);
  if (schema.length === 0) {
    return { properties: null };
  }

  const explicitProps = params.properties as Record<string, unknown> | undefined;
  const captureFromPayload = params.captureProperties as boolean | undefined;

  let resolved: Record<string, unknown> = {};

  // Option 1: Explicit properties in params
  if (explicitProps && typeof explicitProps === 'object') {
    const validation = validateProperties(schema, explicitProps, false);
    if (!validation.success) {
      const errorMsg = Object.values(validation.errors || {}).join('; ');
      return { properties: null, error: `Property validation failed: ${errorMsg}` };
    }
    resolved = { ...resolved, ...validation.data };
  }

  // Option 2: Auto-extract from trigger payload (when captureProperties is true or no explicit props)
  if (captureFromPayload || (!explicitProps && ctx.trigger.payload)) {
    const extraction = extractPropertiesFromPayload(schema, ctx.trigger.payload);
    if (extraction.success && extraction.data && Object.keys(extraction.data).length > 0) {
      resolved = { ...resolved, ...extraction.data };
    }
  }

  if (Object.keys(resolved).length === 0) {
    return { properties: null };
  }

  return { properties: resolved };
}

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Create or update a lead record
 * 
 * Params:
 * - source: Override source (defaults to trigger adapter)
 * - properties: Explicit property values to set (e.g., { barcode: "ABC123" })
 * - captureProperties: If true, auto-extract properties from trigger payload
 *   (also auto-extracts if no explicit properties provided and payload has matching fields)
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
      // Resolve custom properties from params and/or payload
      const { properties, error: propError } = await resolveProperties(ctx, params);
      if (propError) {
        logStructured({
          correlationId: ctx.workspaceId,
          event: 'workflow_property_validation_warning',
          workspaceId: ctx.workspaceId,
          success: true,
          error: propError,
        });
      }

      let mergedProperties = properties ?? {};
      const pipedrivePersonId = ctx.actionData.pipedrivePersonId as number | undefined;
      if (pipedrivePersonId) {
        mergedProperties = { ...mergedProperties, pipedrivePersonId };
        await ensurePipedrivePropertyInSchema(ctx.workspaceId);
      }

      const hasProperties = Object.keys(mergedProperties).length > 0;

      const leadId = await upsertLead({
        workspaceId: ctx.workspaceId,
        email: ctx.email,
        source,
        properties: hasProperties ? mergedProperties : undefined,
      });

      // Fallback enqueue: if Pipedrive should have run but didn't produce a person ID,
      // enqueue for async retry now that the lead exists.
      if (!pipedrivePersonId && ctx.email) {
        await enqueueFailedAction({
          workspaceId: ctx.workspaceId,
          email: ctx.email,
          leadId,
          adapter: 'pipedrive',
          operation: 'create_or_update_person',
        });
      }

      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId,
        system: EventSystem.BACKEND,
        eventType: 'lead_created',
        success: true,
      });

      return {
        success: true,
        data: {
          leadId,
          source,
          ...(pipedrivePersonId ? { pipedrivePersonId } : {}),
          ...(hasProperties ? { properties: mergedProperties } : {}),
        },
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
    const stagesResult = LeadStageSchemaValidator.safeParse(workspace?.leadStages);
    const stages = stagesResult.success ? stagesResult.data : DEFAULT_LEAD_STAGES;
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

/**
 * Update custom properties on an existing lead
 * 
 * Params:
 * - properties: Explicit property values to set (e.g., { barcode: "ABC123" })
 * - fromPayload: If true, auto-extract properties from trigger payload
 * 
 * Merges with existing properties (incoming values overwrite existing).
 * Requires a lead to exist -- will create one if ctx.email is available.
 */
const updateLeadPropertiesAction: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    // Resolve lead
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
      // Load schema
      const schema = await getPropertySchema(ctx.workspaceId);
      if (schema.length === 0) {
        return {
          success: true,
          data: { leadId, skipped: true, reason: 'No property schema defined' },
        };
      }

      // Resolve incoming properties
      const fromPayload = params.fromPayload as boolean | undefined;
      const explicitProps = params.properties as Record<string, unknown> | undefined;

      let incoming: Record<string, unknown> = {};

      if (explicitProps && typeof explicitProps === 'object') {
        const validation = validateProperties(schema, explicitProps, false);
        if (!validation.success) {
          const errorMsg = Object.values(validation.errors || {}).join('; ');
          return { success: false, error: `Property validation failed: ${errorMsg}` };
        }
        incoming = { ...incoming, ...validation.data };
      }

      if (fromPayload && ctx.trigger.payload) {
        const extraction = extractPropertiesFromPayload(schema, ctx.trigger.payload);
        if (extraction.success && extraction.data) {
          incoming = { ...incoming, ...extraction.data };
        }
      }

      if (Object.keys(incoming).length === 0) {
        return {
          success: true,
          data: { leadId, skipped: true, reason: 'No matching properties to update' },
        };
      }

      // Read existing properties and merge
      const existingLead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { properties: true },
      });

      const existingProps = (existingLead?.properties as Record<string, unknown>) ?? {};
      const merged = mergeProperties(existingProps, incoming);

      // Write merged properties
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          properties: merged as Prisma.InputJsonValue,
          lastEventAt: new Date(),
        },
      });

      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId,
        system: EventSystem.BACKEND,
        eventType: 'lead_properties_updated',
        success: true,
      });

      return {
        success: true,
        data: { leadId, properties: merged },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update lead properties',
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
  update_lead_properties: updateLeadPropertiesAction,
  emit_event: emitEventAction,
};


