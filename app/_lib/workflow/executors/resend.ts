/**
 * Resend Action Executors
 *
 * Executors for Resend email operations.
 * Uses the ResendAdapter for API calls.
 * 
 * Supports variable interpolation in subject and body:
 * - {{lead.email}}, {{lead.custom.barcode}}
 * - {{workspace.name}}, {{workspace.slug}}
 * - {{trigger.payload.amount}}
 */

import { ResendAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';
import { InterpolationService } from '@/app/_lib/services';
import { InterpolationContext } from '@/app/_lib/types/custom-fields';

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Send an email via Resend
 * 
 * Params:
 * - subject: Email subject line (supports {{variable}} interpolation)
 * - body: Email body content (HTML, supports {{variable}} interpolation)
 * - replyTo: Optional override for reply-to address
 * 
 * Supported variables:
 * - {{lead.email}}, {{lead.stage}}, {{lead.source}}
 * - {{lead.custom.fieldKey}} - Custom field values
 * - {{workspace.name}}, {{workspace.slug}}
 * - {{trigger.adapter}}, {{trigger.operation}}
 * - {{trigger.payload.fieldName}} - Trigger payload values
 */
const sendEmail: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const subjectTemplate = params.subject as string;
    const bodyTemplate = params.body as string;
    const replyTo = params.replyTo as string | undefined;

    // Validate required params
    if (!subjectTemplate) {
      return { success: false, error: 'Missing subject parameter' };
    }
    if (!bodyTemplate) {
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

    // Build interpolation context from workflow context
    const interpolationContext: InterpolationContext = {
      lead: ctx.lead,
      workspace: ctx.workspace,
      trigger: ctx.trigger,
      extra: ctx.actionData,
    };

    // Interpolate subject and body
    // Subject: no HTML escaping (plain text)
    const subject = InterpolationService.interpolate(subjectTemplate, interpolationContext, {
      escapeHtml: false,
    });
    // Body: HTML escaping enabled by default (XSS prevention)
    const body = InterpolationService.interpolate(bodyTemplate, interpolationContext, {
      escapeHtml: true,
    });

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
