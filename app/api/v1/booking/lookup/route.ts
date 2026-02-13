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
import { getActiveWorkspace } from '@/app/_lib/client-gate';
import { getBookingProvider } from '@/app/_lib/booking';
import { 
  rateLimitByIP, 
  getClientIP, 
  RATE_LIMITS,
} from '@/app/_lib/middleware';

export async function POST(request: NextRequest) {
  // Rate limit
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.BOOKING_READ);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  try {
    const body = await request.json();
    // Support both workspaceSlug and clientSlug for backwards compatibility
    const workspaceSlug = body.workspaceSlug || body.clientSlug;
    const { identifier, phoneLastFour } = body;

    // Validate input
    if (!workspaceSlug || typeof workspaceSlug !== 'string') {
      return ApiResponse.error(
        'workspaceSlug is required',
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

    // Validate phoneLastFour format if provided
    if (phoneLastFour && (typeof phoneLastFour !== 'string' || !/^\d{4}$/.test(phoneLastFour))) {
      return ApiResponse.error(
        'phoneLastFour must be exactly 4 digits',
        400,
        ErrorCodes.VALIDATION_FAILED
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

    // Verify phone number if phoneLastFour was provided
    if (phoneLastFour) {
      const memberPhone = customer.providerData?.phone as string | undefined;
      // Strip non-digits from stored phone for comparison
      const phoneDigits = memberPhone?.replace(/\D/g, '') || '';
      
      if (!phoneDigits || !phoneDigits.endsWith(phoneLastFour)) {
        return ApiResponse.error(
          'Phone verification failed. Please check your information and try again.',
          401,
          ErrorCodes.UNAUTHORIZED
        );
      }
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
