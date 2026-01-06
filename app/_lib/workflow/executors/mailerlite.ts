/**
 * MailerLite Action Executors
 *
 * Executors for MailerLite operations.
 * Uses the existing MailerLiteAdapter for API calls.
 */

import { MailerLiteAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Add subscriber to a MailerLite group
 */
const addToGroup: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const groupKey = params.group as string;

    if (!groupKey) {
      return { success: false, error: 'Missing group parameter' };
    }

    // Get adapter for this client
    const adapter = await MailerLiteAdapter.forClient(ctx.clientId);
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

    // Add subscriber to group
    const result = await adapter.addToGroup(ctx.email, group.id, ctx.name);

    // Emit event for tracking
    await emitEvent({
      clientId: ctx.clientId,
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

    if (!groupKey) {
      return { success: false, error: 'Missing group parameter' };
    }

    // Get adapter for this client
    const adapter = await MailerLiteAdapter.forClient(ctx.clientId);
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
      clientId: ctx.clientId,
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

    if (!tag) {
      return { success: false, error: 'Missing tag parameter' };
    }

    // Get adapter for this client
    const adapter = await MailerLiteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'MailerLite not configured for this client' };
    }

    // TODO: Implement addTag in MailerLiteAdapter
    // For now, log and return success (no-op)
    console.warn(`[Workflow] add_tag not implemented: ${tag} for ${ctx.email}`);

    await emitEvent({
      clientId: ctx.clientId,
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


