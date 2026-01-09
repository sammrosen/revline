/**
 * ABC Ignite Action Executors
 *
 * Executors for ABC Ignite calendar/booking operations.
 * Uses the AbcIgniteAdapter for API calls.
 * 
 * Supports both appointments (1:1) and events (classes) - same operations.
 * Member identification supports both memberId and barcode lookup.
 */

import { AbcIgniteAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Resolve member identifier from payload/params
 * Supports both memberId (direct) and barcode (lookup)
 */
function getMemberIdentifier(
  ctx: WorkflowContext,
  params: Record<string, unknown>
): string | { barcode: string } | null {
  // Check for memberId first (direct)
  const memberId = (ctx.trigger.payload.memberId as string) || (params.memberId as string);
  if (memberId) {
    return memberId;
  }

  // Check for barcode (requires lookup)
  const barcode = (ctx.trigger.payload.barcode as string) || (params.barcode as string);
  if (barcode) {
    return { barcode };
  }

  return null;
}

// =============================================================================
// MEMBER LOOKUP
// =============================================================================

/**
 * Lookup a member by barcode
 */
const lookupMember: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const barcode = (ctx.trigger.payload.barcode as string) || (params.barcode as string);

    if (!barcode) {
      return { success: false, error: 'Missing barcode in payload or params' };
    }

    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    const result = await adapter.getMemberByBarcode(barcode);

    await emitEvent({
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      system: EventSystem.ABC_IGNITE,
      eventType: result.success && result.data
        ? 'abc_ignite_member_found'
        : 'abc_ignite_member_not_found',
      success: result.success && !!result.data,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!result.data) {
      return { success: false, error: `Member not found with barcode: ${barcode}` };
    }

    return {
      success: true,
      data: {
        memberId: result.data.memberId,
        barcode,
        member: result.data,
      },
    };
  },
};

// =============================================================================
// AVAILABILITY & BALANCE CHECKS
// =============================================================================

/**
 * Check employee availability for an event type
 */
const checkAvailability: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    // Get employee ID from params or use default from config
    const employeeId = (params.employeeId as string) || adapter.meta?.defaultEmployeeId;
    if (!employeeId) {
      return { success: false, error: 'Missing employeeId - provide in params or set defaultEmployeeId in config' };
    }

    // Get event type ID from params or use default from config
    const eventTypeId = (params.eventTypeId as string) || adapter.getDefaultEventTypeId();
    if (!eventTypeId) {
      return { success: false, error: 'Missing eventTypeId - provide in params or set defaultEventTypeId in config' };
    }

    // Optional date range
    const dateRange = params.startDate && params.endDate
      ? { startDate: params.startDate as string, endDate: params.endDate as string }
      : undefined;

    const result = await adapter.getEmployeeAvailability(employeeId, eventTypeId, dateRange);

    await emitEvent({
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      system: EventSystem.ABC_IGNITE,
      eventType: result.success
        ? 'abc_ignite_availability_checked'
        : 'abc_ignite_availability_check_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        employeeId,
        eventTypeId,
        slots: result.data,
        hasAvailability: (result.data?.length ?? 0) > 0,
      },
    };
  },
};

/**
 * Check session balance for a member
 */
const checkSessionBalance: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    const memberIdentifier = getMemberIdentifier(ctx, params);
    if (!memberIdentifier) {
      return { success: false, error: 'Missing memberId or barcode in payload or params' };
    }

    // Resolve memberId if barcode was provided
    let memberId: string;
    if (typeof memberIdentifier === 'object' && 'barcode' in memberIdentifier) {
      const memberResult = await adapter.getMemberByBarcode(memberIdentifier.barcode);
      if (!memberResult.success || !memberResult.data) {
        return { success: false, error: `Member not found with barcode: ${memberIdentifier.barcode}` };
      }
      memberId = memberResult.data.memberId;
    } else {
      memberId = memberIdentifier;
    }

    // Get event type ID from params or use default
    const eventTypeId = (params.eventTypeId as string) || adapter.getDefaultEventTypeId();
    if (!eventTypeId) {
      return { success: false, error: 'Missing eventTypeId - provide in params or set defaultEventTypeId in config' };
    }

    const result = await adapter.getSessionBalance(memberId, eventTypeId);

    await emitEvent({
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      system: EventSystem.ABC_IGNITE,
      eventType: result.success
        ? 'abc_ignite_balance_checked'
        : 'abc_ignite_balance_check_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const balance = result.data!;
    const canEnroll = balance.unlimited || balance.remainingSessions > 0;

    return {
      success: true,
      data: {
        memberId,
        eventTypeId,
        balance,
        canEnroll,
        reason: canEnroll ? undefined : 'No session credits remaining',
      },
    };
  },
};

// =============================================================================
// ENROLLMENT ACTIONS
// =============================================================================

/**
 * Enroll a member in a calendar event (book appointment or class)
 */
const enrollMember: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const eventId = params.eventId as string;
    if (!eventId) {
      return { success: false, error: 'Missing eventId parameter' };
    }

    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    const memberIdentifier = getMemberIdentifier(ctx, params);
    if (!memberIdentifier) {
      return { success: false, error: 'Missing memberId or barcode in payload or params' };
    }

    // Optionally check balance before enrolling
    if (params.checkBalance) {
      let memberId: string;
      if (typeof memberIdentifier === 'object' && 'barcode' in memberIdentifier) {
        const memberResult = await adapter.getMemberByBarcode(memberIdentifier.barcode);
        if (!memberResult.success || !memberResult.data) {
          return { success: false, error: `Member not found with barcode: ${memberIdentifier.barcode}` };
        }
        memberId = memberResult.data.memberId;
      } else {
        memberId = memberIdentifier;
      }

      // Get event details to find the event type
      const eventResult = await adapter.getEvent(eventId);
      if (eventResult.success && eventResult.data) {
        const eventTypeId = eventResult.data.eventTypeId;
        const canEnrollResult = await adapter.canEnroll(memberId, eventTypeId);
        
        if (canEnrollResult.success && !canEnrollResult.data?.canEnroll) {
          await emitEvent({
            clientId: ctx.clientId,
            leadId: ctx.leadId,
            system: EventSystem.ABC_IGNITE,
            eventType: 'abc_ignite_enroll_blocked_no_credits',
            success: false,
            errorMessage: canEnrollResult.data?.reason,
          });
          return { 
            success: false, 
            error: canEnrollResult.data?.reason || 'Cannot enroll - no session credits',
          };
        }
      }
    }

    // Enrollment options from params
    const validateServiceRestriction = params.validateServiceRestriction as boolean | undefined;
    const allowUnfunded = params.allowUnfunded as boolean | undefined;

    // Enroll member - adapter handles barcode lookup internally
    const result = await adapter.enrollMember(eventId, memberIdentifier, {
      validateServiceRestriction,
      allowUnfunded,
    });

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
        memberId: result.data?.memberId,
        enrolled: true,
      },
    };
  },
};

/**
 * Unenroll a member from a calendar event (cancel appointment or class booking)
 */
const unenrollMember: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const eventId = params.eventId as string;
    if (!eventId) {
      return { success: false, error: 'Missing eventId parameter' };
    }

    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    const memberIdentifier = getMemberIdentifier(ctx, params);
    if (!memberIdentifier) {
      return { success: false, error: 'Missing memberId or barcode in payload or params' };
    }

    // Unenroll member - adapter handles barcode lookup internally
    const result = await adapter.unenrollMember(eventId, memberIdentifier);

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
        memberId: result.data?.memberId,
        unenrolled: true,
      },
    };
  },
};

// =============================================================================
// WAITLIST ACTIONS
// =============================================================================

/**
 * Add a member to event waitlist
 */
const addToWaitlist: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const eventId = params.eventId as string;
    if (!eventId) {
      return { success: false, error: 'Missing eventId parameter' };
    }

    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    const memberIdentifier = getMemberIdentifier(ctx, params);
    if (!memberIdentifier) {
      return { success: false, error: 'Missing memberId or barcode in payload or params' };
    }

    // Add to waitlist - adapter handles barcode lookup internally
    const result = await adapter.addToWaitlist(eventId, memberIdentifier);

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
        memberId: result.data?.memberId,
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
    if (!eventId) {
      return { success: false, error: 'Missing eventId parameter' };
    }

    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured for this client' };
    }

    const memberIdentifier = getMemberIdentifier(ctx, params);
    if (!memberIdentifier) {
      return { success: false, error: 'Missing memberId or barcode in payload or params' };
    }

    // Remove from waitlist - adapter handles barcode lookup internally
    const result = await adapter.removeFromWaitlist(eventId, memberIdentifier);

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
        memberId: result.data?.memberId,
        removedFromWaitlist: true,
      },
    };
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const abcIgniteExecutors: Record<string, ActionExecutor> = {
  lookup_member: lookupMember,
  check_availability: checkAvailability,
  check_session_balance: checkSessionBalance,
  enroll_member: enrollMember,
  unenroll_member: unenrollMember,
  add_to_waitlist: addToWaitlist,
  remove_from_waitlist: removeFromWaitlist,
};
