/**
 * Booking Customer Lookup
 * 
 * POST /api/v1/booking/lookup
 * 
 * Looks up a customer by identifier (barcode, email, etc.)
 * for providers that require customer verification before booking.
 */

import { NextRequest } from 'next/server';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { getActiveClient } from '@/app/_lib/client-gate';
import { getBookingProvider } from '@/app/_lib/booking';
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
    const { clientSlug, identifier } = body;

    // Validate input
    if (!clientSlug || typeof clientSlug !== 'string') {
      return ApiResponse.error(
        'clientSlug is required',
        400,
        ErrorCodes.MISSING_REQUIRED
      );
    }

    if (!identifier || typeof identifier !== 'string') {
      return ApiResponse.error(
        'identifier is required',
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

    // Check if provider supports customer lookup
    if (!provider.lookupCustomer) {
      return ApiResponse.error(
        'Provider does not support customer lookup',
        400,
        ErrorCodes.INVALID_STATE
      );
    }

    // Look up customer
    const customer = await provider.lookupCustomer(identifier);
    
    if (!customer) {
      return ApiResponse.error(
        'Customer not found',
        404,
        ErrorCodes.NOT_FOUND
      );
    }

    return ApiResponse.success({
      customer,
      capabilities: provider.capabilities,
    });

  } catch (error) {
    console.error('Booking lookup error:', error);
    return ApiResponse.internalError();
  }
}
