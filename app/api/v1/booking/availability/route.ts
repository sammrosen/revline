/**
 * Booking Availability
 * 
 * GET /api/v1/booking/availability
 * 
 * Gets available time slots for booking.
 */

import { NextRequest } from 'next/server';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { getActiveClient } from '@/app/_lib/client-gate';
import { getBookingProvider, AvailabilityQuery } from '@/app/_lib/booking';
import { 
  rateLimitByIP, 
  getClientIP, 
  RATE_LIMITS,
} from '@/app/_lib/middleware';

export async function GET(request: NextRequest) {
  // Rate limit
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    
    const clientSlug = searchParams.get('clientSlug');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventTypeId = searchParams.get('eventTypeId') || undefined;
    const staffId = searchParams.get('staffId') || undefined;
    const onlineOnly = searchParams.get('onlineOnly') !== 'false';

    // Validate required params
    if (!clientSlug) {
      return ApiResponse.error(
        'clientSlug is required',
        400,
        ErrorCodes.MISSING_REQUIRED
      );
    }

    if (!startDate || !endDate) {
      return ApiResponse.error(
        'startDate and endDate are required',
        400,
        ErrorCodes.MISSING_REQUIRED
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return ApiResponse.error(
        'Dates must be in YYYY-MM-DD format',
        400,
        ErrorCodes.INVALID_INPUT
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

    // Build query
    const query: AvailabilityQuery = {
      startDate,
      endDate,
      eventTypeId,
      staffId,
      onlineOnly,
    };

    // Get availability
    const slots = await provider.getAvailability(query);

    return ApiResponse.success({
      slots,
      query,
      provider: {
        id: provider.providerId,
        name: provider.providerName,
      },
    });

  } catch (error) {
    console.error('Booking availability error:', error);
    return ApiResponse.internalError();
  }
}
