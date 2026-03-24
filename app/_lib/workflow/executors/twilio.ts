/**
 * Twilio Action Executors
 *
 * Executors for Twilio SMS operations.
 * Uses the TwilioAdapter for API calls.
 *
 * Supports {{lead.*}}, {{payload.*}}, {{action.*}} template variable resolution
 * in the message body (same pattern as Resend inline mode).
 */

import { TwilioAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// TEMPLATE VARIABLE RESOLUTION
// =============================================================================

const TEMPLATE_VAR_REGEX = /\{\{(lead|payload|action)\.([a-zA-Z0-9_.]+)\}\}/g;

/**
 * Resolve template variables in a string.
 * Unknown variables resolve to empty string (fail-safe).
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

    if (value === null || value === undefined) return '';
    return String(value);
  });
}

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Send an SMS via Twilio
 *
 * Params:
 * - to: Recipient phone number. Defaults to payload.from (reply to sender) if not provided.
 * - body: Message text. Supports {{lead.*}}, {{payload.*}}, {{action.*}} template vars.
 * - phoneNumber: Optional key from TwilioMeta.phoneNumbers to select the sender number.
 */
const sendSms: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    let body = params.body as string | undefined;
    const toParam = params.to as string | undefined;
    const phoneNumberKey = params.phoneNumber as string | undefined;

    if (ctx.isTest) {
      const to = toParam || (ctx.trigger.payload.from as string | undefined) || 'unknown';
      return {
        success: true,
        data: {
          dryRun: true,
          action: 'send_sms',
          summary: `Would send SMS to ${to}: "${(body || '').slice(0, 80)}${(body || '').length > 80 ? '...' : ''}"`,
          params: { to, body, phoneNumber: phoneNumberKey },
        },
      };
    }

    if (!body) {
      return { success: false, error: 'Missing body parameter' };
    }

    // Resolve recipient: explicit param > trigger payload "from" (reply to sender)
    const to = toParam || (ctx.trigger.payload.from as string | undefined);
    if (!to) {
      return { success: false, error: 'No recipient: provide "to" param or trigger must include "from"' };
    }

    const adapter = await TwilioAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'Twilio not configured for this workspace' };
    }

    const validation = adapter.validateConfig();
    if (!validation.valid) {
      return {
        success: false,
        error: `Twilio configuration error: ${validation.errors.join(', ')}`,
      };
    }

    // Resolve template variables if present
    const hasTemplateVars = TEMPLATE_VAR_REGEX.test(body);
    TEMPLATE_VAR_REGEX.lastIndex = 0;

    if (hasTemplateVars) {
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

      body = resolveTemplateVars(body, {
        lead: leadData,
        payload: ctx.trigger.payload,
        actionData: ctx.actionData,
      });
    }

    const result = await adapter.sendSms({
      to,
      body,
      from: phoneNumberKey,
    });

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.TWILIO,
      eventType: result.success ? 'twilio_sms_sent' : 'twilio_sms_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        messageSid: result.data?.messageSid,
        to,
        body,
        segmentCount: result.data?.segmentCount,
      },
    };
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const twilioExecutors: Record<string, ActionExecutor> = {
  send_sms: sendSms,
};
