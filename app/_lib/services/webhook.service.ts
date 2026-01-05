/**
 * Webhook Service
 * 
 * Orchestrates webhook processing for payment and booking events.
 * Handles lead updates, event emission, and dispatches to integrations.
 * 
 * STANDARDS:
 * - Webhook verification is done in the adapter before calling this service
 * - Always emits events for debugging
 * - Uses action dispatcher for integration routing
 * - Returns 200 for partial failures (to prevent retries)
 */

import { emitEvent, EventSystem, upsertLead, updateLeadStage } from '@/app/_lib/event-logger';
import { dispatchAction } from '@/app/_lib/actions/dispatcher';
import { RevLineAction } from '@/app/_lib/actions';
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
 * Input parameters for processing Calendly booking
 */
export interface ProcessBookingParams {
  clientId: string;
  email: string;
  name?: string;
  eventType?: string;
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
   * 3. Dispatch 'lead.paid' action to all integrations
   * 4. Return result
   */
  static async processStripeCheckout(
    params: ProcessCheckoutParams
  ): Promise<IntegrationResult<WebhookResult>> {
    const { clientId, checkoutData } = params;
    const { email, name, program, amountTotal } = checkoutData;

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

    // Step 3: Dispatch 'lead.paid' action to all integrations
    // Use program-specific action if program is specified
    const action: RevLineAction = program ? `lead.paid:${program}` : 'lead.paid';
    
    const dispatchResult = await dispatchAction(clientId, action, {
      email,
      name,
      program,
      amount: amountTotal,
    });

    // Check for warnings (integration failures)
    const failedResults = dispatchResult.results.filter(r => !r.result.success);
    let warning: string | undefined;
    
    if (failedResults.length > 0) {
      warning = failedResults
        .map(r => `${r.integration}: ${r.result.error}`)
        .join('; ');
      
      console.warn('Some integrations failed for lead.paid:', {
        clientId,
        leadId,
        failures: failedResults.map(r => ({
          integration: r.integration,
          error: r.result.error,
        })),
      });
    }

    // Step 4: Return success (payment processed, integrations may have warnings)
    return {
      success: true,
      data: {
        received: true,
        processed: true,
        leadId,
        warning,
      },
    };
  }

  /**
   * Process a Calendly booking created event
   * 
   * Flow:
   * 1. Create/update lead record and mark as BOOKED
   * 2. Emit booking_created event
   * 3. Dispatch 'lead.booked' action to all integrations
   * 4. Return result
   */
  static async processCalendlyBooking(
    params: ProcessBookingParams
  ): Promise<IntegrationResult<WebhookResult>> {
    const { clientId, email, name, eventType } = params;

    // Step 1: Create/update lead and mark as booked
    let leadId: string;
    try {
      leadId = await upsertLead({
        clientId,
        email,
        source: 'calendly',
      });
      await updateLeadStage(leadId, 'BOOKED');
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

    // Step 2: Emit booking created event
    await emitEvent({
      clientId,
      leadId,
      system: EventSystem.CALENDLY,
      eventType: 'calendly_booking_created',
      success: true,
    });

    // Step 3: Dispatch 'lead.booked' action to all integrations
    const dispatchResult = await dispatchAction(clientId, 'lead.booked', {
      email,
      name,
      metadata: { eventType },
    });

    // Check for warnings
    const failedResults = dispatchResult.results.filter(r => !r.result.success);
    let warning: string | undefined;
    
    if (failedResults.length > 0) {
      warning = failedResults
        .map(r => `${r.integration}: ${r.result.error}`)
        .join('; ');
    }

    // Step 4: Return success
    return {
      success: true,
      data: {
        received: true,
        processed: true,
        leadId,
        warning,
      },
    };
  }

  /**
   * Process a Calendly booking canceled event
   * 
   * Flow:
   * 1. Update lead stage back to CAPTURED
   * 2. Emit booking_canceled event
   * 3. Dispatch 'lead.canceled' action to all integrations
   * 4. Return result
   */
  static async processCalendlyCancellation(
    params: ProcessBookingParams
  ): Promise<IntegrationResult<WebhookResult>> {
    const { clientId, email, name } = params;

    // Step 1: Find lead and revert to captured
    let leadId: string;
    try {
      leadId = await upsertLead({
        clientId,
        email,
        source: 'calendly',
      });
      await updateLeadStage(leadId, 'CAPTURED');
    } catch (error) {
      console.error('Failed to update lead:', {
        clientId,
        email,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return {
        success: false,
        error: 'Failed to update lead record',
      };
    }

    // Step 2: Emit booking canceled event
    await emitEvent({
      clientId,
      leadId,
      system: EventSystem.CALENDLY,
      eventType: 'calendly_booking_canceled',
      success: true,
    });

    // Step 3: Dispatch 'lead.canceled' action to all integrations
    const dispatchResult = await dispatchAction(clientId, 'lead.canceled', {
      email,
      name,
    });

    // Check for warnings
    const failedResults = dispatchResult.results.filter(r => !r.result.success);
    let warning: string | undefined;
    
    if (failedResults.length > 0) {
      warning = failedResults
        .map(r => `${r.integration}: ${r.result.error}`)
        .join('; ');
    }

    // Step 4: Return success
    return {
      success: true,
      data: {
        received: true,
        processed: true,
        leadId,
        warning,
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
    const mailerliteAdapter = await MailerLiteAdapter.forClient(clientId);

    return {
      stripe: true, // If we get here, Stripe is configured (verified in route)
      mailerlite: !!mailerliteAdapter && mailerliteAdapter.hasRoutingFor('lead.paid'),
    };
  }
}
