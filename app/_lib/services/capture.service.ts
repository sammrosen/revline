/**
 * Capture Service
 * 
 * Orchestrates the email capture flow from landing pages.
 * Handles lead creation, event emission, and integration calls.
 * 
 * STANDARDS:
 * - Single responsibility: email capture orchestration
 * - Always emits events for debugging
 * - Returns structured results for route handlers
 */

import { emitEvent, EventSystem, upsertLead } from '@/app/_lib/event-logger';
import { MailerLiteAdapter } from '@/app/_lib/integrations/mailerlite.adapter';
import { IntegrationResult, CaptureResult } from '@/app/_lib/types';
import { withTransaction } from '@/app/_lib/utils/transaction';

/**
 * Input parameters for email capture
 */
export interface CaptureEmailParams {
  clientId: string;
  email: string;
  name?: string;
  source?: string;
}

/**
 * Service for handling email capture operations
 * 
 * @example
 * // In route handler:
 * const result = await CaptureService.captureEmail({
 *   clientId: client.id,
 *   email: 'user@example.com',
 *   name: 'John',
 *   source: 'landing',
 * });
 * 
 * if (!result.success) {
 *   return ApiResponse.error(result.error, 500);
 * }
 * return ApiResponse.success(result.data);
 */
export class CaptureService {
  /**
   * Capture an email from a landing page
   * 
   * Flow:
   * 1. Create/update lead record
   * 2. Emit email_captured event
   * 3. Load MailerLite adapter
   * 4. Add to lead group
   * 5. Emit success/failure event
   * 6. Return result
   */
  static async captureEmail(
    params: CaptureEmailParams
  ): Promise<IntegrationResult<CaptureResult>> {
    const { clientId, email, name, source = 'landing' } = params;

    // Step 1 & 2: Create/update lead record and emit event atomically
    let leadId: string;
    try {
      leadId = await withTransaction(async (tx) => {
        // Create/update lead
        const lead = await upsertLead({
          clientId,
          email,
          source,
          tx,
        });
        
        // Emit event in same transaction
        await emitEvent({
          clientId,
          leadId: lead,
          system: EventSystem.BACKEND,
          eventType: 'email_captured',
          success: true,
          tx,
        });
        
        return lead;
      });
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

    // Step 3: Load MailerLite adapter
    const adapter = await MailerLiteAdapter.forClient(clientId);
    if (!adapter) {
      await emitEvent({
        clientId,
        leadId,
        system: EventSystem.MAILERLITE,
        eventType: 'mailerlite_subscribe_failed',
        success: false,
        errorMessage: 'MailerLite integration not configured',
      });
      return {
        success: false,
        error: 'Email integration not configured',
      };
    }

    // Step 4: Add to lead group
    const result = await adapter.addToLeadGroup(email, name);

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
      return {
        success: false,
        error: result.error || 'Failed to subscribe',
        retryable: result.retryable,
      };
    }

    await emitEvent({
      clientId,
      leadId,
      system: EventSystem.MAILERLITE,
      eventType: 'mailerlite_subscribe_success',
      success: true,
    });

    // Step 6: Return result
    return {
      success: true,
      data: {
        leadId,
        email,
        subscriberId: result.data?.subscriberId,
        message: result.data?.alreadyExists 
          ? 'Already subscribed' 
          : 'Successfully subscribed',
      },
    };
  }

  /**
   * Check if capture is properly configured for a client
   * Use for validation before showing capture forms
   */
  static async isConfigured(clientId: string): Promise<boolean> {
    const adapter = await MailerLiteAdapter.forClient(clientId);
    if (!adapter) return false;
    
    const config = adapter.isConfigured();
    return config.valid || !!adapter.getLeadGroupId();
  }
}

