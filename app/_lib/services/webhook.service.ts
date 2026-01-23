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
import { withTransaction } from '@/app/_lib/utils/transaction';

/**
 * Input parameters for processing Stripe checkout
 */
export interface ProcessCheckoutParams {
  workspaceId: string;
  checkoutData: CheckoutData;
}

/**
 * Input parameters for processing Calendly booking
 */
export interface ProcessBookingParams {
  workspaceId: string;
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
   * await emitTrigger(workspaceId, {
   *   adapter: 'stripe',
   *   operation: 'payment_succeeded',
   * }, { email, name, amount, product });
   * ```
   */
  static async processStripeCheckout(
    params: ProcessCheckoutParams
  ): Promise<IntegrationResult<WebhookResult>> {
    const { workspaceId, checkoutData } = params;
    const { email, name, program, amountTotal } = checkoutData;

    // Step 1 & 2: Create/update lead, update stage, and emit event atomically
    let leadId: string;
    try {
      leadId = await withTransaction(async (tx) => {
        const id = await upsertLead({
          workspaceId,
          email,
          source: 'stripe',
          tx,
        });
        await updateLeadStage(id, 'PAID', tx);
        await emitEvent({
          workspaceId,
          leadId: id,
          system: EventSystem.STRIPE,
          eventType: 'stripe_payment_succeeded',
          success: true,
          tx,
        });
        return id;
      });
    } catch (error) {
      console.error('Failed to upsert lead:', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return {
        success: false,
        error: 'Failed to create lead record',
      };
    }

    // Step 3: Emit trigger to workflow engine
    const result = await emitTrigger(
      workspaceId,
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
        workspaceId,
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
    const { workspaceId, email, name, eventType } = params;

    // Step 1 & 2: Create/update lead, update stage, and emit event atomically
    let leadId: string;
    try {
      leadId = await withTransaction(async (tx) => {
        const id = await upsertLead({
          workspaceId,
          email,
          source: 'calendly',
          tx,
        });
        await updateLeadStage(id, 'BOOKED', tx);
        await emitEvent({
          workspaceId,
          leadId: id,
          system: EventSystem.CALENDLY,
          eventType: 'calendly_booking_created',
          success: true,
          tx,
        });
        return id;
      });
    } catch (error) {
      console.error('Failed to upsert lead:', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return {
        success: false,
        error: 'Failed to create lead record',
      };
    }

    // Step 3: Emit trigger to workflow engine
    const result = await emitTrigger(
      workspaceId,
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
    const { workspaceId, email, name } = params;

    // Step 1 & 2: Update lead stage and emit event atomically
    let leadId: string;
    try {
      leadId = await withTransaction(async (tx) => {
        const id = await upsertLead({
          workspaceId,
          email,
          source: 'calendly',
          tx,
        });
        await updateLeadStage(id, 'CAPTURED', tx);
        await emitEvent({
          workspaceId,
          leadId: id,
          system: EventSystem.CALENDLY,
          eventType: 'calendly_booking_canceled',
          success: true,
          tx,
        });
        return id;
      });
    } catch (error) {
      console.error('Failed to update lead:', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return {
        success: false,
        error: 'Failed to update lead record',
      };
    }

    // Step 3: Emit trigger to workflow engine
    const result = await emitTrigger(
      workspaceId,
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
  static async isConfigured(workspaceId: string): Promise<{
    stripe: boolean;
    mailerlite: boolean;
  }> {
    const mailerliteAdapter = await MailerLiteAdapter.forClient(workspaceId);

    return {
      stripe: true, // If we get here, Stripe is configured
      mailerlite: !!mailerliteAdapter && mailerliteAdapter.hasGroups(),
    };
  }
}
