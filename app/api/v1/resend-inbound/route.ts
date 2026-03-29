/**
 * Resend Inbound Email Webhook
 *
 * POST /api/v1/resend-inbound?source={workspaceSlug}
 *
 * Processes inbound email replies from Resend:
 * - Verifies Svix signature using workspace's Webhook Secret
 * - Deduplicates via WebhookProcessor
 * - Routes to active agent conversation if one exists
 * - Otherwise emits resend.email_received workflow trigger
 *
 * STANDARDS:
 * - Persist first, verify, dedupe, then process
 * - Uses Svix signature verification (same as resend-webhook)
 * - Always returns 200 for processed events (prevents Resend retries)
 */

import { NextRequest } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { ResendAdapter } from '@/app/_lib/integrations';
import { emitTrigger } from '@/app/_lib/workflow';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { rateLimitByClient, getRateLimitHeaders } from '@/app/_lib/middleware';
import {
  WebhookProcessor,
  logStructured,
} from '@/app/_lib/reliability';
import { prisma } from '@/app/_lib/db';
import { ConversationStatus, Prisma } from '@prisma/client';
import { handleInboundMessage } from '@/app/_lib/agent';

/**
 * Strip HTML tags to extract plain text when text body is missing.
 * Intentionally simple -- not a full HTML parser.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

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
    return ApiResponse.webhookAck({ warning: 'Rate limited - retry later' });
  }

  try {
    const client = await getActiveClient(clientSlug);
    if (!client) {
      return ApiResponse.webhookAck({ warning: 'Client unavailable' });
    }

    const providerEventId = svixId || `resend-inbound-${Date.now()}`;

    const registration = await WebhookProcessor.register({
      workspaceId: client.id,
      provider: 'resend',
      providerEventId,
      rawBody,
      rawHeaders: svixId ? {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp || '',
        'svix-signature': svixSignature || '',
      } : undefined,
    });

    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'resend_inbound_duplicate',
        workspaceId: client.id,
        provider: 'resend',
        metadata: { providerEventId },
      });
      return ApiResponse.webhookAck({
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    const claimed = await WebhookProcessor.markProcessing(registration.id);
    if (!claimed) {
      return ApiResponse.webhookAck({
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    if (!svixId || !svixTimestamp || !svixSignature) {
      await WebhookProcessor.markFailed(registration.id, 'Missing svix signature headers');
      return ApiResponse.error(
        'Missing signature headers',
        400,
        ErrorCodes.MISSING_SIGNATURE
      );
    }

    const resendAdapter = await ResendAdapter.forWorkspace(client.id);
    if (!resendAdapter) {
      await WebhookProcessor.markFailed(registration.id, 'Resend not configured');
      return ApiResponse.webhookAck({ warning: 'Resend not configured' });
    }

    if (!resendAdapter.isWebhookConfigured()) {
      await WebhookProcessor.markFailed(registration.id, 'Webhook secret not configured');
      return ApiResponse.webhookAck({ warning: 'Webhook secret not configured' });
    }

    const verification = resendAdapter.verifyWebhook(rawBody, {
      svixId,
      svixTimestamp,
      svixSignature,
    });

    if (!verification.valid) {
      await WebhookProcessor.markFailed(registration.id, verification.error || 'Signature verification failed');
      await emitEvent({
        workspaceId: client.id,
        system: EventSystem.RESEND,
        eventType: 'resend_inbound_invalid_signature',
        success: false,
        errorMessage: verification.error,
      });
      return ApiResponse.error(
        verification.error || 'Webhook verification failed',
        400,
        ErrorCodes.INVALID_SIGNATURE
      );
    }

    // Parse inbound email payload
    const payload = verification.payload as {
      data: {
        from: string;
        to: string | string[];
        subject?: string;
        text?: string;
        html?: string;
        message_id?: string;
        headers?: Array<{ name: string; value: string }>;
      };
      type: string;
    };

    const emailData = payload.data;
    const senderEmail = emailData.from;
    const recipientEmails = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    const recipientEmail = recipientEmails[0] || '';
    const subject = emailData.subject || '';
    const messageBody = emailData.text || (emailData.html ? stripHtml(emailData.html) : '');
    const inboundMessageId = emailData.message_id || '';

    if (!senderEmail || !messageBody) {
      await WebhookProcessor.markFailed(registration.id, 'Missing sender or body');
      return ApiResponse.webhookAck({ warning: 'Missing sender or body' });
    }

    logStructured({
      correlationId: registration.correlationId,
      event: 'resend_inbound_received',
      workspaceId: client.id,
      provider: 'resend',
      metadata: {
        from: senderEmail,
        to: recipientEmail,
        subject,
        hasBody: !!messageBody,
      },
    });

    await emitEvent({
      workspaceId: client.id,
      system: EventSystem.RESEND,
      eventType: 'resend_inbound_received',
      success: true,
    });

    // Check opt-out
    const optedOut = await prisma.optOutRecord.findUnique({
      where: {
        workspaceId_contactAddress: {
          workspaceId: client.id,
          contactAddress: senderEmail,
        },
      },
    });
    if (optedOut) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'resend_inbound_opted_out',
        workspaceId: client.id,
        provider: 'resend',
        metadata: { from: senderEmail, optOutReason: optedOut.reason },
      });
      await WebhookProcessor.markProcessed(registration.id);
      return ApiResponse.webhookAck({ processed: true, warning: 'Contact opted out' });
    }

    // Check for active agent conversation (sender = contact, recipient = agent's from-address)
    const activeConversation = await prisma.conversation.findFirst({
      where: {
        workspaceId: client.id,
        contactAddress: senderEmail,
        channelAddress: recipientEmail,
        status: { in: [ConversationStatus.ACTIVE, ConversationStatus.PAUSED] },
      },
      select: { id: true, agentId: true, metadata: true },
    });

    if (activeConversation) {
      // Store inbound email message ID for threading
      if (inboundMessageId) {
        const existingMeta = (activeConversation.metadata as Record<string, unknown>) || {};
        await prisma.conversation.update({
          where: { id: activeConversation.id },
          data: {
            metadata: {
              ...existingMeta,
              lastEmailMessageId: inboundMessageId.startsWith('<') ? inboundMessageId : `<${inboundMessageId}>`,
              emailSubject: existingMeta.emailSubject || subject,
            } satisfies Prisma.JsonObject,
          },
        });
      }

      logStructured({
        correlationId: registration.correlationId,
        event: 'resend_inbound_agent_route',
        workspaceId: client.id,
        provider: 'resend',
        metadata: {
          conversationId: activeConversation.id,
          agentId: activeConversation.agentId,
          from: senderEmail,
        },
      });

      const agentResult = await handleInboundMessage({
        workspaceId: client.id,
        agentId: activeConversation.agentId,
        contactAddress: senderEmail,
        channelAddress: recipientEmail,
        channel: 'EMAIL',
        channelIntegration: 'RESEND',
        messageText: messageBody,
        callerContext: 'webhook',
      });

      await WebhookProcessor.markProcessed(registration.id);

      logStructured({
        correlationId: registration.correlationId,
        event: 'resend_inbound_processed',
        workspaceId: client.id,
        provider: 'resend',
        success: agentResult.success,
        metadata: {
          from: senderEmail,
          routedToAgent: true,
          conversationId: activeConversation.id,
        },
      });
    } else {
      // No active conversation -- fire workflow trigger
      let warning: string | undefined;
      const triggerResult = await emitTrigger(
        client.id,
        { adapter: 'resend', operation: 'email_received' },
        {
          from: senderEmail,
          to: recipientEmail,
          body: messageBody,
          subject,
          messageId: inboundMessageId,
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
          event: 'resend_inbound_workflow_partial_failure',
          workspaceId: client.id,
          provider: 'resend',
          error: warning,
          metadata: { from: senderEmail },
        });
      }

      await WebhookProcessor.markProcessed(registration.id);

      logStructured({
        correlationId: registration.correlationId,
        event: 'resend_inbound_processed',
        workspaceId: client.id,
        provider: 'resend',
        success: true,
        metadata: {
          from: senderEmail,
          triggerFired: triggerResult.workflowsExecuted > 0,
        },
      });
    }

    const response = ApiResponse.webhookAck({
      processed: true,
      correlationId: registration.correlationId,
    });

    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'resend_inbound_error',
      workspaceId: clientSlug,
      provider: 'resend',
      error: errorMessage,
    });

    return ApiResponse.webhookAck({
      warning: 'Internal error processing webhook',
    });
  }
}
