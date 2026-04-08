/**
 * Webchat API
 * 
 * POST /api/v1/chat
 * 
 * Public endpoint for webchat messages. Called by the WebchatWidget component.
 * Returns the agent's reply directly in the JSON response — no channel adapter
 * needed because the reply goes back to the HTTP caller.
 * 
 * STANDARDS:
 * - Rate limited per sessionId (10 req/min)
 * - Workspace resolved by slug, must be ACTIVE
 * - Agent verified as active before processing
 * - Uses handleInboundMessage with channel 'WEB_CHAT'
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/_lib/db';
import { getActiveClient } from '@/app/_lib/client-gate';
import { handleInboundMessage } from '@/app/_lib/agent/engine';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { checkRateLimit } from '@/app/_lib/middleware/rate-limit';
import { RATE_LIMITS } from '@/app/_lib/types';
import { logStructured } from '@/app/_lib/reliability';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';

const chatSchema = z.object({
  workspaceSlug: z.string().min(1).optional(),
  agentId: z.string().uuid().optional(),
  configId: z.string().uuid().optional(),
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  visitorEmail: z.string().email().optional(),
  visitorName: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues[0]?.message || 'Invalid input',
      400,
      ErrorCodes.INVALID_INPUT,
    );
  }

  const { workspaceSlug, agentId: rawAgentId, configId, sessionId, message, visitorEmail, visitorName } = parsed.data;

  // Rate limit per session
  const rateCheck = checkRateLimit(`chat:${sessionId}`, RATE_LIMITS.CHAT);
  if (!rateCheck.allowed) {
    return ApiResponse.rateLimited(rateCheck.retryAfter);
  }

  let resolvedWorkspaceId: string;
  let agentId: string;

  if (configId) {
    const config = await prisma.webchatConfig.findUnique({
      where: { id: configId },
      include: {
        workspace: { select: { id: true, status: true } },
        agent: { select: { id: true, active: true } },
      },
    });
    if (!config || !config.active || config.workspace.status !== 'ACTIVE' || !config.agent.active) {
      return ApiResponse.error('Chat not available', 404, ErrorCodes.NOT_FOUND);
    }
    resolvedWorkspaceId = config.workspace.id;
    agentId = config.agent.id;
  } else {
    if (!workspaceSlug || !rawAgentId) {
      return ApiResponse.error('Either configId or workspaceSlug+agentId is required', 400, ErrorCodes.INVALID_INPUT);
    }
    const workspace = await getActiveClient(workspaceSlug);
    if (!workspace) {
      return ApiResponse.error('Workspace not found or inactive', 404, ErrorCodes.NOT_FOUND);
    }
    resolvedWorkspaceId = workspace.id;
    agentId = rawAgentId;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId, workspaceId: resolvedWorkspaceId },
      select: { id: true, active: true },
    });
    if (!agent || !agent.active) {
      return ApiResponse.error('Agent not available', 404, ErrorCodes.NOT_FOUND);
    }
  }

  try {
    const contactAddress = visitorEmail || sessionId;

    const result = await handleInboundMessage({
      workspaceId: resolvedWorkspaceId,
      agentId,
      contactAddress,
      channelAddress: agentId,
      channel: 'WEB_CHAT',
      channelIntegration: 'BUILT_IN',
      messageText: message,
      callerContext: 'api',
      ...(visitorName && { leadId: undefined }),
    });

    if (!result.success) {
      const errorDetail = result.error || 'Engine returned failure';

      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'webchat_reply_failed',
        workspaceId: resolvedWorkspaceId,
        provider: 'webchat',
        success: false,
        error: errorDetail,
        metadata: { agentId, sessionId, configId },
      });

      await emitEvent({
        workspaceId: resolvedWorkspaceId,
        system: EventSystem.AGENT,
        eventType: 'webchat_reply_failed',
        success: false,
        errorMessage: errorDetail,
        metadata: { agentId, sessionId, configId, channel: 'WEB_CHAT' },
      });

      return ApiResponse.error(
        'Unable to process message',
        500,
        ErrorCodes.INTEGRATION_ERROR,
      );
    }

    return ApiResponse.success({
      reply: result.rateLimited
        ? 'I\'m receiving a lot of messages right now. Please try again in a few minutes.'
        : result.replyText,
      conversationId: result.conversationId,
      isNewConversation: result.isNewConversation,
    });
  } catch (error) {
    const errorDetail = error instanceof Error ? error.message : 'Unknown error';

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'webchat_error',
      workspaceId: resolvedWorkspaceId,
      provider: 'webchat',
      success: false,
      error: errorDetail,
      metadata: { agentId, sessionId, configId },
    });

    await emitEvent({
      workspaceId: resolvedWorkspaceId,
      system: EventSystem.AGENT,
      eventType: 'webchat_error',
      success: false,
      errorMessage: errorDetail,
      metadata: { agentId, sessionId, configId, channel: 'WEB_CHAT' },
    });

    return ApiResponse.internalError();
  }
}
