/**
 * Booking Eligibility Check
 * 
 * POST /api/v1/booking/eligibility
 * 
 * Checks if a customer is eligible to book (e.g., has session credits).
 */

import { NextRequest } from 'next/server';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { getActiveClient } from '@/app/_lib/client-gate';
import { getBookingProvider, BookingCustomer } from '@/app/_lib/booking';
import { 
  rateLimitByIP, 
  getClientIP, 
  RATE_LIMITS,
} from '@/app/_lib/middleware';

export async function POST(request: NextRequest) {
  // Rate limit
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  try {
    const body = await request.json();
    const { clientSlug, customer, eventTypeId } = body as {
      clientSlug: string;
      customer: BookingCustomer;
      eventTypeId?: string;
    };

    // Validate input
    if (!clientSlug || typeof clientSlug !== 'string') {
      return ApiResponse.error(
        'clientSlug is required',
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

    // Check if provider supports eligibility check
    if (!provider.checkEligibility) {
      // Provider doesn't require eligibility check - everyone is eligible
      return ApiResponse.success({
        eligibility: {
          eligible: true,
          reason: 'Eligibility check not required',
        },
      });
    }

    // Check eligibility
    const eligibility = await provider.checkEligibility(customer, eventTypeId);

    return ApiResponse.success({
      eligibility,
    });

  } catch (error) {
    console.error('Booking eligibility error:', error);
    return ApiResponse.internalError();
  }
}
