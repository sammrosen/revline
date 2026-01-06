/**
 * Capture Service
 * 
 * @deprecated This service is deprecated in favor of the workflow engine.
 * Use emitTrigger() from '@/app/_lib/workflow' instead.
 * 
 * This file is kept for backwards compatibility with existing tests.
 * New code should use emitTrigger() directly.
 */

import { emitEvent, EventSystem, upsertLead } from '@/app/_lib/event-logger';
import { emitTrigger } from '@/app/_lib/workflow';
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
 * @deprecated Use emitTrigger() from '@/app/_lib/workflow' instead.
 * 
 * Service for handling email capture operations.
 * This is a compatibility wrapper around the workflow engine.
 */
export class CaptureService {
  /**
   * @deprecated Use emitTrigger() instead:
   * 
   * ```typescript
   * await emitTrigger(clientId, {
   *   adapter: 'revline',
   *   operation: 'email_captured',
   * }, { email, name, source });
   * ```
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

    // Step 3: Emit trigger to workflow engine
    const result = await emitTrigger(
      clientId,
      { adapter: 'revline', operation: 'email_captured' },
      { email, name, source }
    );

    // Check if any workflow failed
    const hasFailure = result.executions.some(e => e.status === 'failed');
    if (hasFailure) {
      console.warn('Some workflows failed for email capture:', {
        clientId,
        leadId,
        failures: result.executions.filter(e => e.status === 'failed'),
      });
    }

    // Step 4: Return result
    return {
      success: true,
      data: {
        leadId,
        email,
        subscriberId: undefined, // Workflow results don't expose this directly
        message: result.workflowsExecuted > 0 
          ? 'Successfully subscribed' 
          : 'Received (no workflows configured)',
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
