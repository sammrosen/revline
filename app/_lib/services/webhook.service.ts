/**
 * Webhook Service
 * 
 * Orchestrates webhook processing for payment events.
 * Handles lead updates, event emission, and integration calls.
 * 
 * STANDARDS:
 * - Webhook verification is done in the adapter before calling this service
 * - Always emits events for debugging
 * - Returns 200 for partial failures (to prevent retries)
 */

import { emitEvent, EventSystem, upsertLead, updateLeadStage } from '@/app/_lib/event-logger';
import { MailerLiteAdapter } from '@/app/_lib/integrations/mailerlite.adapter';
import { CheckoutData } from '@/app/_lib/integrations/stripe.adapter';
import { IntegrationResult, WebhookResult } from '@/app/_lib/types';

/**
 * Input parameters for processing Stripe checkout
 */
export interface ProcessCheckoutParams {
  clientId: string;
  checkoutData: CheckoutData;
}

/**
 * Service for handling webhook processing
 * 
 * @example
 * // In route handler after verifying webhook:
 * const result = await WebhookService.processStripeCheckout({
 *   clientId: client.id,
 *   checkoutData: {
 *     email: 'user@example.com',
 *     name: 'John',
 *     program: 'premium',
 *   },
 * });
 */
export class WebhookService {
  /**
   * Process a Stripe checkout.session.completed event
   * 
   * Flow:
   * 1. Create/update lead record and mark as PAID
   * 2. Emit payment_succeeded event
   * 3. Load MailerLite adapter
   * 4. Add to customer group
   * 5. Emit success/failure event
   * 6. Return result
   */
  static async processStripeCheckout(
    params: ProcessCheckoutParams
  ): Promise<IntegrationResult<WebhookResult>> {
    const { clientId, checkoutData } = params;
    const { email, name, program } = checkoutData;

    // Step 1: Create/update lead and mark as paid
    let leadId: string;
    try {
      leadId = await upsertLead({
        clientId,
        email,
        source: 'stripe',
      });
      await updateLeadStage(leadId, 'PAID');
    } catch (error) {
      console.error('Failed to upsert lead:', {
        clientId,
        email,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return {
        success: false,
        error: 'Failed to create lead record',
      };
    }

    // Step 2: Emit payment success event
    await emitEvent({
      clientId,
      leadId,
      system: EventSystem.STRIPE,
      eventType: 'stripe_payment_succeeded',
      success: true,
    });

    // Step 3: Load MailerLite adapter
    const adapter = await MailerLiteAdapter.forClient(clientId);
    if (!adapter) {
      // Not configured - return partial success
      return {
        success: true,
        data: {
          received: true,
          processed: true,
          leadId,
          warning: 'MailerLite not configured',
        },
      };
    }

    // Step 4: Add to customer group
    const result = await adapter.addToCustomerGroup(email, name, program);

    // Step 5: Emit success/failure event
    if (!result.success) {
      await emitEvent({
        clientId,
        leadId,
        system: EventSystem.MAILERLITE,
        eventType: 'mailerlite_subscribe_failed',
        success: false,
        errorMessage: result.error,
      });

      // Return partial success - payment succeeded even if MailerLite failed
      return {
        success: true,
        data: {
          received: true,
          processed: true,
          leadId,
          warning: `MailerLite sync failed: ${result.error}`,
        },
      };
    }

    await emitEvent({
      clientId,
      leadId,
      system: EventSystem.MAILERLITE,
      eventType: 'mailerlite_subscribe_success',
      success: true,
    });

    // Step 6: Return success
    return {
      success: true,
      data: {
        received: true,
        processed: true,
        leadId,
      },
    };
  }

  /**
   * Check if webhook processing is properly configured for a client
   */
  static async isConfigured(clientId: string): Promise<{
    stripe: boolean;
    mailerlite: boolean;
  }> {
    const [mailerliteAdapter] = await Promise.all([
      MailerLiteAdapter.forClient(clientId),
    ]);

    return {
      stripe: true, // If we get here, Stripe is configured (verified in route)
      mailerlite: !!mailerliteAdapter && !!mailerliteAdapter.getCustomerGroupId(),
    };
  }
}

