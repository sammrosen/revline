/**
 * Email Capture Endpoint
 * 
 * POST /api/subscribe
 * 
 * Captures email addresses from landing pages and triggers workflows.
 * Uses the source parameter to route to the correct client.
 * 
 * STANDARDS:
 * - Route only handles HTTP concerns
 * - Business logic delegated to workflow engine
 * - Uses standardized validation and responses
 */

import { NextRequest } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { emitTrigger } from '@/app/_lib/workflow';
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

    // 4. Emit trigger to workflow engine
    const result = await emitTrigger(
      client.id,
      { adapter: 'revline', operation: 'email_captured' },
      { email, name, source }
    );

    // 5. Check results
    const hasFailure = result.executions.some(e => e.status === 'failed');
    
    if (hasFailure) {
      // Some workflows failed, but still return success to the user
      // (the email was received, even if forwarding had issues)
      console.warn('Some workflows failed for email capture:', {
        clientId: client.id,
        email,
        failures: result.executions.filter(e => e.status === 'failed'),
      });
    }

    // Add rate limit headers to successful response
    const response = ApiResponse.success({
      message: result.workflowsExecuted > 0 
        ? 'Successfully subscribed' 
        : 'Received (no workflows configured)',
      subscriber: { email },
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
