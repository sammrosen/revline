/**
 * Create Booking
 * 
 * POST /api/v1/booking/create
 * 
 * Creates a booking for the given time slot and customer.
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
import { emitFormTrigger } from '@/app/_lib/workflow';

// Form ID for booking - must match the form registry
const BOOKING_FORM_ID = 'magic-link-booking';

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

    // Get booking provider
    const provider = await getBookingProvider(workspace.id);
    if (!provider) {
      return ApiResponse.error(
        'No booking provider configured',
        400,
        ErrorCodes.INTEGRATION_NOT_CONFIGURED
      );
    }

    // Check if slot is full and waitlist is requested
    if (useWaitlist && slot.spotsAvailable === 0) {
      if (!provider.addToWaitlist || !provider.capabilities.supportsWaitlist) {
        return ApiResponse.error(
          'Waitlist not supported',
          400,
          ErrorCodes.INVALID_STATE
        );
      }

      const result = await provider.addToWaitlist(slot, customer);
      
      if (result.success) {
        // Emit validated trigger for workflow execution
        // Uses emitFormTrigger to ensure trigger is declared in form registry
        await emitFormTrigger(
          workspace.id,
          BOOKING_FORM_ID,
          'booking-waitlisted', // Must match form registry declaration
          {
            email: customer.email,
            source: 'booking',
            customerId: customer.id,
            customerName: customer.name,
            slotId: slot.id,
            slotTitle: slot.title,
            slotTime: slot.startTime,
          }
        );
      }

      return ApiResponse.success({
        result,
        waitlisted: true,
      });
    }

    // Create booking
    const result = await provider.createBooking(slot, customer);

    if (result.success) {
      // Emit validated trigger for workflow execution
      // Uses emitFormTrigger to ensure trigger is declared in form registry
      await emitFormTrigger(
        workspace.id,
        BOOKING_FORM_ID,
        'booking-confirmed', // Must match form registry declaration
        {
          email: customer.email,
          source: 'booking',
          customerId: customer.id,
          customerName: customer.name,
          slotId: slot.id,
          slotTitle: slot.title,
          slotTime: slot.startTime,
          bookingId: result.bookingId,
        }
      );
    }

    return ApiResponse.success({
      result,
      waitlisted: false,
    });

  } catch (error) {
    console.error('Create booking error:', error);
    return ApiResponse.internalError();
  }
}
