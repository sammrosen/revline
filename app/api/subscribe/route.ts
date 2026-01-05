/**
 * Email Capture Endpoint
 * 
 * POST /api/subscribe
 * 
 * Captures email addresses from landing pages and adds them to MailerLite.
 * Uses the source parameter to route to the correct client.
 * 
 * STANDARDS:
 * - Route only handles HTTP concerns
 * - Business logic delegated to CaptureService
 * - Uses standardized validation and responses
 */

import { NextRequest } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { CaptureService } from '@/app/_lib/services';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { validateCaptureInput } from '@/app/_lib/utils/validation';
import { 
  rateLimitByIP, 
  getClientIP, 
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/app/_lib/middleware';

export async function POST(request: NextRequest) {
  // 1. Rate limit check
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  try {
    // 2. Parse and validate input
    const body = await request.json();
    const validation = validateCaptureInput(body);
    
    if (!validation.success) {
      return ApiResponse.error(
        validation.error || 'Invalid input',
        400,
        ErrorCodes.INVALID_EMAIL
      );
    }

    const { email, name, source } = validation.data!;

    // 3. Get active client
    const client = await getActiveClient(source);
    if (!client) {
      return ApiResponse.unavailable();
    }

    // 4. Capture email via service
    const result = await CaptureService.captureEmail({
      clientId: client.id,
      email,
      name,
      source,
    });

    // 5. Return response
    if (!result.success) {
      return ApiResponse.error(
        result.error || 'Failed to subscribe',
        500,
        ErrorCodes.INTEGRATION_ERROR
      );
    }

    // Add rate limit headers to successful response
    const response = ApiResponse.success({
      message: result.data!.message,
        subscriber: {
        email: result.data!.email,
        id: result.data!.subscriberId,
        },
    });

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    console.error('Subscribe API error:', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return ApiResponse.internalError();
  }
}
