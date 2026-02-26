/**
 * Chatbot Conversations API
 *
 * GET /api/v1/workspaces/[id]/chatbots/[chatbotId]/conversations -- List conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chatbotId: string }> }
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

  // Verify chatbot belongs to workspace
  const chatbot = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
  });

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const where: Record<string, unknown> = { chatbotId };
  if (status) {
    where.status = status;
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        contactAddress: true,
        channelAddress: true,
        channel: true,
        status: true,
        messageCount: true,
        totalTokens: true,
        startedAt: true,
        lastMessageAt: true,
        endedAt: true,
        lead: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  return NextResponse.json({
    data: conversations,
    pagination: { total, limit, offset },
  });
}
