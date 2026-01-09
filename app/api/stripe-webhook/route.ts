/**
 * Stripe Webhook Endpoint
 *
 * POST /api/stripe-webhook?source={clientSlug}
 *
 * Processes Stripe webhooks for payment events.
 * Verifies signature and emits triggers to the workflow engine.
 *
 * STANDARDS:
 * - Persist first, verify, dedupe, then process
 * - Uses raw body for signature verification
 * - Race-safe deduplication via WebhookProcessor
 * - Always returns 200 for processed/duplicate events (prevents retries)
 */

import { NextRequest } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { StripeAdapter } from '@/app/_lib/integrations/stripe.adapter';
import { emitTrigger } from '@/app/_lib/workflow';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { rateLimitByClient, getRateLimitHeaders } from '@/app/_lib/middleware';
import { 
  WebhookProcessor, 
  extractProviderEventId,
  logStructured,
} from '@/app/_lib/reliability';

export async function POST(request: NextRequest) {
  // 1. Read raw body FIRST (can only read once in Next.js)
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

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
    // 4. Get active client
    const client = await getActiveClient(clientSlug);
    if (!client) {
      return ApiResponse.webhookAck({
        warning: 'Client unavailable',
      });
    }

    // 5. Extract provider event ID from raw body
    const providerEventId = extractProviderEventId('stripe', rawBody);
    if (!providerEventId) {
      return ApiResponse.error(
        'Could not extract event ID from webhook',
        400,
        ErrorCodes.INVALID_INPUT
      );
    }

    // 6. Register webhook with deduplication
    const registration = await WebhookProcessor.register({
      clientId: client.id,
      provider: 'stripe',
      providerEventId,
      rawBody,
      rawHeaders: signature ? { 'stripe-signature': signature } : undefined,
    });

    // 7. If duplicate, acknowledge and return
    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'stripe_webhook_duplicate',
        clientId: client.id,
        provider: 'stripe',
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
      // Another worker claimed it
      return ApiResponse.webhookAck({ 
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    // 9. Check signature
    if (!signature) {
      await WebhookProcessor.markFailed(registration.id, 'Missing signature');
      return ApiResponse.error(
        'Missing signature',
        400,
        ErrorCodes.MISSING_SIGNATURE
      );
    }

    // 10. Load Stripe adapter
    const stripeAdapter = await StripeAdapter.forClient(client.id);
    if (!stripeAdapter) {
      await WebhookProcessor.markFailed(registration.id, 'Stripe not configured');
      return ApiResponse.webhookAck({
        warning: 'Stripe not configured',
      });
    }

    if (!stripeAdapter.hasApiKey()) {
      await WebhookProcessor.markFailed(registration.id, 'Stripe API key not configured');
      return ApiResponse.webhookAck({
        warning: 'Stripe API key not configured',
      });
    }

    // 11. Verify webhook signature using raw body
    const result = await stripeAdapter.processCheckoutWebhook(rawBody, signature);

    if (!result.success) {
      await WebhookProcessor.markFailed(registration.id, result.error || 'Signature verification failed');
      await emitEvent({
        clientId: client.id,
        system: EventSystem.STRIPE,
        eventType: 'stripe_webhook_invalid_signature',
        success: false,
        errorMessage: result.error,
      });

      return ApiResponse.error(
        result.error || 'Webhook verification failed',
        400,
        ErrorCodes.INVALID_SIGNATURE
      );
    }

    // 12. If not a checkout event, mark processed and return
    if (!result.data) {
      await WebhookProcessor.markProcessed(registration.id);
      return ApiResponse.webhookAck({ 
        processed: false,
        correlationId: registration.correlationId,
      });
    }

    // 13. Emit trigger to workflow engine
    const checkoutData = result.data;
    const triggerResult = await emitTrigger(
      client.id,
      { adapter: 'stripe', operation: 'payment_succeeded' },
      {
        email: checkoutData.email,
        name: checkoutData.name,
        amount: checkoutData.amountTotal,
        currency: checkoutData.currency || 'usd',
        product: checkoutData.program,
        correlationId: registration.correlationId,
      }
    );

    // 14. Check for workflow failures
    const hasFailure = triggerResult.executions.some((e) => e.status === 'failed');
    let warning: string | undefined;

    if (hasFailure) {
      warning = triggerResult.executions
        .filter((e) => e.status === 'failed')
        .map((e) => e.error)
        .join('; ');

      logStructured({
        correlationId: registration.correlationId,
        event: 'stripe_workflow_partial_failure',
        clientId: client.id,
        provider: 'stripe',
        error: warning,
        metadata: { email: checkoutData.email },
      });
    }

    // 15. Mark as processed
    await WebhookProcessor.markProcessed(registration.id);

    logStructured({
      correlationId: registration.correlationId,
      event: 'stripe_webhook_processed',
      clientId: client.id,
      provider: 'stripe',
      success: true,
      metadata: { 
        email: checkoutData.email,
        workflowsExecuted: triggerResult.workflowsExecuted,
      },
    });

    // 16. Return response with rate limit headers
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
      event: 'stripe_webhook_error',
      clientId: clientSlug,
      provider: 'stripe',
      error: errorMessage,
    });

    // Return 200 to prevent retries
    return ApiResponse.webhookAck({
      warning: 'Internal error processing webhook',
    });
  }
}
