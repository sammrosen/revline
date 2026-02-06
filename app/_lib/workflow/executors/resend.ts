/**
 * Resend Action Executors
 *
 * Executors for Resend email operations.
 * Uses the ResendAdapter for API calls.
 * Supports template variable resolution in subject and body.
 */

import { ResendAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// TEMPLATE VARIABLE RESOLUTION
// =============================================================================

/**
 * Regex for matching template variables: {{lead.barcode}}, {{payload.name}}, etc.
 * Supports: lead.*, payload.*, action.*
 */
const TEMPLATE_VAR_REGEX = /\{\{(lead|payload|action)\.([a-zA-Z0-9_.]+)\}\}/g;

/**
 * Resolve template variables in a string.
 * 
 * Supported patterns:
 * - {{lead.email}}, {{lead.stage}}, {{lead.source}} - Built-in lead fields
 * - {{lead.barcode}}, {{lead.memberType}} - Custom lead properties
 * - {{payload.name}}, {{payload.phone}} - Trigger payload fields
 * - {{action.leadId}} - Data from previous workflow actions
 * 
 * Unknown variables resolve to empty string (fail-safe: never breaks the email).
 */
function resolveTemplateVars(
  template: string,
  context: {
    lead?: {
      email: string;
      source: string | null;
      stage: string;
      properties: Record<string, unknown> | null;
    };
    payload: Record<string, unknown>;
    actionData: Record<string, unknown>;
  }
): string {
  return template.replace(TEMPLATE_VAR_REGEX, (_match, namespace: string, key: string) => {
    let value: unknown;

    switch (namespace) {
      case 'lead': {
        if (!context.lead) return '';
        // Check built-in fields first, then custom properties
        const builtInFields: Record<string, unknown> = {
          email: context.lead.email,
          source: context.lead.source,
          stage: context.lead.stage,
        };
        value = builtInFields[key] ?? context.lead.properties?.[key];
        break;
      }
      case 'payload':
        value = context.payload[key];
        break;
      case 'action':
        value = context.actionData[key];
        break;
      default:
        value = undefined;
    }

    // Convert to string, empty string for null/undefined (fail-safe)
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Send an email via Resend
 * 
 * Params:
 * - subject: Email subject line (supports {{lead.*}}, {{payload.*}} template vars)
 * - body: Email body content (HTML, supports template vars)
 * - replyTo: Optional override for reply-to address
 * 
 * Template variables are resolved before sending:
 * - {{lead.email}}, {{lead.barcode}}, {{lead.memberType}} etc.
 * - {{payload.name}}, {{payload.phone}} etc.
 * - {{action.leadId}} etc.
 */
const sendEmail: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    let subject = params.subject as string;
    let body = params.body as string;
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

    // Resolve template variables if any are present
    const hasTemplateVars = TEMPLATE_VAR_REGEX.test(subject) || TEMPLATE_VAR_REGEX.test(body);
    // Reset regex lastIndex since .test() advances it on global regexes
    TEMPLATE_VAR_REGEX.lastIndex = 0;

    if (hasTemplateVars) {
      // Load lead data if we have a leadId
      let leadData: { email: string; source: string | null; stage: string; properties: Record<string, unknown> | null } | undefined;

      if (ctx.leadId) {
        const lead = await prisma.lead.findUnique({
          where: { id: ctx.leadId },
          select: { email: true, source: true, stage: true, properties: true },
        });
        if (lead) {
          leadData = {
            email: lead.email,
            source: lead.source,
            stage: lead.stage,
            properties: (lead.properties as Record<string, unknown>) ?? null,
          };
        }
      }

      const templateContext = {
        lead: leadData,
        payload: ctx.trigger.payload,
        actionData: ctx.actionData,
      };

      subject = resolveTemplateVars(subject, templateContext);
      body = resolveTemplateVars(body, templateContext);
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
