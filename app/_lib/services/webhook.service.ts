/**
 * Webhook Service
 * 
 * @deprecated This service is deprecated in favor of the workflow engine.
 * Use emitTrigger() from '@/app/_lib/workflow' instead.
 * 
 * This file is kept for backwards compatibility.
 * New code should use emitTrigger() directly.
 */

import { emitEvent, EventSystem, upsertLead, updateLeadStage } from '@/app/_lib/event-logger';
import { emitTrigger } from '@/app/_lib/workflow';
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
 * @deprecated Use emitTrigger() from '@/app/_lib/workflow' instead.
 * 
 * Service for handling webhook processing.
 * This is a compatibility wrapper around the workflow engine.
 */
export class WebhookService {
  /**
   * @deprecated Use emitTrigger() instead:
   * 
   * ```typescript
   * await emitTrigger(clientId, {
   *   adapter: 'stripe',
   *   operation: 'payment_succeeded',
   * }, { email, name, amount, product });
   * ```
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

    // Step 3: Emit trigger to workflow engine
    const result = await emitTrigger(
      clientId,
      { adapter: 'stripe', operation: 'payment_succeeded' },
      {
        email,
        name,
        amount: amountTotal,
        product: program,
      }
    );

    // Check for warnings (workflow failures)
    const failedResults = result.executions.filter(e => e.status === 'failed');
    let warning: string | undefined;
    
    if (failedResults.length > 0) {
      warning = failedResults.map(e => e.error).join('; ');
      
      console.warn('Some workflows failed for stripe payment:', {
        clientId,
        leadId,
        failures: failedResults,
      });
    }

    // Step 4: Return success (payment processed, workflows may have warnings)
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
   * @deprecated Use emitTrigger() instead
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

    // Step 3: Emit trigger to workflow engine
    const result = await emitTrigger(
      clientId,
      { adapter: 'calendly', operation: 'booking_created' },
      { email, name, eventType }
    );

    // Check for warnings
    const failedResults = result.executions.filter(e => e.status === 'failed');
    let warning: string | undefined;
    
    if (failedResults.length > 0) {
      warning = failedResults.map(e => e.error).join('; ');
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
   * @deprecated Use emitTrigger() instead
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

    // Step 3: Emit trigger to workflow engine
    const result = await emitTrigger(
      clientId,
      { adapter: 'calendly', operation: 'booking_canceled' },
      { email, name }
    );

    // Check for warnings
    const failedResults = result.executions.filter(e => e.status === 'failed');
    let warning: string | undefined;
    
    if (failedResults.length > 0) {
      warning = failedResults.map(e => e.error).join('; ');
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
      stripe: true, // If we get here, Stripe is configured
      mailerlite: !!mailerliteAdapter && mailerliteAdapter.hasRoutingFor('lead.paid'),
    };
  }
}
