/**
 * MailerLite Action Executors
 *
 * Executors for MailerLite operations.
 * Uses the existing MailerLiteAdapter for API calls.
 * Supports mapping custom lead properties to MailerLite subscriber fields.
 */

import { MailerLiteAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Add subscriber to a MailerLite group
 * 
 * Params:
 * - group: Group key (required)
 * - fields: Optional mapping of MailerLite field names to lead property keys
 *   e.g., { "barcode": "barcode", "member_type": "memberType" }
 *   Maps lead.properties[value] → MailerLite subscriber field[key]
 */
const addToGroup: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const groupKey = params.group as string;

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'add_to_group',
          summary: `Would add ${ctx.email || 'unknown'} to MailerLite group "${groupKey || 'unknown'}"`,
          params: { group: groupKey, email: ctx.email },
        },
      };
    }

    if (!groupKey) {
      return { success: false, error: 'Missing group parameter' };
    }

    // Get adapter for this client
    const adapter = await MailerLiteAdapter.forClient(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'MailerLite not configured for this client' };
    }

    // Look up group by key
    const group = adapter.getGroup(groupKey);
    if (!group) {
      return {
        success: false,
        error: `Group '${groupKey}' not found in client config`,
      };
    }

    // Resolve custom subscriber fields from lead properties
    let subscriberFields: Record<string, unknown> | undefined;
    const fieldMapping = params.fields as Record<string, string> | undefined;

    if (fieldMapping && typeof fieldMapping === 'object' && ctx.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: ctx.leadId },
        select: { properties: true },
      });
      const leadProps = (lead?.properties as Record<string, unknown>) ?? {};

      subscriberFields = {};
      for (const [mlFieldName, leadPropKey] of Object.entries(fieldMapping)) {
        const value = leadProps[leadPropKey];
        if (value !== undefined && value !== null) {
          subscriberFields[mlFieldName] = value;
        }
      }

      // Only pass if we have actual values
      if (Object.keys(subscriberFields).length === 0) {
        subscriberFields = undefined;
      }
    }

    // Auto-create any missing subscriber fields in MailerLite
    if (subscriberFields && Object.keys(subscriberFields).length > 0) {
      await adapter.ensureFieldsExist(Object.keys(subscriberFields));
    }

    // Add subscriber to group with optional custom fields
    const result = await adapter.addToGroup(ctx.email, group.id, ctx.name, subscriberFields);

    // Emit event for tracking
    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.MAILERLITE,
      eventType: result.success
        ? 'mailerlite_subscribe_success'
        : 'mailerlite_subscribe_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        subscriberId: result.data?.subscriberId,
        groupId: group.id,
        groupName: group.name,
        ...(subscriberFields ? { fieldsSent: Object.keys(subscriberFields) } : {}),
      },
    };
  },
};

/**
 * Remove subscriber from a MailerLite group
 * Note: This is a stub - MailerLiteAdapter doesn't have this method yet
 */
const removeFromGroup: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const groupKey = params.group as string;

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'remove_from_group',
          summary: `Would remove ${ctx.email || 'unknown'} from MailerLite group "${groupKey || 'unknown'}"`,
          params: { group: groupKey, email: ctx.email },
        },
      };
    }

    if (!groupKey) {
      return { success: false, error: 'Missing group parameter' };
    }

    // Get adapter for this client
    const adapter = await MailerLiteAdapter.forClient(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'MailerLite not configured for this client' };
    }

    // Look up group by key
    const group = adapter.getGroup(groupKey);
    if (!group) {
      return {
        success: false,
        error: `Group '${groupKey}' not found in client config`,
      };
    }

    // TODO: Implement removeFromGroup in MailerLiteAdapter
    // For now, log and return success (no-op)
    console.warn(
      `[Workflow] remove_from_group not implemented: ${ctx.email} from ${groupKey}`
    );

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.MAILERLITE,
      eventType: 'mailerlite_remove_skipped',
      success: true,
      errorMessage: 'remove_from_group not yet implemented',
    });

    return {
      success: true,
      data: {
        groupId: group.id,
        groupName: group.name,
        skipped: true,
      },
    };
  },
};

/**
 * Add tag to a subscriber
 * Note: This is a stub - MailerLiteAdapter doesn't have this method yet
 */
const addTag: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const tag = params.tag as string;

    if (ctx.isTest) {
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'add_tag',
          summary: `Would add tag "${tag || 'unknown'}" to ${ctx.email || 'unknown'} in MailerLite`,
          params: { tag, email: ctx.email },
        },
      };
    }

    if (!tag) {
      return { success: false, error: 'Missing tag parameter' };
    }

    // Get adapter for this client
    const adapter = await MailerLiteAdapter.forClient(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'MailerLite not configured for this client' };
    }

    // TODO: Implement addTag in MailerLiteAdapter
    // For now, log and return success (no-op)
    console.warn(`[Workflow] add_tag not implemented: ${tag} for leadId=${ctx.leadId}`);

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.MAILERLITE,
      eventType: 'mailerlite_tag_skipped',
      success: true,
      errorMessage: 'add_tag not yet implemented',
    });

    return {
      success: true,
      data: {
        tag,
        skipped: true,
      },
    };
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const mailerliteExecutors: Record<string, ActionExecutor> = {
  add_to_group: addToGroup,
  remove_from_group: removeFromGroup,
  add_tag: addTag,
};


