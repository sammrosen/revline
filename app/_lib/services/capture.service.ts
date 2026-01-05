/**
 * Capture Service
 * 
 * Orchestrates the email capture flow from landing pages.
 * Handles lead creation, event emission, and dispatches to integrations.
 * 
 * STANDARDS:
 * - Single responsibility: email capture orchestration
 * - Always emits events for debugging
 * - Uses action dispatcher for integration routing
 * - Returns structured results for route handlers
 */

import { emitEvent, EventSystem, upsertLead } from '@/app/_lib/event-logger';
import { dispatchAction } from '@/app/_lib/actions/dispatcher';
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
   * 3. Dispatch 'lead.captured' action to all integrations
   * 4. Return result
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

    // Step 3: Dispatch 'lead.captured' action to all integrations
    const dispatchResult = await dispatchAction(clientId, 'lead.captured', {
      email,
      name,
      source,
    });

    // Check if any integration failed
    const failedResults = dispatchResult.results.filter(r => !r.result.success);
    if (failedResults.length > 0) {
      // Log failures but don't fail the overall capture
      // The lead is captured, just integration forwarding had issues
      console.warn('Some integrations failed for lead.captured:', {
        clientId,
        leadId,
        failures: failedResults.map(r => ({
          integration: r.integration,
          error: r.result.error,
        })),
      });
    }

    // Get MailerLite result for subscriber ID if available
    const mlResult = dispatchResult.results.find(r => r.integration === 'MAILERLITE');
    const subscriberId = mlResult?.result.success 
      ? (mlResult.result.data as { subscriberId?: string })?.subscriberId 
      : undefined;

    // Step 4: Return result
    return {
      success: true,
      data: {
        leadId,
        email,
        subscriberId,
        message: dispatchResult.allSucceeded 
          ? 'Successfully subscribed' 
          : 'Subscribed (some integrations pending)',
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
    
    // Check if MailerLite has groups and routing for lead.captured
    return adapter.hasGroups() && adapter.hasRoutingFor('lead.captured');
  }
}
