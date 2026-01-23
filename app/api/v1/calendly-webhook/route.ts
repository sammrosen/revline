/**
 * Calendly Webhook Endpoint
 *
 * POST /api/calendly-webhook
 *
 * Processes Calendly webhooks for booking events.
 * Verifies signature and emits triggers to the workflow engine.
 *
 * STANDARDS:
 * - Persist first, verify, dedupe, then process
 * - Uses raw body for signature verification
 * - Race-safe deduplication via WebhookProcessor
 * - Always returns 200 after processing to prevent retries
 */

import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getClientBySlug } from '@/app/_lib/client-gate';
import { getClientIntegration, touchIntegration } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { emitTrigger } from '@/app/_lib/workflow';
import { IntegrationType } from '@prisma/client';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { 
  WebhookProcessor,
  logStructured,
} from '@/app/_lib/reliability';

export async function POST(request: NextRequest) {
  // 1. Read raw body FIRST (can only read once in Next.js)
  const rawBody = await request.text();
  const signature = request.headers.get('calendly-webhook-signature');

  // 2. Parse just enough to get client identifier and event ID
  let payload: CalendlyPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return ApiResponse.error(
      'Invalid JSON payload',
      400,
      ErrorCodes.INVALID_INPUT
    );
  }

  // Extract client identifier from UTM source
  const utmSource = payload.payload?.tracking?.utm_source;
  if (!utmSource) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'calendly_missing_utm_source',
      provider: 'calendly',
    });
    return ApiResponse.error(
      'No client identifier in webhook',
      400,
      ErrorCodes.MISSING_REQUIRED
    );
  }

  // Extract provider event ID (use event URI as unique identifier)
  const providerEventId = payload.payload?.event || 
                          payload.payload?.uri || 
                          `${payload.event}-${payload.payload?.email}-${Date.now()}`;

  try {
    // 3. Look up client by slug (from utm_source)
    const client = await getClientBySlug(utmSource);
    if (!client) {
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'calendly_client_not_found',
        provider: 'calendly',
        metadata: { utmSource },
      });
      return ApiResponse.webhookAck({
        warning: 'Client not found',
      });
    }

    // 4. Register webhook with deduplication
    const registration = await WebhookProcessor.register({
      workspaceId: client.id,
      provider: 'calendly',
      providerEventId,
      rawBody,
      rawHeaders: signature ? { 'calendly-webhook-signature': signature } : undefined,
    });

    // 5. If duplicate, acknowledge and return
    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'calendly_webhook_duplicate',
        workspaceId: client.id,
        provider: 'calendly',
        metadata: { providerEventId },
      });
      return ApiResponse.webhookAck({ 
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    // 6. Claim for processing
    const claimed = await WebhookProcessor.markProcessing(registration.id);
    if (!claimed) {
      return ApiResponse.webhookAck({ 
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    // 7. Check if client is active
    if (client.status !== 'ACTIVE') {
      await WebhookProcessor.markFailed(registration.id, 'Client is paused');
      await emitEvent({
        workspaceId: client.id,
        system: EventSystem.CALENDLY,
        eventType: 'execution_blocked',
        success: false,
        errorMessage: `Client ${utmSource} is paused`,
      });
      return ApiResponse.webhookAck({
        warning: 'Client paused',
        correlationId: registration.correlationId,
      });
    }

    // 8. Check signature
    if (!signature) {
      await WebhookProcessor.markFailed(registration.id, 'Missing signature');
      return ApiResponse.error(
        'Missing signature',
        401,
        ErrorCodes.MISSING_SIGNATURE
      );
    }

    // 9. Get Calendly integration and signing key
    const calendlyIntegration = await getClientIntegration(
      client.id,
      IntegrationType.CALENDLY
    );
    
    if (!calendlyIntegration) {
      await WebhookProcessor.markFailed(registration.id, 'Calendly not configured');
      return ApiResponse.webhookAck({
        warning: 'Calendly not configured',
        correlationId: registration.correlationId,
      });
    }

    const signingKey = calendlyIntegration.secret;
    if (!signingKey) {
      await WebhookProcessor.markFailed(registration.id, 'Webhook signing key not configured');
      return ApiResponse.webhookAck({
        warning: 'Webhook signing key not configured',
        correlationId: registration.correlationId,
      });
    }

    // 10. Verify signature using RAW BODY (not parsed JSON)
    if (!verifyCalendlySignature(rawBody, signature, signingKey)) {
      await WebhookProcessor.markFailed(registration.id, 'Invalid webhook signature');
      await emitEvent({
        workspaceId: client.id,
        system: EventSystem.CALENDLY,
        eventType: 'calendly_signature_invalid',
        success: false,
        errorMessage: 'Invalid webhook signature',
      });
      return ApiResponse.error(
        'Invalid signature',
        401,
        ErrorCodes.INVALID_SIGNATURE
      );
    }

    logStructured({
      correlationId: registration.correlationId,
      event: 'calendly_signature_verified',
      workspaceId: client.id,
      provider: 'calendly',
    });

    // 11. Touch integration health
    await touchIntegration(client.id, IntegrationType.CALENDLY);

    // 12. Extract event data and process
    const eventType = payload.event;
    const email = payload.payload?.email;
    const name = payload.payload?.name;

    if (!email) {
      await WebhookProcessor.markFailed(registration.id, 'No email in payload');
      return ApiResponse.error(
        'No email in payload',
        400,
        ErrorCodes.MISSING_REQUIRED
      );
    }

    // 13. Emit trigger to workflow engine
    if (eventType === 'invitee.created') {
      await emitTrigger(
        client.id,
        { adapter: 'calendly', operation: 'booking_created' },
        {
          email,
          name,
          eventType: payload.payload?.event_type?.name,
          eventUri: payload.payload?.event,
          scheduledAt: payload.payload?.scheduled_event?.start_time,
          correlationId: registration.correlationId,
        }
      );
    } else if (eventType === 'invitee.canceled') {
      await emitTrigger(
        client.id,
        { adapter: 'calendly', operation: 'booking_canceled' },
        {
          email,
          name,
          reason: payload.payload?.cancellation?.reason,
          correlationId: registration.correlationId,
        }
      );
    } else {
      logStructured({
        correlationId: registration.correlationId,
        event: 'calendly_unhandled_event_type',
        workspaceId: client.id,
        provider: 'calendly',
        metadata: { eventType },
      });
    }

    // 14. Mark as processed
    await WebhookProcessor.markProcessed(registration.id);

    logStructured({
      correlationId: registration.correlationId,
      event: 'calendly_webhook_processed',
      workspaceId: client.id,
      provider: 'calendly',
      success: true,
      metadata: { email, eventType },
    });

    return ApiResponse.webhookAck({ 
      received: true,
      correlationId: registration.correlationId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'calendly_webhook_error',
      provider: 'calendly',
      error: errorMessage,
      metadata: { utmSource },
    });

    return ApiResponse.webhookAck({
      warning: 'Internal error processing webhook',
    });
  }
}

// =============================================================================
// SIGNATURE VERIFICATION
// =============================================================================

/**
 * Verify Calendly webhook signature
 *
 * Calendly sends signature in header: "Calendly-Webhook-Signature: t=1492774577,v1=5257a869..."
 *
 * CRITICAL: Uses raw body bytes for signature verification, not parsed JSON.
 *
 * Steps:
 * 1. Extract timestamp (t) and signature (v1) from header
 * 2. Create signed payload: timestamp + '.' + raw_body
 * 3. Compute HMAC SHA256 using webhook signing key
 * 4. Compare computed signature with provided signature
 * 5. Reject if timestamp is >3 minutes old (replay attack prevention)
 */
function verifyCalendlySignature(
  rawBody: string,
  signatureHeader: string,
  signingKey: string
): boolean {
  try {
    const parts = signatureHeader.split(',');
    if (parts.length !== 2) {
      return false;
    }

    const [tPart, v1Part] = parts;
    const timestamp = tPart.split('=')[1];
    const providedSignature = v1Part.split('=')[1];

    if (!timestamp || !providedSignature) {
      return false;
    }

    // Create signed payload using RAW body
    const signedPayload = `${timestamp}.${rawBody}`;

    // Compute expected signature
    const hmac = createHmac('sha256', signingKey);
    hmac.update(signedPayload);
    const expectedSignature = hmac.digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    
    if (expectedBuffer.length !== providedBuffer.length || 
        !timingSafeEqual(expectedBuffer, providedBuffer)) {
      return false;
    }

    // Prevent replay attacks (3 minute tolerance)
    const eventTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - eventTime;

    if (timeDiff > 180) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// TYPES
// =============================================================================

interface CalendlyPayload {
  event: string;
  payload?: {
    event?: string;
    uri?: string;
    email?: string;
    name?: string;
    tracking?: {
      utm_source?: string;
    };
    event_type?: {
      name?: string;
    };
    scheduled_event?: {
      start_time?: string;
    };
    cancellation?: {
      reason?: string;
    };
  };
}
