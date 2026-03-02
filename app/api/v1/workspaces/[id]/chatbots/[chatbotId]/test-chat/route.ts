/**
 * Chatbot Test Chat API
 *
 * POST   -- Send a test message to the chatbot (real AI, no channel delivery)
 * GET    -- List test conversations for this chatbot
 * DELETE -- Clear all test conversations for this chatbot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { handleInboundMessage } from '@/app/_lib/chatbot';
import { estimateCost, getDefaultModel } from '@/app/_lib/chatbot/pricing';

type RouteParams = { params: Promise<{ id: string; chatbotId: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, chatbotId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const body = await request.json();
  const { messageText, systemPromptOverride } = body as {
    messageText?: string;
    systemPromptOverride?: string;
  };

  if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
    return NextResponse.json({ error: 'messageText is required' }, { status: 400 });
  }

  const chatbot = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
  });

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  const result = await handleInboundMessage({
    workspaceId,
    chatbotId,
    contactAddress: `test-user-${userId}`,
    channelAddress: 'test-bot',
    channel: 'TEST',
    messageText: messageText.trim(),
    testMode: true,
    systemPromptOverride: systemPromptOverride || undefined,
  });

  const model = chatbot.modelOverride || getDefaultModel(chatbot.aiIntegration);
  const costEstimate = estimateCost(
    model,
    result.usage.promptTokens,
    result.usage.completionTokens
  );

  return NextResponse.json({
    data: {
      ...result,
      costEstimate,
      model,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, chatbotId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const conversations = await prisma.conversation.findMany({
    where: {
      workspaceId,
      chatbotId,
      isTest: true,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          promptTokens: true,
          completionTokens: true,
          createdAt: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    skip: offset,
  });

  const total = await prisma.conversation.count({
    where: {
      workspaceId,
      chatbotId,
      isTest: true,
    },
  });

  return NextResponse.json({ data: conversations, total });
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, chatbotId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (access.role === 'VIEWER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const testConversations = await prisma.conversation.findMany({
    where: { workspaceId, chatbotId, isTest: true },
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

  return NextResponse.json({
    data: { deleted: conversationIds.length },
  });
}

