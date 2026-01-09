/**
 * ABC Ignite Action Executors
 *
 * Executors for ABC Ignite calendar/booking operations.
 * Uses the AbcIgniteAdapter for API calls.
 */

import { AbcIgniteAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Enroll a member in a calendar event (book appointment)
 */
const enrollMember: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const eventId = params.eventId as string;
    const memberId = (ctx.trigger.payload.memberId as string) || (params.memberId as string);
    
    // Enrollment options from params
    const validateServiceRestriction = params.validateServiceRestriction as boolean | undefined;
    const allowUnfunded = params.allowUnfunded as boolean | undefined;

    if (!eventId) {
      return { success: false, error: 'Missing eventId parameter' };
    }

    if (!memberId) {
      return { success: false, error: 'Missing memberId in payload or params' };
    }

    // Get adapter for this client
    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    // Enroll member with options
    const result = await adapter.enrollMember(eventId, memberId, {
      validateServiceRestriction,
      allowUnfunded,
    });

    // Emit event for tracking
    await emitEvent({
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      system: EventSystem.ABC_IGNITE,
      eventType: result.success
        ? 'abc_ignite_enroll_success'
        : 'abc_ignite_enroll_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        eventId,
        memberId,
        enrolled: true,
      },
    };
  },
};

/**
 * Unenroll a member from a calendar event (cancel appointment)
 */
const unenrollMember: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const eventId = params.eventId as string;
    const memberId = (ctx.trigger.payload.memberId as string) || (params.memberId as string);

    if (!eventId) {
      return { success: false, error: 'Missing eventId parameter' };
    }

    if (!memberId) {
      return { success: false, error: 'Missing memberId in payload or params' };
    }

    // Get adapter for this client
    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    // Unenroll member
    const result = await adapter.unenrollMember(eventId, memberId);

    // Emit event for tracking
    await emitEvent({
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      system: EventSystem.ABC_IGNITE,
      eventType: result.success
        ? 'abc_ignite_unenroll_success'
        : 'abc_ignite_unenroll_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        eventId,
        memberId,
        unenrolled: true,
      },
    };
  },
};

/**
 * Add a member to event waitlist
 */
const addToWaitlist: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const eventId = params.eventId as string;
    const memberId = (ctx.trigger.payload.memberId as string) || (params.memberId as string);

    if (!eventId) {
      return { success: false, error: 'Missing eventId parameter' };
    }

    if (!memberId) {
      return { success: false, error: 'Missing memberId in payload or params' };
    }

    // Get adapter for this client
    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    // Add to waitlist
    const result = await adapter.addToWaitlist(eventId, memberId);

    // Emit event for tracking
    await emitEvent({
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      system: EventSystem.ABC_IGNITE,
      eventType: result.success
        ? 'abc_ignite_waitlist_add_success'
        : 'abc_ignite_waitlist_add_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        eventId,
        memberId,
        addedToWaitlist: true,
        position: result.data?.position,
      },
    };
  },
};

/**
 * Remove a member from event waitlist
 */
const removeFromWaitlist: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const eventId = params.eventId as string;
    const memberId = (ctx.trigger.payload.memberId as string) || (params.memberId as string);

    if (!eventId) {
      return { success: false, error: 'Missing eventId parameter' };
    }

    if (!memberId) {
      return { success: false, error: 'Missing memberId in payload or params' };
    }

    // Get adapter for this client
    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    // Remove from waitlist
    const result = await adapter.removeFromWaitlist(eventId, memberId);

    // Emit event for tracking
    await emitEvent({
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      system: EventSystem.ABC_IGNITE,
      eventType: result.success
        ? 'abc_ignite_waitlist_remove_success'
        : 'abc_ignite_waitlist_remove_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        eventId,
        memberId,
        removedFromWaitlist: true,
      },
    };
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const abcIgniteExecutors: Record<string, ActionExecutor> = {
  enroll_member: enrollMember,
  unenroll_member: unenrollMember,
  add_to_waitlist: addToWaitlist,
  remove_from_waitlist: removeFromWaitlist,
};
