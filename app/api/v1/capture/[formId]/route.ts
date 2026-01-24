/**
 * Capture Endpoint
 * 
 * POST /api/v1/capture/[formId]
 * 
 * Accepts form submissions from external websites (browser mode) or
 * server-to-server integrations (server mode with HMAC).
 * 
 * Browser Mode:
 * - Validates Origin against allowedOrigins
 * - Rate limited by IP
 * - Always returns 204 (never breaks client flow)
 * 
 * Server Mode:
 * - Validates HMAC signature (X-RevLine-Signature)
 * - Validates timestamp (X-RevLine-Timestamp)
 * - Rate limited by workspace
 * - Returns proper error codes
 * 
 * STANDARDS:
 * - Workspace isolation enforced
 * - Event-driven debugging
 * - Fail-safe defaults (204 for browser mode)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  getFormById,
  validateCaptureRequest,
  processCapturePayload,
} from '@/app/_lib/services/capture.service';
import { rateLimitByIP, rateLimitByClient, getClientIP } from '@/app/_lib/middleware/rate-limit';
import { emitEvent } from '@/app/_lib/event-logger';
import { EventSystem } from '@prisma/client';
import { RATE_LIMITS } from '@/app/_lib/types';
import {
  SERVER_SIGNATURE_HEADER,
  SERVER_TIMESTAMP_HEADER,
  MAX_PAYLOAD_SIZE,
} from '@/app/_lib/types/capture';

// =============================================================================
// CORS HEADERS
// =============================================================================

function getCorsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
  // Only set CORS headers if origin is in allowlist
  if (!origin || allowedOrigins.length === 0) {
    return {};
  }

  const isAllowed = allowedOrigins.some(allowed => {
    if (allowed === origin) return true;
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin === `https://${domain}`;
    }
    return false;
  });

  if (!isAllowed) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// =============================================================================
// OPTIONS - CORS Preflight
// =============================================================================

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
): Promise<NextResponse> {
  const { formId } = await params;

  // Load form to get allowed origins
  const form = await getFormById(formId);
  if (!form) {
    return new NextResponse(null, { status: 204 });
  }

  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin, form.security.allowedOrigins);

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Content-Length': '0',
    },
  });
}

// =============================================================================
// POST - Capture Form Submission
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
): Promise<NextResponse> {
  const { formId } = await params;
  const captureId = `cap_${Date.now().toString(36)}`;

  // Helper to create responses with standard headers
  const respond = (
    status: number,
    body: object | null,
    corsHeaders: Record<string, string> = {}
  ) => {
    const headers: Record<string, string> = {
      'X-RevLine-Capture-Id': captureId,
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders,
    };

    if (status === 204) {
      return new NextResponse(null, { status, headers });
    }

    return NextResponse.json(body, { status, headers });
  };

  // Helper for browser mode - always 204
  const browserResponse = (corsHeaders: Record<string, string> = {}) => {
    return respond(204, null, corsHeaders);
  };

  try {
    // 1. Load form configuration
    const form = await getFormById(formId);
    if (!form) {
      // Form not found - return 204 for browser (don't break client)
      // Check if this looks like browser mode (no signature headers)
      const hasSignature = request.headers.get(SERVER_SIGNATURE_HEADER);
      if (!hasSignature) {
        return browserResponse();
      }
      return respond(404, { error: 'Form not found', captureId });
    }

    // Get origin and CORS headers
    const origin = request.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin, form.security.allowedOrigins);

    // 2. Check content length
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_PAYLOAD_SIZE) {
      // Check mode to determine response
      const hasSignature = request.headers.get(SERVER_SIGNATURE_HEADER);
      if (!hasSignature) {
        return browserResponse(corsHeaders);
      }
      return respond(413, { error: 'Payload too large', captureId }, corsHeaders);
    }

    // 3. Parse body (support both application/json and text/plain for sendBeacon)
    let rawPayload: unknown;
    const contentType = request.headers.get('content-type') || '';

    try {
      const rawBody = await request.text();

      if (rawBody.length > MAX_PAYLOAD_SIZE) {
        const hasSignature = request.headers.get(SERVER_SIGNATURE_HEADER);
        if (!hasSignature) {
          return browserResponse(corsHeaders);
        }
        return respond(413, { error: 'Payload too large', captureId }, corsHeaders);
      }

      rawPayload = JSON.parse(rawBody);
    } catch {
      const hasSignature = request.headers.get(SERVER_SIGNATURE_HEADER);
      if (!hasSignature) {
        return browserResponse(corsHeaders);
      }
      return respond(400, { error: 'Invalid JSON', captureId }, corsHeaders);
    }

    // 4. Determine mode and apply rate limiting
    const hasSignature = request.headers.get(SERVER_SIGNATURE_HEADER);
    const isBrowserMode = !hasSignature;

    if (isBrowserMode) {
      // Browser mode: rate limit by IP
      const rateLimitResult = await rateLimitByIP(
        request.headers,
        RATE_LIMITS.CAPTURE_BROWSER,
        `capture:${formId}`
      );
      if (rateLimitResult) {
        // Rate limited - still return 204 for browser mode
        await emitEvent({
          workspaceId: form.workspaceId,
          system: EventSystem.BACKEND,
          eventType: 'capture_rate_limited',
          success: false,
          errorMessage: 'Rate limited',
        });
        return browserResponse(corsHeaders);
      }
    } else {
      // Server mode: rate limit by workspace
      const rateLimitResult = await rateLimitByClient(
        form.workspaceId,
        RATE_LIMITS.CAPTURE_SERVER,
        'capture'
      );
      if (rateLimitResult) {
        return respond(429, { error: 'Rate limited', captureId }, corsHeaders);
      }
    }

    // 5. Validate capture request
    const validationResult = await validateCaptureRequest(form, rawPayload, {
      origin,
      signature: request.headers.get(SERVER_SIGNATURE_HEADER),
      timestamp: request.headers.get(SERVER_TIMESTAMP_HEADER),
    });

    if (!validationResult.valid) {
      // Log rejection event
      await emitEvent({
        workspaceId: form.workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'capture_rejected',
        success: false,
        errorMessage: validationResult.errors.join('; '),
      });

      if (isBrowserMode) {
        return browserResponse(corsHeaders);
      }
      return respond(400, { error: validationResult.errors[0], captureId }, corsHeaders);
    }

    // 6. Log received event
    const ipHash = hashIP(getClientIP(request.headers) || 'unknown');
    await emitEvent({
      workspaceId: form.workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'capture_received',
      success: true,
    });

    // 7. Process capture
    const result = await processCapturePayload(
      form,
      validationResult.sanitizedPayload!,
      validationResult.mode as 'browser' | 'server',
      { origin, ipHash }
    );

    if (!result.success) {
      if (isBrowserMode) {
        return browserResponse(corsHeaders);
      }
      return respond(500, { error: result.error, captureId }, corsHeaders);
    }

    // 8. Success response
    if (isBrowserMode) {
      return browserResponse(corsHeaders);
    }

    return respond(200, {
      success: true,
      captureId: result.captureId,
      leadId: result.leadId,
      isNewLead: result.isNewLead,
    }, corsHeaders);

  } catch (error) {
    console.error('Capture endpoint error:', error);

    // Try to determine mode for response type
    const hasSignature = request.headers.get(SERVER_SIGNATURE_HEADER);
    if (!hasSignature) {
      return browserResponse();
    }

    return respond(500, { error: 'Internal server error', captureId });
  }
}

/**
 * Hash IP address for logging (privacy-preserving)
 */
function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').substring(0, 16);
}
