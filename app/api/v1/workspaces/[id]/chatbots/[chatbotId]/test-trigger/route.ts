/**
 * Chatbot Test Trigger API
 *
 * POST -- Simulate a workflow trigger hitting the chatbot.
 * Tests the "bot reaches out first" flow where a workflow
 * action activates the chatbot for a contact.
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
  const {
    from = `test-contact-${userId}`,
    to = 'test-bot',
    messageBody = 'Hello',
    systemPromptOverride,
  } = body as {
    from?: string;
    to?: string;
    messageBody?: string;
    systemPromptOverride?: string;
  };

  const chatbot = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
  });

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  const result = await handleInboundMessage({
    workspaceId,
    chatbotId,
    contactAddress: from,
    channelAddress: to,
    channel: 'TEST',
    messageText: messageBody,
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
      triggerSimulated: true,
      triggerPayload: { from, to, body: messageBody },
    },
  });
}

