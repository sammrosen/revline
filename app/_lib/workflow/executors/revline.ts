/**
 * RevLine Action Executors
 *
 * Executors for RevLine internal operations.
 * Handles lead management, event logging, and custom lead properties.
 */

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
  return (workspace?.leadPropertySchema as LeadPropertyDefinition[] | null) ?? [];
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
        // Log warning but don't fail lead creation -- properties are best-effort
        console.warn('[Workflow] Property validation warning on create_lead:', propError);
      }

      const leadId = await upsertLead({
        workspaceId: ctx.workspaceId,
        email: ctx.email,
        source,
        properties: properties ?? undefined,
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
        data: {
          leadId,
          source,
          ...(properties ? { properties } : {}),
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

/**
 * Generate an encrypted pre-fill booking link and store it as a lead property
 * 
 * Reads the lead's barcode, email, phone from properties / context.
 * Builds a URL with an encrypted token that the booking page decrypts.
 * Writes `booking_link` to the lead's properties.
 * 
 * Params:
 * - expiryDays: Token lifetime in days (default 90)
 */
const generateBookingLink: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const expiryDays = (params.expiryDays as number) || 90;

    // Need a lead to write the link to
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
      // Load lead properties for barcode/phone
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { email: true, properties: true },
      });

      if (!lead) {
        return { success: false, error: 'Lead not found' };
      }

      const props = (lead.properties as Record<string, unknown>) ?? {};
      const barcode = (props.barcode as string) || '';
      const email = lead.email;
      const phone = (props.phone as string) || '';

      if (!email) {
        return { success: false, error: 'Lead has no email — cannot generate booking link' };
      }

      // Load workspace slug for the public URL
      const workspace = await prisma.workspace.findUnique({
        where: { id: ctx.workspaceId },
        select: { slug: true, customDomain: true },
      });

      if (!workspace?.slug) {
        return { success: false, error: 'Workspace has no slug configured' };
      }

      // Import at execution time to avoid circular deps at module load
      const { createPrefillToken } = await import('@/app/_lib/booking/prefill-token');

      const token = createPrefillToken(
        { barcode, email, phone, workspaceId: ctx.workspaceId },
        expiryDays
      );

      // Build the full booking URL
      const domain = workspace.customDomain || process.env.NEXT_PUBLIC_APP_URL || 'https://revline.app';
      const bookingLink = `${domain}/public/${workspace.slug}/book?t=${token}`;

      // Write booking_link to lead properties (merge with existing)
      const existingProps = (lead.properties as Record<string, unknown>) ?? {};
      const updatedProps = { ...existingProps, booking_link: bookingLink };

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          properties: updatedProps as Prisma.InputJsonValue,
          lastEventAt: new Date(),
        },
      });

      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId,
        system: EventSystem.BACKEND,
        eventType: 'booking_link_generated',
        success: true,
      });

      return {
        success: true,
        data: { leadId, bookingLink, expiryDays },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate booking link',
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
  generate_booking_link: generateBookingLink,
};


