/**
 * Individual Chatbot CRUD API
 *
 * GET    /api/v1/workspaces/[id]/chatbots/[chatbotId] -- Get chatbot details
 * PATCH  /api/v1/workspaces/[id]/chatbots/[chatbotId] -- Update chatbot config
 * DELETE /api/v1/workspaces/[id]/chatbots/[chatbotId] -- Delete chatbot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ConversationStatus, IntegrationType } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string; chatbotId: string }> };

export async function GET(
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

  const chatbot = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
    include: {
      _count: {
        select: {
          conversations: { where: { isTest: false } },
        },
      },
    },
  });

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...chatbot,
      conversationCount: chatbot._count.conversations,
      _count: undefined,
    },
  });
}

export async function PATCH(
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

  if (access.role === 'VIEWER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const existing = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  const body = await request.json();

  // Only update fields that are provided
  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    'name', 'description', 'channelType', 'channelIntegration',
    'aiIntegration', 'systemPrompt', 'modelOverride', 'temperatureOverride',
    'maxTokensOverride', 'maxMessagesPerConversation', 'maxTokensPerConversation',
    'conversationTimeoutMinutes', 'responseDelaySeconds', 'fallbackMessage',
    'allowedEvents', 'active', 'initialMessage',
  ];

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  // Validate integration references if changed (allow null to clear)
  if (updateData.channelIntegration && updateData.channelIntegration !== null) {
    const channelInt = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: updateData.channelIntegration as IntegrationType },
    });
    if (!channelInt) {
      return NextResponse.json(
        { error: `Channel integration ${updateData.channelIntegration} not configured` },
        { status: 400 }
      );
    }
  }

  if (updateData.aiIntegration) {
    const aiInt = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: updateData.aiIntegration as IntegrationType },
    });
    if (!aiInt) {
      return NextResponse.json(
        { error: `AI integration ${updateData.aiIntegration} not configured` },
        { status: 400 }
      );
    }
  }

  const chatbot = await prisma.chatbot.update({
    where: { id: chatbotId },
    data: updateData,
  });

  return NextResponse.json({ data: chatbot });
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

  if (access.role !== 'OWNER' && access.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const existing = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  // End any active conversations before deletion
  await prisma.conversation.updateMany({
    where: {
      chatbotId,
      status: ConversationStatus.ACTIVE,
    },
    data: {
      status: ConversationStatus.COMPLETED,
      endedAt: new Date(),
    },
  });

  await prisma.chatbot.delete({ where: { id: chatbotId } });

  return NextResponse.json({ data: { deleted: true } });
}
