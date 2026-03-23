/**
 * Agent Test Chat API
 *
 * POST   -- Send a test message to the agent (real AI, no channel delivery)
 * GET    -- List test conversations for this agent
 * DELETE -- Clear all test conversations for this agent
 */

import { NextRequest } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { handleInboundMessage } from '@/app/_lib/agent';
import { estimateCost, getDefaultModel } from '@/app/_lib/agent/pricing';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { TestChatSchema } from '@/app/_lib/agent/schemas';
import { rateLimitByIdentifier } from '@/app/_lib/middleware/rate-limit';

type RouteParams = { params: Promise<{ id: string; agentId: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const rateLimit = rateLimitByIdentifier(`test_chat:${userId}`, { requests: 30, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return ApiResponse.error('Rate limit exceeded', 429, ErrorCodes.RATE_LIMITED);
  }

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = TestChatSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const { messageText, systemPromptOverride, conversationId } = parsed.data;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  const result = await handleInboundMessage({
    workspaceId,
    agentId,
    contactAddress: `test-user-${userId}`,
    channelAddress: 'test-bot',
    channel: 'TEST',
    messageText: messageText.trim(),
    testMode: true,
    systemPromptOverride: systemPromptOverride || undefined,
    conversationId,
  });

  const model = agent.modelOverride || getDefaultModel(agent.aiIntegration);
  const costEstimate = estimateCost(
    model,
    result.usage.promptTokens,
    result.usage.completionTokens
  );

  return ApiResponse.success({ ...result, costEstimate, model });
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { workspaceId, agentId, isTest: true },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            promptTokens: true,
            completionTokens: true,
            turnLog: true,
            createdAt: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.conversation.count({
      where: { workspaceId, agentId, isTest: true },
    }),
  ]);

  return ApiResponse.success({ conversations, total });
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  if (access.role === 'VIEWER') {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  const testConversations = await prisma.conversation.findMany({
    where: { workspaceId, agentId, isTest: true },
    select: { id: true },
  });

  const conversationIds = testConversations.map((c) => c.id);

  if (conversationIds.length > 0) {
    await prisma.conversationMessage.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });

    await prisma.conversation.deleteMany({
      where: { id: { in: conversationIds } },
    });
  }

  return ApiResponse.success({ deleted: conversationIds.length });
}
