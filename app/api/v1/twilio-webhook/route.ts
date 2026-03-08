/**
 * Twilio SMS Webhook Endpoint
 *
 * POST /api/v1/twilio-webhook?source={workspaceSlug}
 *
 * Processes inbound SMS messages from Twilio:
 * - Verifies X-Twilio-Signature using the workspace's Auth Token
 * - Deduplicates via WebhookProcessor (MessageSid as providerEventId)
 * - Emits workflow trigger: twilio.sms_received
 * - Returns empty TwiML <Response></Response> to acknowledge without replying
 *
 * STANDARDS:
 * - Persist first, verify, dedupe, then process
 * - Uses Twilio SDK validateRequest for signature verification
 * - Always returns 200 with TwiML (prevents Twilio retries)
 * - Twilio sends application/x-www-form-urlencoded POST body
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { TwilioAdapter } from '@/app/_lib/integrations';
import { emitTrigger } from '@/app/_lib/workflow';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { rateLimitByClient, getRateLimitHeaders } from '@/app/_lib/middleware';
import {
  WebhookProcessor,
  logStructured,
} from '@/app/_lib/reliability';
import { prisma } from '@/app/_lib/db';
import { ConversationStatus } from '@prisma/client';
import { handleInboundMessage } from '@/app/_lib/agent';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twimlResponse(status = 200): NextResponse {
  return new NextResponse(EMPTY_TWIML, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * Parse URL-encoded body into a Record<string, string>
 */
function parseFormBody(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = raw.split('&');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = decodeURIComponent(pair.slice(0, idx).replace(/\+/g, ' '));
    const value = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    params[key] = value;
  }
  return params;
}

/**
 * Reconstruct the webhook URL that Twilio signed against.
 * Must match the exact URL configured in Twilio Console.
 */
function getWebhookUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const url = new URL(request.url);
  return `${proto}://${host}${url.pathname}${url.search}`;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const twilioSignature = request.headers.get('x-twilio-signature') || '';

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');

  if (!source) {
    return ApiResponse.error(
      'Missing source parameter',
      400,
      ErrorCodes.MISSING_REQUIRED
    );
  }

  const clientSlug = source.toLowerCase();

  const rateLimit = rateLimitByClient(clientSlug);
  if (!rateLimit.allowed) {
    return twimlResponse(200);
  }

  try {
    const client = await getActiveClient(clientSlug);
    if (!client) {
      return twimlResponse(200);
    }

    const params = parseFormBody(rawBody);
    const messageSid = params.MessageSid || params.SmsSid || `twilio-${Date.now()}`;

    const registration = await WebhookProcessor.register({
      workspaceId: client.id,
      provider: 'twilio',
      providerEventId: messageSid,
      rawBody,
      rawHeaders: twilioSignature ? {
        'x-twilio-signature': twilioSignature,
      } : undefined,
    });

    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_webhook_duplicate',
        workspaceId: client.id,
        provider: 'twilio',
        metadata: { messageSid },
      });
      return twimlResponse(200);
    }

    const claimed = await WebhookProcessor.markProcessing(registration.id);
    if (!claimed) {
      return twimlResponse(200);
    }

    if (!twilioSignature) {
      await WebhookProcessor.markFailed(registration.id, 'Missing X-Twilio-Signature header');
      return ApiResponse.error(
        'Missing signature header',
        400,
        ErrorCodes.MISSING_SIGNATURE
      );
    }

    const twilioAdapter = await TwilioAdapter.forWorkspace(client.id);
    if (!twilioAdapter) {
      await WebhookProcessor.markFailed(registration.id, 'Twilio not configured');
      return twimlResponse(200);
    }

    if (!twilioAdapter.isWebhookConfigured()) {
      await WebhookProcessor.markFailed(registration.id, 'Auth Token not configured');
      return twimlResponse(200);
    }

    const webhookUrl = getWebhookUrl(request);
    const verification = twilioAdapter.verifyWebhook(webhookUrl, params, twilioSignature);

    if (!verification.valid) {
      await WebhookProcessor.markFailed(registration.id, verification.error || 'Signature verification failed');
      await emitEvent({
        workspaceId: client.id,
        system: EventSystem.TWILIO,
        eventType: 'twilio_webhook_invalid_signature',
        success: false,
        errorMessage: verification.error,
      });

      return ApiResponse.error(
        verification.error || 'Webhook verification failed',
        400,
        ErrorCodes.INVALID_SIGNATURE
      );
    }

    const payload = TwilioAdapter.parseWebhookPayload(params);

    logStructured({
      correlationId: registration.correlationId,
      event: 'twilio_sms_received',
      workspaceId: client.id,
      provider: 'twilio',
      metadata: {
        messageSid: payload.messageSid,
        from: payload.from,
        hasBody: !!payload.body,
      },
    });

    await emitEvent({
      workspaceId: client.id,
      system: EventSystem.TWILIO,
      eventType: 'twilio_sms_received',
      success: true,
    });

    // Check for opt-out before any agent/workflow processing
    const optedOut = await prisma.optOutRecord.findUnique({
      where: {
        workspaceId_contactAddress: {
          workspaceId: client.id,
          contactAddress: payload.from,
        },
      },
    });
    if (optedOut) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_opted_out_contact',
        workspaceId: client.id,
        provider: 'twilio',
        metadata: { from: payload.from, optOutReason: optedOut.reason },
      });
      await WebhookProcessor.markProcessed(registration.id);
      return twimlResponse(200);
    }

    // Check for active agent conversation before workflow trigger.
    // Subsequent messages in an active conversation go directly to the engine.
    const activeConversation = await prisma.conversation.findFirst({
      where: {
        workspaceId: client.id,
        contactAddress: payload.from,
        channelAddress: payload.to,
        status: ConversationStatus.ACTIVE,
      },
      select: { id: true, agentId: true },
    });

    if (activeConversation) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_agent_route_direct',
        workspaceId: client.id,
        provider: 'twilio',
        metadata: {
          conversationId: activeConversation.id,
          agentId: activeConversation.agentId,
          from: payload.from,
        },
      });

      const agentResult = await handleInboundMessage({
        workspaceId: client.id,
        agentId: activeConversation.agentId,
        contactAddress: payload.from,
        channelAddress: payload.to,
        channel: 'SMS',
        messageText: payload.body,
      });

      await WebhookProcessor.markProcessed(registration.id);

      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_webhook_processed',
        workspaceId: client.id,
        provider: 'twilio',
        success: agentResult.success,
        metadata: {
          messageSid: payload.messageSid,
          from: payload.from,
          routedToAgent: true,
          conversationId: activeConversation.id,
        },
      });
    } else {
      // No active conversation -- fire workflow trigger (may include route_to_agent action)
      let warning: string | undefined;
      const triggerResult = await emitTrigger(
        client.id,
        { adapter: 'twilio', operation: 'sms_received' },
        {
          from: payload.from,
          to: payload.to,
          body: payload.body,
          messageSid: payload.messageSid,
          numSegments: payload.numSegments,
          correlationId: registration.correlationId,
        }
      );

      const hasFailure = triggerResult.executions.some((e) => e.status === 'failed');
      if (hasFailure) {
        warning = triggerResult.executions
          .filter((e) => e.status === 'failed')
          .map((e) => e.error)
          .join('; ');

        logStructured({
          correlationId: registration.correlationId,
          event: 'twilio_workflow_partial_failure',
          workspaceId: client.id,
          provider: 'twilio',
          error: warning,
          metadata: { from: payload.from },
        });
      }

      await WebhookProcessor.markProcessed(registration.id);

      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_webhook_processed',
        workspaceId: client.id,
        provider: 'twilio',
        success: true,
        metadata: {
          messageSid: payload.messageSid,
          from: payload.from,
          triggerFired: triggerResult.workflowsExecuted > 0,
        },
      });
    }

    const response = twimlResponse(200);
    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'twilio_webhook_error',
      workspaceId: clientSlug,
      provider: 'twilio',
      error: errorMessage,
    });

    return twimlResponse(200);
  }
}
