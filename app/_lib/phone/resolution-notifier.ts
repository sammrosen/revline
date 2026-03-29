/**
 * Resolution Notifier
 *
 * Sends a templated SMS to the contractor's forwarding number when an
 * agent conversation completes, if the conversation originated from a
 * PhoneConfig-backed missed-call flow.
 *
 * Called fire-and-forget from engine.ts completion paths.
 */

import { prisma } from '@/app/_lib/db';
import { TwilioAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { logStructured } from '@/app/_lib/reliability';

export interface ResolutionNotifyParams {
  workspaceId: string;
  agentId: string;
  conversationId: string;
  contactAddress: string;
  resolution: string;
  channel: string;
  channelIntegration?: string;
}

const NOTIFICATION_TEMPLATES: Record<string, string | null> = {
  booked: 'New lead booked! {{contactAddress}}. Check your dashboard for details.',
  soft_escalation: 'New lead from {{contactAddress}} wrapped up. No booking — you may want to follow up.',
  hard_escalation: 'Lead needs you now — {{contactAddress}}. They requested a human.',
  no_response: null,
  completed: null,
};

export async function notifyResolution(params: ResolutionNotifyParams): Promise<void> {
  const { workspaceId, agentId, conversationId, contactAddress, resolution, channel, channelIntegration } = params;

  if (channel !== 'SMS' || channelIntegration !== 'TWILIO') return;

  const template = NOTIFICATION_TEMPLATES[resolution];
  if (!template) return;

  try {
    const phoneConfig = await prisma.phoneConfig.findFirst({
      where: { workspaceId, agentId, enabled: true, mode: 'AGENT' },
    });
    if (!phoneConfig) return;

    const twilioAdapter = await TwilioAdapter.forWorkspace(workspaceId);
    if (!twilioAdapter) return;

    const body = template.replace('{{contactAddress}}', contactAddress);

    await twilioAdapter.sendSms({
      to: phoneConfig.forwardingNumber,
      body,
      from: phoneConfig.twilioNumberKey,
    });

    await emitEvent({
      workspaceId,
      system: EventSystem.TWILIO,
      eventType: 'twilio_resolution_notification_sent',
      success: true,
      metadata: { conversationId, resolution, to: phoneConfig.forwardingNumber },
    });
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'twilio_resolution_notification_failed',
      workspaceId,
      provider: 'twilio',
      error: err instanceof Error ? err.message : 'Unknown error',
      metadata: { conversationId, resolution, agentId },
    });
  }
}
