/**
 * Twilio Voice Webhook Endpoint
 *
 * POST /api/v1/twilio-voice?source={workspaceSlug}
 *
 * Handles inbound voice calls forwarded from a contractor's phone carrier
 * to a workspace Twilio number:
 * - Verifies X-Twilio-Signature using the workspace's Auth Token
 * - Deduplicates via WebhookProcessor (CallSid as providerEventId)
 * - Resolves PhoneConfig by matching the To number
 * - Checks caller against blocklist
 * - Returns TwiML with voice greeting + hangup
 * - Fires async missed-call processing (lead upsert, auto-text, agent/notification)
 *
 * STANDARDS:
 * - Same verification + dedup pattern as the SMS webhook
 * - Always returns 200 with TwiML to prevent Twilio retries
 * - Async processing runs fire-and-forget after TwiML response
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveClient } from '@/app/_lib/client-gate';
import { TwilioAdapter, twimlResponse, voiceTwimlResponse, parseFormBody, getWebhookUrl } from '@/app/_lib/integrations';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { rateLimitByClient, getRateLimitHeaders } from '@/app/_lib/middleware';
import { WebhookProcessor, logStructured } from '@/app/_lib/reliability';
import { prisma } from '@/app/_lib/db';
import { handleMissedCall } from '@/app/_lib/phone';

const TwilioVoicePayloadSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  CallStatus: z.string().optional(),
  Direction: z.string().optional(),
  CallerCity: z.string().optional(),
  CallerState: z.string().optional(),
  CallerCountry: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const twilioSignature = request.headers.get('x-twilio-signature') || '';

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');

  if (!source) {
    return ApiResponse.error('Missing source parameter', 400, ErrorCodes.MISSING_REQUIRED);
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
    const callSid = params.CallSid || `twilio-voice-${Date.now()}`;

    // Deduplication
    const registration = await WebhookProcessor.register({
      workspaceId: client.id,
      provider: 'twilio',
      providerEventId: callSid,
      rawBody,
      rawHeaders: twilioSignature ? { 'x-twilio-signature': twilioSignature } : undefined,
    });

    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_voice_duplicate',
        workspaceId: client.id,
        provider: 'twilio',
        metadata: { callSid },
      });
      return twimlResponse(200);
    }

    const claimed = await WebhookProcessor.markProcessing(registration.id);
    if (!claimed) {
      return twimlResponse(200);
    }

    // Signature verification
    if (!twilioSignature) {
      await WebhookProcessor.markFailed(registration.id, 'Missing X-Twilio-Signature header');
      return twimlResponse(200);
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
        eventType: 'twilio_voice_invalid_signature',
        success: false,
        errorMessage: verification.error,
      });
      return twimlResponse(200);
    }

    // Validate voice-specific payload fields
    const payloadParsed = TwilioVoicePayloadSchema.safeParse(params);
    if (!payloadParsed.success) {
      await WebhookProcessor.markFailed(registration.id, `Invalid payload: ${payloadParsed.error.issues.map((e) => e.message).join(', ')}`);
      return twimlResponse(200);
    }

    const payload = payloadParsed.data;
    const callerPhone = payload.From;
    const twilioNumber = payload.To;
    const callerGeo = {
      city: payload.CallerCity,
      state: payload.CallerState,
      country: payload.CallerCountry,
    };

    logStructured({
      correlationId: registration.correlationId,
      event: 'twilio_voice_received',
      workspaceId: client.id,
      provider: 'twilio',
      metadata: {
        callSid,
        from: callerPhone,
        to: twilioNumber,
        callStatus: payload.CallStatus,
        direction: payload.Direction,
      },
    });

    // Resolve PhoneConfig by matching the To number against configured Twilio numbers
    const phoneNumberKey = twilioAdapter.getPhoneKeyByNumber(twilioNumber);
    const phoneConfig = phoneNumberKey
      ? await prisma.phoneConfig.findFirst({
          where: {
            workspaceId: client.id,
            twilioNumberKey: phoneNumberKey,
            enabled: true,
          },
        })
      : null;

    if (!phoneConfig) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_voice_no_config',
        workspaceId: client.id,
        provider: 'twilio',
        metadata: { twilioNumber, phoneNumberKey },
      });
      await WebhookProcessor.markProcessed(registration.id);
      return twimlResponse(200);
    }

    // Blocklist check
    const blocklist = Array.isArray(phoneConfig.blocklist) ? phoneConfig.blocklist as string[] : [];
    if (blocklist.includes(callerPhone)) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_voice_blocked',
        workspaceId: client.id,
        provider: 'twilio',
        metadata: { from: callerPhone },
      });
      await WebhookProcessor.markProcessed(registration.id);
      return twimlResponse(200);
    }

    // Fire async missed-call processing (don't block TwiML response)
    handleMissedCall({
      workspaceId: client.id,
      phoneConfig,
      callerPhone,
      twilioNumber,
      callSid,
      callerGeo,
      correlationId: registration.correlationId,
    }).catch((err) => {
      logStructured({
        correlationId: registration.correlationId,
        event: 'twilio_missed_call_handler_error',
        workspaceId: client.id,
        provider: 'twilio',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });

    await WebhookProcessor.markProcessed(registration.id);

    // Return TwiML with voice greeting
    const response = voiceTwimlResponse(phoneConfig.voiceGreeting);
    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'twilio_voice_error',
      workspaceId: clientSlug,
      provider: 'twilio',
      error: errorMessage,
      metadata: {},
    });

    return twimlResponse(200);
  }
}
