/**
 * Individual Chatbot File API
 *
 * DELETE /api/v1/workspaces/[id]/chatbots/[chatbotId]/files/[fileId] -- Delete file
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';

type RouteParams = { params: Promise<{ id: string; chatbotId: string; fileId: string }> };

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, chatbotId, fileId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const chatbot = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
    select: { id: true },
  });
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  const file = await prisma.chatbotFile.findFirst({
    where: { id: fileId, chatbotId },
  });
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  await prisma.chatbotFile.delete({ where: { id: fileId } });

  return NextResponse.json({ success: true });
}
