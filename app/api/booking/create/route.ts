/**
 * Create Booking
 * 
 * POST /api/booking/create
 * 
 * Creates a booking for the given time slot and customer.
 */

import { NextRequest } from 'next/server';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { getActiveClient } from '@/app/_lib/client-gate';
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
import { emitTrigger } from '@/app/_lib/workflow';

export async function POST(request: NextRequest) {
  // Rate limit
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  try {
    const body = await request.json();
    const { clientSlug, slot, customer, useWaitlist } = body as {
      clientSlug: string;
      slot: TimeSlot;
      customer: BookingCustomer;
      useWaitlist?: boolean;
    };

    // Validate input
    if (!clientSlug || typeof clientSlug !== 'string') {
      return ApiResponse.error(
        'clientSlug is required',
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

    // Get active client
    const client = await getActiveClient(clientSlug);
    if (!client) {
      return ApiResponse.error(
        'Client not found or inactive',
        404,
        ErrorCodes.CLIENT_NOT_FOUND
      );
    }

    // Get booking provider
    const provider = await getBookingProvider(client.id);
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
        // Emit event for workflow triggers
        await emitTrigger(
          client.id,
          { adapter: 'revline', operation: 'form_submitted' },
          {
            formId: 'booking-waitlist',
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
      // Emit event for workflow triggers
      await emitTrigger(
        client.id,
        { adapter: 'revline', operation: 'form_submitted' },
        {
          formId: 'booking-created',
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
