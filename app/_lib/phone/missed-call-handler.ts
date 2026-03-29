/**
 * Missed-Call Handler
 *
 * Core business logic for processing missed calls after the voice webhook
 * returns TwiML. Handles lead upsert, event emission, and mode-specific
 * dispatch (notification SMS or agent conversation start).
 *
 * Called fire-and-forget from the voice webhook so TwiML response is not delayed.
 */

import type { PhoneConfig } from '@prisma/client';
import { TwilioAdapter } from '@/app/_lib/integrations';
import { emitEvent, upsertLead, EventSystem } from '@/app/_lib/event-logger';
import { emitTrigger } from '@/app/_lib/workflow';
import { handleInboundMessage } from '@/app/_lib/agent';
import { logStructured } from '@/app/_lib/reliability';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissedCallParams {
  workspaceId: string;
  phoneConfig: PhoneConfig;
  callerPhone: string;
  twilioNumber: string;
  callSid: string;
  callerGeo?: { city?: string; state?: string; country?: string };
  correlationId: string;
}

// ---------------------------------------------------------------------------
// Template interpolation
// ---------------------------------------------------------------------------

function interpolateTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleMissedCall(params: MissedCallParams): Promise<void> {
  const { workspaceId, phoneConfig, callerPhone, twilioNumber, callSid, callerGeo, correlationId } = params;

  const twilioAdapter = await TwilioAdapter.forWorkspace(workspaceId);
  if (!twilioAdapter) {
    logStructured({
      correlationId,
      event: 'twilio_missed_call_no_adapter',
      workspaceId,
      provider: 'twilio',
      error: 'TwilioAdapter not available',
    });
    return;
  }

  // 1. Upsert lead with synthetic email
  let leadId: string | undefined;
  try {
    const syntheticEmail = `${callerPhone}@phone.revline.io`;
    leadId = await upsertLead({
      workspaceId,
      email: syntheticEmail,
      source: 'missed_call',
      properties: {
        phone: callerPhone,
        ...(callerGeo?.city && { city: callerGeo.city }),
        ...(callerGeo?.state && { state: callerGeo.state }),
        ...(callerGeo?.country && { country: callerGeo.country }),
      },
    });
  } catch (err) {
    logStructured({
      correlationId,
      event: 'twilio_missed_call_lead_upsert_failed',
      workspaceId,
      provider: 'twilio',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // 2. Emit ledger event + workflow trigger
  await emitEvent({
    workspaceId,
    leadId,
    system: EventSystem.TWILIO,
    eventType: 'twilio_missed_call',
    success: true,
    metadata: { callerPhone, twilioNumber, mode: phoneConfig.mode, callSid },
  });

  await emitTrigger(
    workspaceId,
    { adapter: 'twilio', operation: 'missed_call' },
    {
      from: callerPhone,
      to: twilioNumber,
      callSid,
      callerCity: callerGeo?.city,
      callerState: callerGeo?.state,
      callerCountry: callerGeo?.country,
      phoneConfigId: phoneConfig.id,
      mode: phoneConfig.mode,
      correlationId,
    },
  );

  // 3. Template variables for SMS interpolation
  const templateVars: Record<string, string | undefined> = {
    callerPhone,
    twilioNumber,
    callerName: undefined,
  };

  // 4. Mode-specific handling
  if (phoneConfig.mode === 'NOTIFICATION') {
    await handleNotificationMode(twilioAdapter, phoneConfig, callerPhone, templateVars, correlationId, workspaceId);
  } else if (phoneConfig.mode === 'AGENT' && phoneConfig.agentId) {
    await handleAgentMode(phoneConfig, callerPhone, twilioNumber, templateVars, leadId, correlationId, workspaceId);
  }

  logStructured({
    correlationId,
    event: 'twilio_missed_call_processed',
    workspaceId,
    provider: 'twilio',
    success: true,
    metadata: { callerPhone, mode: phoneConfig.mode, leadId },
  });
}

// ---------------------------------------------------------------------------
// Notification mode: auto-text to caller + notification to contractor
// ---------------------------------------------------------------------------

async function handleNotificationMode(
  twilioAdapter: TwilioAdapter,
  phoneConfig: PhoneConfig,
  callerPhone: string,
  templateVars: Record<string, string | undefined>,
  correlationId: string,
  workspaceId: string,
): Promise<void> {
  // Auto-text to caller
  try {
    const autoText = interpolateTemplate(phoneConfig.autoTextTemplate, templateVars);
    await twilioAdapter.sendSms({
      to: callerPhone,
      body: autoText,
      from: phoneConfig.twilioNumberKey,
    });
    logStructured({
      correlationId,
      event: 'twilio_missed_call_auto_text_sent',
      workspaceId,
      provider: 'twilio',
      success: true,
      metadata: { to: callerPhone },
    });
  } catch (err) {
    logStructured({
      correlationId,
      event: 'twilio_missed_call_auto_text_failed',
      workspaceId,
      provider: 'twilio',
      error: err instanceof Error ? err.message : 'Unknown error',
      metadata: { to: callerPhone },
    });
  }

  // Notification SMS to contractor's personal number
  try {
    const notification = interpolateTemplate(phoneConfig.notificationTemplate, templateVars);
    await twilioAdapter.sendSms({
      to: phoneConfig.forwardingNumber,
      body: notification,
      from: phoneConfig.twilioNumberKey,
    });
    logStructured({
      correlationId,
      event: 'twilio_missed_call_notification_sent',
      workspaceId,
      provider: 'twilio',
      success: true,
      metadata: { to: phoneConfig.forwardingNumber },
    });
  } catch (err) {
    logStructured({
      correlationId,
      event: 'twilio_missed_call_notification_failed',
      workspaceId,
      provider: 'twilio',
      error: err instanceof Error ? err.message : 'Unknown error',
      metadata: { to: phoneConfig.forwardingNumber },
    });
  }
}

// ---------------------------------------------------------------------------
// Agent mode: start proactive agent conversation via SMS
// ---------------------------------------------------------------------------

async function handleAgentMode(
  phoneConfig: PhoneConfig,
  callerPhone: string,
  twilioNumber: string,
  templateVars: Record<string, string | undefined>,
  leadId: string | undefined,
  correlationId: string,
  workspaceId: string,
): Promise<void> {
  try {
    const proactiveMessage = interpolateTemplate(phoneConfig.autoTextTemplate, templateVars);

    const result = await handleInboundMessage({
      workspaceId,
      agentId: phoneConfig.agentId!,
      contactAddress: callerPhone,
      channelAddress: twilioNumber,
      channel: 'SMS',
      channelIntegration: 'TWILIO',
      messageText: '',
      leadId,
      callerContext: 'proactive',
      proactiveMessage,
    });

    logStructured({
      correlationId,
      event: 'twilio_missed_call_agent_started',
      workspaceId,
      provider: 'twilio',
      success: result.success,
      metadata: {
        conversationId: result.conversationId,
        isNew: result.isNewConversation,
        error: result.error,
      },
    });
  } catch (err) {
    logStructured({
      correlationId,
      event: 'twilio_missed_call_agent_start_failed',
      workspaceId,
      provider: 'twilio',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
