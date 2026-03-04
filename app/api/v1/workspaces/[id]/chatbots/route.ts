/**
 * Chatbot CRUD API
 *
 * GET  /api/v1/workspaces/[id]/chatbots -- List all chatbots for workspace
 * POST /api/v1/workspaces/[id]/chatbots -- Create a new chatbot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { IntegrationType } from '@prisma/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const chatbots = await prisma.chatbot.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          conversations: { where: { isTest: false } },
        },
      },
    },
  });

  return NextResponse.json({
    data: chatbots.map((bot) => ({
      ...bot,
      conversationCount: bot._count.conversations,
      _count: undefined,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (access.role === 'VIEWER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();

  const {
    name,
    description,
    channelType,
    channelIntegration,
    aiIntegration,
    systemPrompt,
    initialMessage,
    modelOverride,
    temperatureOverride,
    maxTokensOverride,
    maxMessagesPerConversation,
    maxTokensPerConversation,
    conversationTimeoutMinutes,
    fallbackMessage,
    allowedEvents,
    active,
  } = body;

  if (!name || !aiIntegration || !systemPrompt) {
    return NextResponse.json(
      { error: 'Missing required fields: name, aiIntegration, systemPrompt' },
      { status: 400 }
    );
  }

  // Validate AI integration exists
  const aiInt = await prisma.workspaceIntegration.findFirst({
    where: { workspaceId, integration: aiIntegration as IntegrationType },
  });
  if (!aiInt) {
    return NextResponse.json(
      { error: `AI integration ${aiIntegration} not configured for this workspace` },
      { status: 400 }
    );
  }

  // Validate channel integration if provided
  if (channelIntegration) {
    const channelInt = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: channelIntegration as IntegrationType },
    });
    if (!channelInt) {
      return NextResponse.json(
        { error: `Channel integration ${channelIntegration} not configured for this workspace` },
        { status: 400 }
      );
    }
  }

  const chatbot = await prisma.chatbot.create({
    data: {
      workspaceId,
      name,
      description: description || null,
      channelType: channelType || null,
      channelIntegration: channelIntegration || null,
      aiIntegration,
      systemPrompt,
      initialMessage: initialMessage || null,
      modelOverride: modelOverride || null,
      temperatureOverride: temperatureOverride ?? null,
      maxTokensOverride: maxTokensOverride ?? null,
      maxMessagesPerConversation: maxMessagesPerConversation ?? 50,
      maxTokensPerConversation: maxTokensPerConversation ?? 100000,
      conversationTimeoutMinutes: conversationTimeoutMinutes ?? 1440,
      fallbackMessage: fallbackMessage || null,
      allowedEvents: allowedEvents || [],
      active: active ?? true,
    },
  });

  return NextResponse.json({ data: chatbot }, { status: 201 });
}
