/**
 * Resend Action Executors
 *
 * Executors for Resend email operations.
 * Uses the ResendAdapter for API calls.
 */

import { ResendAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Send an email via Resend
 * 
 * Params:
 * - subject: Email subject line
 * - body: Email body content (HTML)
 * - replyTo: Optional override for reply-to address
 */
const sendEmail: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const subject = params.subject as string;
    const body = params.body as string;
    const replyTo = params.replyTo as string | undefined;

    // Validate required params
    if (!subject) {
      return { success: false, error: 'Missing subject parameter' };
    }
    if (!body) {
      return { success: false, error: 'Missing body parameter' };
    }

    // ctx.email is the recipient from the trigger payload
    if (!ctx.email) {
      return { success: false, error: 'No recipient email in workflow context' };
    }

    // Get adapter for this workspace
    const adapter = await ResendAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'Resend not configured for this workspace' };
    }

    // Validate adapter configuration
    const validation = adapter.validateConfig();
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Resend configuration error: ${validation.errors.join(', ')}` 
      };
    }

    // Send the email
    const result = await adapter.sendEmail({
      to: ctx.email,
      subject,
      html: body,
      replyTo,
    });

    // Emit event for tracking
    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.RESEND,
      eventType: result.success
        ? 'resend_email_sent'
        : 'resend_email_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { 
        success: false, 
        error: result.error,
      };
    }

    return {
      success: true,
      data: {
        messageId: result.data?.messageId,
        to: ctx.email,
        subject,
      },
    };
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const resendExecutors: Record<string, ActionExecutor> = {
  send_email: sendEmail,
};
