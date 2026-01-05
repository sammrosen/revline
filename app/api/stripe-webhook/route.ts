/**
 * Stripe Webhook Endpoint
 * 
 * POST /api/stripe-webhook?source={clientSlug}
 * 
 * Processes Stripe webhooks for payment events.
 * Verifies signature, extracts data, and triggers MailerLite sync.
 * 
 * STANDARDS:
 * - Route only handles HTTP concerns
 * - Webhook verification via StripeAdapter
 * - Business logic delegated to WebhookService
 * - Always returns 200 for partial failures (prevents retries)
 */

import { NextRequest } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { StripeAdapter } from '@/app/_lib/integrations/stripe.adapter';
import { WebhookService } from '@/app/_lib/services';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { 
  rateLimitByClient,
  getRateLimitHeaders,
} from '@/app/_lib/middleware';

export async function POST(request: NextRequest) {
  // 1. Get source from query params
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

  // 2. Rate limit check by client
  const rateLimit = rateLimitByClient(clientSlug);
  if (!rateLimit.allowed) {
    // For webhooks, still return 200 to prevent retries
    return ApiResponse.webhookAck({ 
      warning: 'Rate limited - retry later' 
    });
  }

  try {
    // 3. Get active client
    const client = await getActiveClient(clientSlug);
    if (!client) {
      // Return 200 to prevent Stripe retries
      return ApiResponse.webhookAck({ 
        warning: 'Client unavailable' 
      });
    }

    // 4. Load Stripe adapter
    const stripeAdapter = await StripeAdapter.forClient(client.id);
    if (!stripeAdapter) {
      return ApiResponse.webhookAck({ 
        warning: 'Stripe not configured' 
      });
    }

    // Check if Stripe API key is available
    if (!stripeAdapter.hasApiKey()) {
      return ApiResponse.webhookAck({ 
        warning: 'Stripe API key not configured' 
      });
    }

    // 5. Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return ApiResponse.error(
        'Missing signature',
        400,
        ErrorCodes.MISSING_SIGNATURE
      );
    }

    // 6. Verify webhook and process checkout
    const result = await stripeAdapter.processCheckoutWebhook(body, signature);

    if (!result.success) {
      // Emit failure event for signature verification failures
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

    // 7. If not a checkout event, acknowledge and return
    if (!result.data) {
      return ApiResponse.webhookAck({ processed: false });
    }

    // 8. Process checkout via service
    const checkoutResult = await WebhookService.processStripeCheckout({
      clientId: client.id,
      checkoutData: result.data,
    });

    // 9. Return response with rate limit headers
    const response = ApiResponse.webhookAck({
      processed: true,
      leadId: checkoutResult.data?.leadId,
      warning: checkoutResult.data?.warning,
    });

    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    console.error('Stripe webhook error:', {
      clientSlug,
      error: error instanceof Error ? error.message : 'Unknown',
    });

    // Return 200 to prevent retries
    return ApiResponse.webhookAck({
      warning: 'Internal error processing webhook',
    });
  }
}
