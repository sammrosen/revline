/**
 * MailerLite Action Handler
 * 
 * Handles RevLine actions for MailerLite integration.
 * Checks routing config and adds subscribers to the appropriate groups.
 */

import { MailerLiteAdapter } from '@/app/_lib/integrations';
import { MailerLiteMeta, isMailerLiteMeta } from '@/app/_lib/types';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { RevLineAction, ActionPayload, ActionResult, getBaseAction } from '../index';

/**
 * Handle a RevLine action for MailerLite
 * 
 * Flow:
 * 1. Check if meta has routing for this action
 * 2. Look up the group key from routing
 * 3. Get the group ID from groups
 * 4. Add subscriber to that group via adapter
 */
export async function handleMailerLiteAction(
  clientId: string,
  meta: unknown,
  action: RevLineAction,
  payload: ActionPayload
): Promise<ActionResult> {
  // Validate meta structure
  if (!meta || !isMailerLiteMeta(meta)) {
    // No valid MailerLite config, skip silently
    return { success: true };
  }

  const mlMeta = meta as MailerLiteMeta;
  
  // Check if routing is configured
  if (!mlMeta.routing || !mlMeta.groups) {
    return { success: true }; // No routing configured, skip
  }

  // Look up routing for this action
  // First try exact match, then fall back to base action
  let groupKey = mlMeta.routing[action];
  
  if (groupKey === undefined) {
    // Try base action (e.g., 'lead.paid:fit1' -> 'lead.paid')
    const baseAction = getBaseAction(action);
    if (baseAction !== action) {
      groupKey = mlMeta.routing[baseAction];
    }
  }
  
  // null means explicitly disabled, undefined means not configured
  if (groupKey === null || groupKey === undefined) {
    return { success: true }; // No routing for this action
  }

  // Look up the group
  const group = mlMeta.groups[groupKey];
  if (!group) {
    const error = `Group '${groupKey}' not found in MailerLite config`;
    await emitEvent({
      clientId,
      system: EventSystem.MAILERLITE,
      eventType: 'mailerlite_routing_error',
      success: false,
      errorMessage: error,
    });
    return { success: false, error };
  }

  // Get the adapter and add subscriber
  const adapter = await MailerLiteAdapter.forClient(clientId);
  if (!adapter) {
    const error = 'MailerLite adapter not configured (missing API key)';
    await emitEvent({
      clientId,
      system: EventSystem.MAILERLITE,
      eventType: 'mailerlite_config_error',
      success: false,
      errorMessage: error,
    });
    return { success: false, error };
  }

  // Add to group
  const result = await adapter.addToGroup(payload.email, group.id, payload.name);
  
  // Emit event for tracking
  await emitEvent({
    clientId,
    system: EventSystem.MAILERLITE,
    eventType: result.success ? 'mailerlite_subscribe_success' : 'mailerlite_subscribe_failed',
    success: result.success,
    errorMessage: result.error,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { 
    success: true, 
    data: { 
      groupId: group.id, 
      groupName: group.name,
      subscriberId: result.data?.subscriberId,
    } 
  };
}

