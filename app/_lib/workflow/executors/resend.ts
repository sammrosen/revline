/**
 * Resend Action Executors
 *
 * Executors for Resend email operations.
 * Uses the ResendAdapter for API calls.
 * 
 * Supports two modes:
 * - Template mode: Uses Resend's native template system with variable mapping from lead properties
 * - Inline mode: Raw HTML subject/body with {{lead.*}}, {{payload.*}} template variable resolution
 */

import { ResendAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// INLINE TEMPLATE VARIABLE RESOLUTION (backward-compatible)
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
 * Two modes:
 * 
 * 1. Template mode (preferred):
 *    - template: Template key from ResendMeta.templates config
 *    - fields: Optional mapping of Resend variable names to lead property keys
 *      e.g., { "BARCODE": "barcode", "FIRST_NAME": "firstName" }
 *      Maps lead.properties[leadPropKey] → Resend template variable[resendVarName]
 * 
 * 2. Inline mode (backward compatible):
 *    - subject: Email subject line (supports {{lead.*}}, {{payload.*}} template vars)
 *    - body: Email body content (HTML, supports template vars)
 * 
 * Shared params:
 *    - replyTo: Optional override for reply-to address
 */
const sendEmail: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const templateKey = params.template as string | undefined;
    const replyTo = params.replyTo as string | undefined;

    if (ctx.isTest) {
      const template = templateKey || params.templateId || 'inline';
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'send_email',
          summary: `Would send email template "${template}" to ${ctx.email || 'unknown'}`,
          params: { template, to: ctx.email, replyTo },
        },
      };
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

    // =========================================================================
    // TEMPLATE MODE: Use Resend's native template system
    // =========================================================================
    if (templateKey) {
      // Look up template by key from meta (mirrors MailerLite group lookup)
      const template = adapter.getTemplate(templateKey);
      if (!template) {
        return {
          success: false,
          error: `Template '${templateKey}' not found in Resend config`,
        };
      }

      // Load lead data once — used for both variable mapping and subject resolution
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

      // Resolve custom template variables from lead properties
      // Mirrors MailerLite executor field mapping (lines 54-76 of mailerlite.ts)
      const variables: Record<string, string | number> = {};
      const fieldMapping = params.fields as Record<string, string> | undefined;

      if (leadData && fieldMapping && typeof fieldMapping === 'object') {
        const leadProps = leadData.properties ?? {};
        // Built-in lead fields available for mapping
        const builtInFields: Record<string, unknown> = {
          email: leadData.email,
          source: leadData.source,
          stage: leadData.stage,
        };

        for (const [resendVarName, leadPropKey] of Object.entries(fieldMapping)) {
          // Check built-in fields first, then custom properties
          const value = builtInFields[leadPropKey] ?? leadProps[leadPropKey];
          variables[resendVarName] = (value !== undefined && value !== null)
            ? (typeof value === 'number' ? value : String(value))
            : '';
        }
      }

      // Ensure ALL template-defined variables are present (fail-safe).
      // Resend rejects the request if any required variable is missing.
      // Send empty string for any variable not covered by the field mapping.
      const templateVars = template.variables ?? [];
      for (const varName of templateVars) {
        if (!(varName in variables)) {
          variables[varName] = '';
        }
      }

      // Resolve subject — required since Resend templates don't include subject
      let subject = params.subject as string | undefined;
      if (!subject) {
        return { success: false, error: 'Missing subject parameter (required — Resend templates do not include a subject line)' };
      }

      // Resolve {{lead.*}}, {{payload.*}} template vars in subject
      const hasSubjectVars = TEMPLATE_VAR_REGEX.test(subject);
      TEMPLATE_VAR_REGEX.lastIndex = 0;

      if (hasSubjectVars && leadData) {
        subject = resolveTemplateVars(subject, {
          lead: leadData,
          payload: ctx.trigger.payload,
          actionData: ctx.actionData,
        });
      }

      // Send using Resend's native template system
      const result = await adapter.sendTemplate({
        to: ctx.email,
        templateId: template.id,
        variables: Object.keys(variables).length > 0 ? variables : undefined,
        subject,
        replyTo,
      });

      // Emit event for tracking
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.RESEND,
        eventType: result.success
          ? 'resend_template_sent'
          : 'resend_template_failed',
        success: result.success,
        errorMessage: result.error,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          messageId: result.data?.messageId,
          to: ctx.email,
          subject,
          templateKey,
          templateId: template.id,
          ...(Object.keys(variables).length > 0 ? { variablesSent: Object.keys(variables) } : {}),
        },
      };
    }

    // =========================================================================
    // INLINE MODE: Raw HTML with {{lead.*}} variable resolution (backward compatible)
    // =========================================================================
    let subject = params.subject as string;
    let body = params.body as string;

    // Validate required params for inline mode
    if (!subject) {
      return { success: false, error: 'Missing subject parameter (required for inline mode)' };
    }
    if (!body) {
      return { success: false, error: 'Missing body parameter (required for inline mode)' };
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
