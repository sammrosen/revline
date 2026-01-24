/**
 * Create Booking
 * 
 * POST /api/v1/booking/create
 * 
 * Creates a booking for the given time slot and customer.
 * 
 * SYNC WORKFLOW EXECUTION:
 * First attempts to use sync workflow (booking.create_booking trigger).
 * Falls back to direct provider call if no workflow is configured.
 * 
 * POST-BOOKING TRIGGERS:
 * After successful booking, emits capture triggers for async workflows
 * (booking_confirmed, booking_waitlisted).
 */

import { NextRequest } from 'next/server';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { getActiveWorkspace } from '@/app/_lib/client-gate';
import { 
  getBookingProvider, 
  BookingCustomer, 
  TimeSlot 
} from '@/app/_lib/booking';
import { 
  rateLimitByIP, 
  getClientIP, 
  RATE_LIMITS,
} from '@/app/_lib/middleware';
import { submitCaptureTrigger } from '@/app/_lib/services/capture.service';
import { executeWorkflowSync } from '@/app/_lib/workflow';

export async function POST(request: NextRequest) {
  // Rate limit
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  try {
    const body = await request.json();
    // Support both workspaceSlug and clientSlug for backwards compatibility
    const workspaceSlug = body.workspaceSlug || body.clientSlug;
    const { slot, customer, useWaitlist } = body as {
      slot: TimeSlot;
      customer: BookingCustomer;
      useWaitlist?: boolean;
    };

    // Validate input
    if (!workspaceSlug || typeof workspaceSlug !== 'string') {
      return ApiResponse.error(
        'workspaceSlug is required',
        400,
        ErrorCodes.MISSING_REQUIRED
      );
    }

    if (!slot || !slot.id) {
      return ApiResponse.error(
        'slot with id is required',
        400,
        ErrorCodes.MISSING_REQUIRED
      );
    }

    if (!customer || !customer.id) {
      return ApiResponse.error(
        'customer with id is required',
        400,
        ErrorCodes.MISSING_REQUIRED
      );
    }

    // Get active workspace
    const workspace = await getActiveWorkspace(workspaceSlug);
    if (!workspace) {
      return ApiResponse.error(
        'Workspace not found or inactive',
        404,
        ErrorCodes.CLIENT_NOT_FOUND
      );
    }

    // Handle waitlist flow
    if (useWaitlist && slot.spotsAvailable === 0) {
      return handleWaitlist(workspace.id, slot, customer);
    }

    // Try sync workflow first, then fall back to direct provider
    const result = await createBookingWithWorkflowOrProvider(
      workspace.id,
      slot,
      customer
    );

    if (!result.success) {
      return ApiResponse.error(
        result.error || 'Booking failed',
        400,
        ErrorCodes.INVALID_STATE
      );
    }

    // Emit post-booking trigger for async workflows
    await submitCaptureTrigger(
      workspace.id,
      'booking_confirmed',
      {
        email: customer.email,
        firstName: customer.name,
        source: 'booking',
        'custom.customerId': customer.id,
        'custom.slotId': slot.id,
        'custom.slotTitle': slot.title,
        'custom.slotTime': slot.startTime,
        'custom.bookingId': result.bookingId,
      }
    );

    return ApiResponse.success({
      result: {
        success: true,
        bookingId: result.bookingId,
      },
      waitlisted: false,
    });

  } catch (error) {
    console.error('Create booking error:', error);
    return ApiResponse.internalError();
  }
}

/**
 * Create booking via sync workflow or fallback to direct provider
 */
async function createBookingWithWorkflowOrProvider(
  workspaceId: string,
  slot: TimeSlot,
  customer: BookingCustomer
): Promise<{ success: boolean; bookingId?: string; error?: string }> {
  // Extract provider data from slot (set during availability fetch)
  const providerData = slot.providerData as Record<string, unknown> | undefined;
  
  // Try sync workflow first if we have the required data
  if (providerData?.employeeId && providerData?.eventTypeId && providerData?.abcLocalStartTime) {
    const workflowResult = await executeWorkflowSync(
      workspaceId,
      { adapter: 'booking', operation: 'create_booking' },
      {
        slotId: slot.id,
        employeeId: providerData.employeeId as string,
        eventTypeId: providerData.eventTypeId as string,
        levelId: providerData.levelId as string | undefined,
        startTime: providerData.abcLocalStartTime as string,
        memberId: customer.id,
        customerEmail: customer.email,
        customerName: customer.name,
      },
      { allowNoWorkflow: true }
    );

    // If workflow executed successfully (not just "no workflow found")
    if (workflowResult.success && !workflowResult.data?.noWorkflow) {
      return {
        success: true,
        bookingId: (workflowResult.data?.bookingId || workflowResult.data?.eventId) as string | undefined,
      };
    }

    // If workflow failed (not "no workflow"), return the error
    if (!workflowResult.success && !workflowResult.error?.includes('No workflow configured')) {
      return {
        success: false,
        error: workflowResult.error,
      };
    }
  }

  // Fallback to direct provider call
  const provider = await getBookingProvider(workspaceId);
  if (!provider) {
    return {
      success: false,
      error: 'No booking provider configured',
    };
  }

  const result = await provider.createBooking(slot, customer);
  return {
    success: result.success,
    bookingId: result.bookingId,
    error: result.error,
  };
}

/**
 * Handle waitlist flow (still uses direct provider for now)
 */
async function handleWaitlist(
  workspaceId: string,
  slot: TimeSlot,
  customer: BookingCustomer
) {
  const provider = await getBookingProvider(workspaceId);
  if (!provider) {
    return ApiResponse.error(
      'No booking provider configured',
      400,
      ErrorCodes.INTEGRATION_NOT_CONFIGURED
    );
  }

  if (!provider.addToWaitlist || !provider.capabilities.supportsWaitlist) {
    return ApiResponse.error(
      'Waitlist not supported',
      400,
      ErrorCodes.INVALID_STATE
    );
  }

  const result = await provider.addToWaitlist(slot, customer);
  
  if (result.success) {
    // Emit trigger for async workflows
    await submitCaptureTrigger(
      workspaceId,
      'booking_waitlisted',
      {
        email: customer.email,
        firstName: customer.name,
        source: 'booking',
        'custom.customerId': customer.id,
        'custom.slotId': slot.id,
        'custom.slotTitle': slot.title,
        'custom.slotTime': slot.startTime,
      }
    );
  }

  return ApiResponse.success({
    result,
    waitlisted: true,
  });
}
