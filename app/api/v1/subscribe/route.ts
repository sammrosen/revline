/**
 * Email Capture Endpoint
 * 
 * POST /api/v1/subscribe
 * 
 * Captures email addresses from landing pages and triggers workflows.
 * Uses the source parameter to route to the correct client.
 * 
 * UNIFIED CAPTURE:
 * - First tries to use Capture system (WorkspaceForm with 'email_captured' trigger)
 * - Falls back to direct revline.email_captured trigger for backward compatibility
 * 
 * STANDARDS:
 * - Persist first, then process
 * - Deduplication prevents double-submissions
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
import {
  WebhookProcessor,
  logStructured,
} from '@/app/_lib/reliability';
import { submitCaptureTrigger } from '@/app/_lib/services/capture.service';

export async function POST(request: NextRequest) {
  // 1. Rate limit check
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  // 2. Read raw body for consistency and storage
  const rawBody = await request.text();
  
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return ApiResponse.error(
      'Invalid JSON',
      400,
      ErrorCodes.INVALID_INPUT
    );
  }

  try {
    // 3. Validate input
    const validation = validateCaptureInput(body);
    
    if (!validation.success) {
      return ApiResponse.error(
        validation.error || 'Invalid input',
        400,
        ErrorCodes.INVALID_EMAIL
      );
    }

    const { email, name, source } = validation.data!;

    // 4. Get active client
    const client = await getActiveClient(source);
    if (!client) {
      return ApiResponse.unavailable();
    }

    // 5. Generate unique event ID for deduplication
    // Use email + source + minute timestamp to prevent rapid double-submissions
    const minuteTimestamp = Math.floor(Date.now() / 60000);
    const providerEventId = `capture-${email}-${source}-${minuteTimestamp}`;

    // 6. Register with WebhookProcessor for deduplication and audit
    const registration = await WebhookProcessor.register({
      workspaceId: client.id,
      provider: 'revline',
      providerEventId,
      rawBody,
    });

    // 7. If duplicate (same email in same minute), still return success
    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'email_capture_duplicate',
        workspaceId: client.id,
        provider: 'revline',
        metadata: { email, source },
      });
      
      // Return success to user (they don't need to know about dedup)
      const response = ApiResponse.success({
        message: 'Successfully subscribed',
        subscriber: { email },
      });
      
      const headers = getRateLimitHeaders(rateLimit);
      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }
      
      return response;
    }

    // 8. Claim for processing
    await WebhookProcessor.markProcessing(registration.id);

    // 9. Try Capture system first, then fall back to revline for backward compatibility
    // This allows workspaces to migrate to Capture at their own pace
    const captureResult = await submitCaptureTrigger(
      client.id,
      'email_captured', // Standard trigger name for email capture
      { 
        email, 
        firstName: name,
        source,
        correlationId: registration.correlationId,
      }
    );
    
    // Track if capture system handled it (for logging)
    let usedCaptureSystem = false;
    
    // If capture worked (form exists and trigger fired), we're done
    // Otherwise, fall back to direct revline trigger for backward compatibility
    let result;
    if (captureResult.success) {
      usedCaptureSystem = true;
      // Capture system handled it - workflows are triggered internally
      // Create minimal compatible result structure
      result = {
        workflowsFound: 1,
        workflowsExecuted: 1,
        executions: [] as Array<{ status: 'completed' | 'failed'; error?: string }>,
      };
      
      logStructured({
        correlationId: registration.correlationId,
        event: 'email_capture_via_capture_system',
        workspaceId: client.id,
        provider: 'capture',
        metadata: { email, source, captureId: captureResult.captureId },
      });
    } else {
      // Fall back to direct revline trigger (backward compatibility)
      result = await emitTrigger(
        client.id,
        { adapter: 'revline', operation: 'email_captured' },
        { 
          email, 
          name, 
          source,
          correlationId: registration.correlationId,
        }
      );
    }

    // 10. Check results (only for revline trigger path)
    const hasFailure = !usedCaptureSystem && result.executions.some(e => e.status === 'failed');
    
    if (hasFailure) {
      const failures = result.executions
        .filter(e => e.status === 'failed')
        .map(e => e.error || 'Unknown error')
        .join('; ');
      
      logStructured({
        correlationId: registration.correlationId,
        event: 'email_capture_partial_failure',
        workspaceId: client.id,
        provider: 'revline',
        error: failures,
        metadata: { email },
      });
      
      // Mark as processed anyway (partial success)
      await WebhookProcessor.markProcessed(registration.id);
    } else {
      await WebhookProcessor.markProcessed(registration.id);
    }

    logStructured({
      correlationId: registration.correlationId,
      event: 'email_capture_processed',
      workspaceId: client.id,
      provider: 'revline',
      success: true,
      metadata: { 
        email, 
        source,
        workflowsExecuted: result.workflowsExecuted,
      },
    });

    // 11. Return success response
    const response = ApiResponse.success({
      message: result.workflowsExecuted > 0 
        ? 'Successfully subscribed' 
        : 'Received (no workflows configured)',
      subscriber: { email },
    });

    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'email_capture_error',
      provider: 'revline',
      error: errorMessage,
    });
    
    return ApiResponse.internalError();
  }
}
