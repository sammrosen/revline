/**
 * Resend Webhook Endpoint
 *
 * POST /api/v1/resend-webhook?source={workspaceSlug}
 *
 * Processes Resend webhooks for email delivery events:
 * - email.bounced, email.complained, email.failed, email.delivery_delayed
 * - email.delivered (clears transient error states)
 *
 * Updates Lead.errorState with provider-prefixed values (e.g., "resend.email_bounced").
 * Emits workflow triggers so users can automate responses (e.g., remove bounced leads).
 *
 * STANDARDS:
 * - Persist first, verify, dedupe, then process
 * - Uses raw body for Svix signature verification
 * - Race-safe deduplication via WebhookProcessor
 * - Always returns 200 for processed/duplicate events (prevents Resend retries)
 * - Non-destructive: only sets errorState, never changes stage or properties
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import {
  ResendAdapter,
  resendEventToErrorState,
  TRANSIENT_ERROR_STATES,
} from '@/app/_lib/integrations';
import type { ResendWebhookEvent } from '@/app/_lib/integrations';
import { emitTrigger } from '@/app/_lib/workflow';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, updateLeadErrorState, EventSystem } from '@/app/_lib/event-logger';
import { rateLimitByClient, getRateLimitHeaders } from '@/app/_lib/middleware';
import {
  WebhookProcessor,
  logStructured,
} from '@/app/_lib/reliability';

/**
 * Map Resend event types to our workflow trigger operation names.
 * Only events that should fire a trigger are listed.
 */
const EVENT_TO_TRIGGER: Record<string, string> = {
  'email.bounced': 'email_bounced',
  'email.complained': 'email_complained',
  'email.failed': 'email_failed',
  'email.delivery_delayed': 'email_delivery_delayed',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read raw body FIRST (can only read once in Next.js)
  const rawBody = await request.text();

  // Extract svix headers for verification + dedup
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  // 2. Get source from query params
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');

  if (!source) {
    return ApiResponse.error(
      'Missing source parameter',
      400,
      ErrorCodes.MISSING_REQUIRED
    );
  }

  const clientSlug = source.toLowerCase();

  // 3. Rate limit check by client
  const rateLimit = rateLimitByClient(clientSlug);
  if (!rateLimit.allowed) {
    return ApiResponse.webhookAck({
      warning: 'Rate limited - retry later',
    });
  }

  try {
    // 4. Get active workspace
    const client = await getActiveClient(clientSlug);
    if (!client) {
      return ApiResponse.webhookAck({
        warning: 'Client unavailable',
      });
    }

    // 5. Extract provider event ID (svix-id header is authoritative for Resend)
    const providerEventId = svixId || (() => {
      // Fallback: try to extract from body
      try {
        const parsed = JSON.parse(rawBody);
        return parsed.data?.email_id || `resend-${Date.now()}`;
      } catch {
        return `resend-${Date.now()}`;
      }
    })();

    // 6. Register webhook with deduplication
    const registration = await WebhookProcessor.register({
      workspaceId: client.id,
      provider: 'resend',
      providerEventId,
      rawBody,
      rawHeaders: svixId ? {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp || '',
        'svix-signature': svixSignature || '',
      } : undefined,
    });

    // 7. If duplicate, acknowledge and return
    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'resend_webhook_duplicate',
        workspaceId: client.id,
        provider: 'resend',
        metadata: { providerEventId },
      });
      return ApiResponse.webhookAck({
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    // 8. Claim for processing
    const claimed = await WebhookProcessor.markProcessing(registration.id);
    if (!claimed) {
      return ApiResponse.webhookAck({
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    // 9. Check signature headers
    if (!svixId || !svixTimestamp || !svixSignature) {
      await WebhookProcessor.markFailed(registration.id, 'Missing svix signature headers');
      return ApiResponse.error(
        'Missing signature headers',
        400,
        ErrorCodes.MISSING_SIGNATURE
      );
    }

    // 10. Load Resend adapter
    const resendAdapter = await ResendAdapter.forWorkspace(client.id);
    if (!resendAdapter) {
      await WebhookProcessor.markFailed(registration.id, 'Resend not configured');
      return ApiResponse.webhookAck({
        warning: 'Resend not configured',
      });
    }

    if (!resendAdapter.isWebhookConfigured('delivery')) {
      await WebhookProcessor.markFailed(registration.id, 'Delivery webhook secret not configured');
      return ApiResponse.webhookAck({
        warning: 'Delivery webhook secret not configured',
      });
    }

    // 11. Verify webhook signature using raw body + svix headers
    const verification = resendAdapter.verifyWebhook(rawBody, {
      svixId,
      svixTimestamp,
      svixSignature,
    }, 'delivery');

    if (!verification.valid) {
      await WebhookProcessor.markFailed(registration.id, verification.error || 'Signature verification failed');
      await emitEvent({
        workspaceId: client.id,
        system: EventSystem.RESEND,
        eventType: 'resend_webhook_invalid_signature',
        success: false,
        errorMessage: verification.error,
      });

      return ApiResponse.error(
        verification.error || 'Webhook verification failed',
        400,
        ErrorCodes.INVALID_SIGNATURE
      );
    }

    // 12. Parse the verified payload
    const event = verification.payload as ResendWebhookEvent;
    const eventType = event.type;
    const emailRecipients = event.data?.to || [];
    const primaryEmail = emailRecipients[0] || null;
    const bounceInfo = event.data?.bounce;

    logStructured({
      correlationId: registration.correlationId,
      event: 'resend_webhook_received',
      workspaceId: client.id,
      provider: 'resend',
      metadata: {
        eventType,
        emailId: event.data?.email_id,
        hasRecipient: !!primaryEmail,
      },
    });

    // 13. Process the event
    let leadId: string | null = null;
    let triggerOperation: string | null = null;

    if (primaryEmail) {
      const errorState = resendEventToErrorState(eventType);

      if (errorState) {
        // Error event: set the error state on the lead
        leadId = await updateLeadErrorState({
          workspaceId: client.id,
          email: primaryEmail,
          errorState,
        });

        triggerOperation = EVENT_TO_TRIGGER[eventType] || null;

      } else if (eventType === 'email.delivered') {
        // Delivery event: clear ONLY transient error states
        // Permanent states (bounced, complained, failed) are NOT auto-cleared
        for (const transientState of TRANSIENT_ERROR_STATES) {
          leadId = await updateLeadErrorState({
            workspaceId: client.id,
            email: primaryEmail,
            errorState: null,
            onlyIfCurrent: transientState,
          });
          if (leadId) break; // Found and cleared
        }
      }
      // Other events (email.sent, email.opened, email.clicked) are logged but don't change errorState
    }

    // 14. Emit event for audit trail
    await emitEvent({
      workspaceId: client.id,
      leadId: leadId || undefined,
      system: EventSystem.RESEND,
      eventType: `resend_${eventType.replace('.', '_')}`,
      success: true,
      errorMessage: bounceInfo
        ? `${bounceInfo.type}: ${bounceInfo.message} (${bounceInfo.subType})`
        : undefined,
    });

    // 15. Emit workflow trigger (only for error events that map to triggers)
    let warning: string | undefined;
    if (triggerOperation && primaryEmail) {
      const triggerResult = await emitTrigger(
        client.id,
        { adapter: 'resend', operation: triggerOperation },
        {
          email: primaryEmail,
          error_state: resendEventToErrorState(eventType),
          bounce_type: bounceInfo?.type,
          bounce_message: bounceInfo?.message,
          subject: event.data?.subject,
          correlationId: registration.correlationId,
        }
      );

      const hasFailure = triggerResult.executions.some((e) => e.status === 'failed');
      if (hasFailure) {
        warning = triggerResult.executions
          .filter((e) => e.status === 'failed')
          .map((e) => e.error)
          .join('; ');

        logStructured({
          correlationId: registration.correlationId,
          event: 'resend_workflow_partial_failure',
          workspaceId: client.id,
          provider: 'resend',
          error: warning,
          metadata: { email: primaryEmail },
        });
      }
    }

    // 16. Mark as processed
    await WebhookProcessor.markProcessed(registration.id);

    logStructured({
      correlationId: registration.correlationId,
      event: 'resend_webhook_processed',
      workspaceId: client.id,
      provider: 'resend',
      success: true,
      metadata: {
        eventType,
        leadUpdated: !!leadId,
        triggerFired: !!triggerOperation,
      },
    });

    // 17. Return response with rate limit headers
    const response = ApiResponse.webhookAck({
      processed: true,
      correlationId: registration.correlationId,
      warning,
    });

    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'resend_webhook_error',
      workspaceId: clientSlug,
      provider: 'resend',
      error: errorMessage,
    });

    // Return 200 to prevent Resend retries
    return ApiResponse.webhookAck({
      warning: 'Internal error processing webhook',
    });
  }
}
